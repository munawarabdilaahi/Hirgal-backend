<?php

namespace App\Actions\Appointments;

use App\Enums\AppointmentStatus;
use App\Models\Appointment;
use App\Models\User;
use App\Policies\AppointmentPolicy;
use App\Services\Appointment\AppointmentConflictService;
use App\Services\Appointment\AppointmentTime;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateAppointmentAction
{
    public function __construct(private readonly AppointmentTime $appointmentTime, private readonly AppointmentConflictService $conflicts, private readonly AppointmentPolicy $policy) {}

    /** @param array<string, mixed> $data
     * @return array{appointment: Appointment, conflicts: array<string, mixed>}
     */
    public function execute(User $actor, Appointment $appointment, array $data): array
    {
        return DB::transaction(function () use ($actor, $appointment, $data): array {
            $appointment = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            abort_unless($this->policy->update($actor, $appointment), 404);
            if (! in_array($appointment->status, [AppointmentStatus::Scheduled, AppointmentStatus::Confirmed], true)) {
                throw ValidationException::withMessages(['status' => ['Completed or cancelled appointments cannot be changed.']]);
            }
            $participantIds = $appointment->participantRecords()->whereNull('removed_at')->whereIn('status', ['accepted', 'tentative'])->pluck('user_id')->map(fn ($id): int => (int) $id)->all();
            $userIds = array_values(array_unique([$appointment->organizer_id, ...$participantIds]));
            User::query()->whereIn('id', $userIds)->orderBy('id')->lockForUpdate()->get(['id']);
            $timezone = $data['timezone'] ?? $appointment->timezone;

            if (isset($data['start_time']) || isset($data['end_time'])) {
                if (! isset($data['start_time'], $data['end_time'])) {
                    throw ValidationException::withMessages(['start_time' => ['Both start_time and end_time are required when rescheduling.']]);
                }
                $range = $this->appointmentTime->parseRange($data['start_time'], $data['end_time'], $timezone);
            } else {
                $range = ['start_time' => $appointment->start_time, 'end_time' => $appointment->end_time];
                if (isset($data['timezone'])) {
                    if (! in_array($timezone, \DateTimeZone::listIdentifiers(\DateTimeZone::ALL_WITH_BC), true)) {
                        throw ValidationException::withMessages(['timezone' => ['A valid IANA timezone is required.']]);
                    }
                    $local = $appointment->start_time->setTimezone(new \DateTimeZone($timezone));
                    $this->appointmentTime->parse($local->format('Y-m-d\TH:i:sP'), $timezone, 'start_time');
                }
            }

            if (isset($data['status'])) {
                $target = AppointmentStatus::from($data['status']);
                $allowed = ($appointment->status === AppointmentStatus::Scheduled && in_array($target, [AppointmentStatus::Confirmed, AppointmentStatus::Completed], true))
                    || ($appointment->status === AppointmentStatus::Confirmed && $target === AppointmentStatus::Completed);
                if (! $allowed || ($target === AppointmentStatus::Completed && $appointment->end_time->isFuture())) {
                    throw ValidationException::withMessages(['status' => ['The requested appointment status transition is not allowed.']]);
                }
                $appointment->status = $target;
            }

            $appointment->fill(array_intersect_key($data, array_flip(['title', 'description', 'location_type', 'meeting_link', 'location_address'])));
            $appointment->timezone = $timezone;
            $appointment->start_time = $range['start_time'];
            $appointment->end_time = $range['end_time'];
            $appointment->save();

            $conflicts = $this->conflicts->detect($userIds, $range['start_time'], $range['end_time'], $actor, $appointment->id);

            return ['appointment' => $appointment->load(['organizer', 'project', 'team', 'participantRecords.user']), 'conflicts' => $conflicts];
        });
    }
}
