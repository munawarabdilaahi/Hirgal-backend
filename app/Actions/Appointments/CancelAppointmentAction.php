<?php

namespace App\Actions\Appointments;

use App\Enums\AppointmentStatus;
use App\Models\Appointment;
use App\Models\User;
use App\Policies\AppointmentPolicy;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CancelAppointmentAction
{
    public function __construct(private readonly AppointmentPolicy $policy) {}

    public function execute(User $actor, Appointment $appointment): Appointment
    {
        return DB::transaction(function () use ($actor, $appointment): Appointment {
            $appointment = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            abort_unless($this->policy->update($actor, $appointment), 404);
            if (! in_array($appointment->status, [AppointmentStatus::Scheduled, AppointmentStatus::Confirmed], true)) {
                throw ValidationException::withMessages(['status' => ['Only scheduled or confirmed appointments can be cancelled.']]);
            }
            $appointment->forceFill(['status' => AppointmentStatus::Cancelled, 'cancelled_at' => now(), 'cancelled_by' => $actor->id])->save();

            return $appointment->load(['organizer', 'project', 'team', 'participantRecords.user']);
        });
    }
}
