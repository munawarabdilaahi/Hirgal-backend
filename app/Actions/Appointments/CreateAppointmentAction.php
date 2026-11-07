<?php

namespace App\Actions\Appointments;

use App\Enums\AccountStatus;
use App\Enums\ParticipantStatus;
use App\Models\Appointment;
use App\Models\AppointmentParticipant;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use App\Policies\AppointmentPolicy;
use App\Services\Appointment\AppointmentConflictService;
use App\Services\Appointment\AppointmentTime;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateAppointmentAction
{
    public function __construct(private readonly AppointmentTime $appointmentTime, private readonly AppointmentConflictService $conflicts, private readonly AppointmentPolicy $policy) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array{appointment: Appointment, conflicts: array<string, mixed>}
     */
    public function execute(User $actor, array $data): array
    {
        return DB::transaction(function () use ($actor, $data): array {
            abort_unless($this->policy->create($actor), 403);
            $project = isset($data['project_uuid']) ? Project::query()->where('uuid', $data['project_uuid'])->firstOrFail() : null;
            $team = isset($data['team_uuid']) ? Team::query()->where('uuid', $data['team_uuid'])->firstOrFail() : null;
            if ($project !== null) {
                $project = Project::query()->whereKey($project->id)->lockForUpdate()->firstOrFail();
                abort_unless($this->policy->canCreateInProject($actor, $project->id), 404);
            }
            if ($team !== null) {
                $team = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();
                abort_unless($this->policy->canCreateInTeam($actor, $team->id), 404);
            }
            $participantIds = array_values(array_unique(array_map('intval', $data['participants'] ?? [])));
            if (in_array($actor->id, $participantIds, true)) {
                throw ValidationException::withMessages(['participants' => ['The organizer cannot invite themselves as a participant.']]);
            }
            $userIds = array_values(array_unique([$actor->id, ...$participantIds]));
            User::query()->whereIn('id', $userIds)->orderBy('id')->lockForUpdate()->get(['id']);

            $users = User::query()->whereIn('id', $participantIds)->get();
            if ($users->count() !== count($participantIds) || $users->contains(fn (User $user): bool => $user->account_status !== AccountStatus::Active)) {
                throw ValidationException::withMessages(['participants' => ['All participants must be active users.']]);
            }
            if ($project !== null && $users->contains(fn (User $user): bool => ! $project->members()->whereKey($user->id)->exists() && $project->owner_id !== $user->id)) {
                throw ValidationException::withMessages(['participants' => ['Project appointments may only invite project members.']]);
            }
            if ($team !== null && $users->contains(fn (User $user): bool => ! $team->members()->whereKey($user->id)->exists() && $team->leader_id !== $user->id)) {
                throw ValidationException::withMessages(['participants' => ['Team appointments may only invite team members.']]);
            }

            $range = $this->appointmentTime->parseRange($data['start_time'], $data['end_time'], $data['timezone']);
            $appointment = Appointment::query()->create([
                'organizer_id' => $actor->id,
                'project_id' => $project?->id,
                'team_id' => $team?->id,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'timezone' => $data['timezone'],
                'start_time' => $range['start_time'],
                'end_time' => $range['end_time'],
                'location_type' => $data['location_type'] ?? 'virtual',
                'meeting_link' => $data['meeting_link'] ?? null,
                'location_address' => $data['location_address'] ?? null,
                'status' => 'scheduled',
            ]);
            foreach ($participantIds as $participantId) {
                AppointmentParticipant::query()->create([
                    'appointment_id' => $appointment->id,
                    'user_id' => $participantId,
                    'status' => ParticipantStatus::Pending,
                ]);
            }

            $conflicts = $this->conflicts->detect($userIds, $range['start_time'], $range['end_time'], $actor, $appointment->id);

            return ['appointment' => $appointment->load(['organizer', 'project', 'team', 'participantRecords.user']), 'conflicts' => $conflicts];
        });
    }
}
