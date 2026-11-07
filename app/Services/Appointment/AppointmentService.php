<?php

namespace App\Services\Appointment;

use App\Actions\Appointments\CancelAppointmentAction;
use App\Actions\Appointments\CreateAppointmentAction;
use App\Actions\Appointments\ManageAppointmentParticipantAction;
use App\Actions\Appointments\RespondToAppointmentAction;
use App\Actions\Appointments\UpdateAppointmentAction;
use App\Enums\AppointmentStatus;
use App\Enums\ParticipantStatus;
use App\Models\ActivityLog;
use App\Models\Appointment;
use App\Models\AppointmentParticipant;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use App\Notifications\AppointmentNotification;
use App\Policies\AppointmentPolicy;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

class AppointmentService
{
    public function __construct(
        private readonly AppointmentPolicy $policy,
        private readonly CreateAppointmentAction $createAction,
        private readonly UpdateAppointmentAction $updateAction,
        private readonly CancelAppointmentAction $cancelAction,
        private readonly ManageAppointmentParticipantAction $participantAction,
        private readonly RespondToAppointmentAction $responseAction,
        private readonly AppointmentConflictService $conflicts,
    ) {}

    /** @param array<string, mixed> $filters */
    public function list(User $actor, array $filters, bool $calendar = false): LengthAwarePaginator
    {
        if ($calendar && (! isset($filters['from'], $filters['to']) || strtotime($filters['to']) - strtotime($filters['from']) > 90 * 86400)) {
            throw ValidationException::withMessages(['from' => ['Calendar queries require a range no longer than 90 days.']]);
        }

        $query = Appointment::query()->with(['organizer', 'project', 'team', 'participantRecords' => fn ($q) => $q->whereNull('removed_at'), 'participantRecords.user']);
        $query->where(function ($scope) use ($actor): void {
            $scope->where('organizer_id', $actor->id)
                ->orWhereHas('participantRecords', fn ($participant) => $participant->where('user_id', $actor->id)->whereNull('removed_at'))
                ->orWhereHas('project', fn ($project) => $project->where('owner_id', $actor->id)->orWhereHas('projectMembers', fn ($member) => $member->where('user_id', $actor->id)))
                ->orWhereHas('team', fn ($team) => $team->where('leader_id', $actor->id)->orWhereHas('teamMembers', fn ($member) => $member->where('user_id', $actor->id)));
        });

        if (isset($filters['from'])) {
            $query->where('end_time', '>', (new \DateTimeImmutable($filters['from']))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s'));
        }
        if (isset($filters['to'])) {
            $query->where('start_time', '<', (new \DateTimeImmutable($filters['to']))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s'));
        }
        if (isset($filters['project_uuid'])) {
            $query->whereHas('project', fn ($project) => $project->where('uuid', $filters['project_uuid']));
        }
        if (isset($filters['team_uuid'])) {
            $query->whereHas('team', fn ($team) => $team->where('uuid', $filters['team_uuid']));
        }
        if (($filters['context'] ?? null) === 'personal') {
            $query->whereNull('project_id')->whereNull('team_id');
        } elseif (($filters['context'] ?? null) === 'project') {
            $query->whereNotNull('project_id');
        } elseif (($filters['context'] ?? null) === 'team') {
            $query->whereNotNull('team_id');
        }
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->orderBy('start_time')->paginate((int) ($filters['per_page'] ?? 15));
    }

    public function resolveVisible(string $uuid, User $actor): Appointment
    {
        $appointment = Appointment::query()->where('uuid', $uuid)->firstOrFail();
        abort_unless($this->policy->view($actor, $appointment), 404);

        return $appointment->load(['organizer', 'project', 'team', 'participantRecords' => fn ($q) => $q->whereNull('removed_at'), 'participantRecords.user']);
    }

    /** @param array<string, mixed> $data
     * @return array{appointment: Appointment, conflicts: array<string, mixed>}
     */
    public function create(User $actor, array $data): array
    {
        abort_unless($this->policy->create($actor), 403);
        if (isset($data['project_uuid'])) {
            $project = Project::query()->where('uuid', $data['project_uuid'])->firstOrFail();
            abort_unless($this->policy->canCreateInProject($actor, $project->id), 404);
        }
        if (isset($data['team_uuid'])) {
            $team = Team::query()->where('uuid', $data['team_uuid'])->firstOrFail();
            abort_unless($this->policy->canCreateInTeam($actor, $team->id), 404);
        }
        $result = $this->createAction->execute($actor, $data);
        $this->notifyAfterCommit($result['appointment']->participants()->wherePivotNull('removed_at')->get(), $result['appointment'], 'invitation');

        return $result;
    }

    /** @param array<string, mixed> $data
     * @return array{appointment: Appointment, conflicts: array<string, mixed>}
     */
    public function update(User $actor, Appointment $appointment, array $data): array
    {
        abort_unless($this->policy->update($actor, $appointment), 404);
        $result = $this->updateAction->execute($actor, $appointment, $data);
        $this->notifyAfterCommit($appointment->participants()->wherePivotNull('removed_at')->get(), $appointment, 'updated');

        return $result;
    }

    public function cancel(User $actor, Appointment $appointment): Appointment
    {
        abort_unless($this->policy->update($actor, $appointment), 404);
        $appointment = $this->cancelAction->execute($actor, $appointment);
        $this->notifyAfterCommit($appointment->participants()->wherePivotNull('removed_at')->get(), $appointment, 'cancelled');

        return $appointment;
    }

    /** @return array{participant: AppointmentParticipant, conflicts: array<string, mixed>} */
    public function respond(User $actor, Appointment $appointment, string $status): array
    {
        abort_unless($this->policy->canRespond($actor, $appointment), 404);
        $result = $this->responseAction->execute($actor, $appointment, ParticipantStatus::from($status));
        if ($appointment->organizer) {
            DB::afterCommit(fn () => Notification::send($appointment->organizer, new AppointmentNotification($appointment, $status.' response received')));
        }

        return $result;
    }

    public function addParticipant(User $actor, Appointment $appointment, User $invitee): array
    {
        abort_unless($this->policy->update($actor, $appointment), 404);
        if (! in_array($appointment->status, [AppointmentStatus::Scheduled, AppointmentStatus::Confirmed], true)) {
            throw ValidationException::withMessages(['status' => ['Only scheduled or confirmed appointments accept new participants.']]);
        }
        if ($appointment->project_id !== null && ! $invitee->projects()->whereKey($appointment->project_id)->exists() && $appointment->project?->owner_id !== $invitee->id) {
            throw ValidationException::withMessages(['user_id' => ['The user is not a member of this project.']]);
        }
        if ($appointment->team_id !== null && ! $invitee->teams()->whereKey($appointment->team_id)->exists() && $appointment->team?->leader_id !== $invitee->id) {
            throw ValidationException::withMessages(['user_id' => ['The user is not a member of this team.']]);
        }
        [$record, $conflicts, $shouldNotify] = DB::transaction(function () use ($appointment, $invitee, $actor): array {
            Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            User::query()->whereIn('id', [$appointment->organizer_id, $invitee->id])->orderBy('id')->lockForUpdate()->get(['id']);
            $existing = AppointmentParticipant::query()->where('appointment_id', $appointment->id)->where('user_id', $invitee->id)->first();
            $record = $this->participantAction->add($actor, $appointment, $invitee);
            $conflicts = $this->conflicts->detect([$invitee->id], $appointment->start_time, $appointment->end_time, $actor, $appointment->id);

            return [$record, $conflicts, $existing === null || $existing->removed_at !== null];
        });
        if ($shouldNotify) {
            DB::afterCommit(fn () => Notification::send($invitee, new AppointmentNotification($appointment, 'invitation')));
        }

        return ['participant' => $record->load('user'), 'conflicts' => $conflicts];
    }

    public function removeParticipant(User $actor, Appointment $appointment, User $invitee): void
    {
        abort_unless($this->policy->update($actor, $appointment), 404);
        $this->participantAction->remove($appointment, $invitee, $actor);
    }

    public function delete(User $actor, Appointment $appointment): void
    {
        abort_unless($this->policy->delete($actor, $appointment), 404);
        DB::transaction(function () use ($actor, $appointment): void {
            $appointment = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            abort_unless($this->policy->delete($actor, $appointment), 404);
            $appointment->delete();
        });
    }

    public function auditedAdminView(User $actor, Appointment $appointment, string $reason): Appointment
    {
        abort_unless($this->policy->canAdminView($actor), 403);
        ActivityLog::query()->create([
            'user_id' => $actor->id,
            'action' => 'appointment.admin.view',
            'subject_type' => Appointment::class,
            'subject_id' => $appointment->id,
            'description' => 'System administrator viewed an appointment for support.',
            'properties' => [
                'appointment_uuid' => $appointment->uuid,
                'context_type' => $appointment->project_id !== null ? 'project' : ($appointment->team_id !== null ? 'team' : 'personal'),
                'context_id' => $appointment->project_id ?? $appointment->team_id,
                'access_mode' => 'read_only',
                'reason' => $reason,
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);

        return $appointment->load(['organizer', 'project', 'team', 'participantRecords' => fn ($q) => $q->whereNull('removed_at'), 'participantRecords.user']);
    }

    private function notifyAfterCommit(iterable $users, Appointment $appointment, string $event): void
    {
        DB::afterCommit(function () use ($users, $appointment, $event): void {
            Notification::send($users, new AppointmentNotification($appointment, $event));
        });
    }
}
