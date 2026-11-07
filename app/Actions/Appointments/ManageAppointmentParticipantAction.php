<?php

namespace App\Actions\Appointments;

use App\Enums\AccountStatus;
use App\Enums\AppointmentStatus;
use App\Enums\ParticipantStatus;
use App\Models\Appointment;
use App\Models\AppointmentParticipant;
use App\Models\ProjectMember;
use App\Models\TeamMember;
use App\Models\User;
use App\Policies\AppointmentPolicy;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ManageAppointmentParticipantAction
{
    public function __construct(private readonly AppointmentPolicy $policy) {}

    public function add(User $actor, Appointment $appointment, User $invitee): AppointmentParticipant
    {
        return DB::transaction(function () use ($actor, $appointment, $invitee): AppointmentParticipant {
            $appointment = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            abort_unless($this->policy->update($actor, $appointment), 404);
            if (! in_array($appointment->status, [AppointmentStatus::Scheduled, AppointmentStatus::Confirmed], true)) {
                throw ValidationException::withMessages(['status' => ['Only scheduled or confirmed appointments accept new participants.']]);
            }
            User::query()->whereIn('id', [$appointment->organizer_id, $invitee->id])->orderBy('id')->lockForUpdate()->get(['id']);
            $invitee = User::query()->whereKey($invitee->id)->lockForUpdate()->firstOrFail();
            if ($invitee->account_status !== AccountStatus::Active) {
                throw ValidationException::withMessages(['user_id' => ['Only active users may be invited.']]);
            }
            if ($appointment->project_id !== null
                && $appointment->project?->owner_id !== $invitee->id
                && ! ProjectMember::query()->where('project_id', $appointment->project_id)->where('user_id', $invitee->id)->exists()) {
                throw ValidationException::withMessages(['user_id' => ['The user is not a member of this project.']]);
            }
            if ($appointment->team_id !== null
                && $appointment->team?->leader_id !== $invitee->id
                && ! TeamMember::query()->where('team_id', $appointment->team_id)->where('user_id', $invitee->id)->exists()) {
                throw ValidationException::withMessages(['user_id' => ['The user is not a member of this team.']]);
            }
            $record = AppointmentParticipant::query()->where('appointment_id', $appointment->id)->where('user_id', $invitee->id)->first();
            if ($record === null) {
                return AppointmentParticipant::query()->create(['appointment_id' => $appointment->id, 'user_id' => $invitee->id, 'status' => ParticipantStatus::Pending]);
            }
            if ($record->removed_at !== null) {
                $history = $record->response_history ?? [];
                $history[] = ['status' => $record->status->value, 'responded_at' => $record->responded_at?->toIso8601String(), 'removed_at' => $record->removed_at->toIso8601String()];
                $record->forceFill(['response_history' => $history, 'status' => ParticipantStatus::Pending, 'responded_at' => null, 'removed_at' => null, 'removed_by' => null])->save();
            }

            return $record->refresh();
        });
    }

    public function remove(Appointment $appointment, User $invitee, User $actor): void
    {
        DB::transaction(function () use ($appointment, $invitee, $actor): void {
            $appointment = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            abort_unless($this->policy->update($actor, $appointment), 404);
            User::query()->whereIn('id', [$appointment->organizer_id, $invitee->id])->orderBy('id')->lockForUpdate()->get(['id']);
            $record = AppointmentParticipant::query()->where('appointment_id', $appointment->id)->where('user_id', $invitee->id)->firstOrFail();
            if ($record->removed_at === null) {
                $record->forceFill(['removed_at' => now(), 'removed_by' => $actor->id])->save();
            }
        });
    }
}
