<?php

namespace App\Actions\Appointments;

use App\Enums\AccountStatus;
use App\Enums\AppointmentStatus;
use App\Enums\ParticipantStatus;
use App\Models\Appointment;
use App\Models\AppointmentParticipant;
use App\Models\User;
use App\Policies\AppointmentPolicy;
use App\Services\Appointment\AppointmentConflictService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RespondToAppointmentAction
{
    public function __construct(private readonly AppointmentConflictService $conflicts, private readonly AppointmentPolicy $policy) {}

    /** @return array{participant: AppointmentParticipant, conflicts: array<string, mixed>} */
    public function execute(User $actor, Appointment $appointment, ParticipantStatus $status): array
    {
        return DB::transaction(function () use ($actor, $appointment, $status): array {
            $appointment = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            abort_unless($this->policy->canRespond($actor, $appointment), 404);
            $actor = User::query()->whereKey($actor->id)->lockForUpdate()->firstOrFail();
            if ($actor->account_status !== AccountStatus::Active) {
                abort(403);
            }
            if (! in_array($appointment->status, [AppointmentStatus::Scheduled, AppointmentStatus::Confirmed], true)) {
                throw ValidationException::withMessages(['status' => ['This appointment no longer accepts responses.']]);
            }
            $participant = AppointmentParticipant::query()->where('appointment_id', $appointment->id)->where('user_id', $actor->id)->whereNull('removed_at')->firstOrFail();
            $participant->status = $status;
            $participant->responded_at = now();
            $participant->save();
            $warnings = in_array($status, [ParticipantStatus::Accepted, ParticipantStatus::Tentative], true)
                ? $this->conflicts->detect([$actor->id], $appointment->start_time, $appointment->end_time, $actor, $appointment->id)
                : ['has_conflicts' => false, 'items' => []];

            return ['participant' => $participant->load('user'), 'conflicts' => $warnings];
        });
    }
}
