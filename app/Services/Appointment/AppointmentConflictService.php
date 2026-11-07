<?php

namespace App\Services\Appointment;

use App\Enums\AppointmentStatus;
use App\Enums\ParticipantStatus;
use App\Models\Appointment;
use App\Models\User;
use App\Policies\AppointmentPolicy;
use DateTimeInterface;
use Illuminate\Support\Collection;

class AppointmentConflictService
{
    public function __construct(private readonly AppointmentPolicy $policy) {}

    /**
     * Return warnings for candidate attendees without rejecting the appointment.
     *
     * @param  array<int, int>  $candidateUserIds
     * @return array{has_conflicts: bool, items: array<int, array<string, mixed>>}
     */
    public function detect(array $candidateUserIds, DateTimeInterface $start, DateTimeInterface $end, User $viewer, ?int $excludeAppointmentId = null): array
    {
        $userIds = array_values(array_unique(array_map('intval', $candidateUserIds)));

        if ($userIds === []) {
            return ['has_conflicts' => false, 'items' => []];
        }

        $query = Appointment::query()
            ->whereIn('status', [AppointmentStatus::Scheduled->value, AppointmentStatus::Confirmed->value])
            ->where('start_time', '<', $end)
            ->where('end_time', '>', $start)
            ->where(function ($attendees) use ($userIds): void {
                $attendees->whereIn('organizer_id', $userIds)
                    ->orWhereHas('participantRecords', function ($participants) use ($userIds): void {
                        $participants->whereIn('user_id', $userIds)
                            ->whereNull('removed_at')
                            ->whereIn('status', [ParticipantStatus::Accepted->value, ParticipantStatus::Tentative->value]);
                    });
            })
            ->with(['project', 'team', 'participantRecords' => fn ($q) => $q->whereNull('removed_at'), 'organizer']);

        if ($excludeAppointmentId !== null) {
            $query->whereKeyNot($excludeAppointmentId);
        }

        /** @var Collection<int, Appointment> $appointments */
        $appointments = $query->get();
        $items = [];

        foreach ($appointments as $appointment) {
            $matched = [];
            if (in_array((int) $appointment->organizer_id, $userIds, true)) {
                $matched[] = ['user_id' => (int) $appointment->organizer_id, 'reason' => 'organizer_overlap'];
            }
            foreach ($appointment->participantRecords as $participant) {
                if (in_array((int) $participant->user_id, $userIds, true)
                    && in_array($participant->status->value, [ParticipantStatus::Accepted->value, ParticipantStatus::Tentative->value], true)) {
                    $matched[] = ['user_id' => (int) $participant->user_id, 'reason' => 'participant_overlap'];
                }
            }

            foreach ($matched as $match) {
                $item = ['user_id' => $match['user_id'], 'reason' => $match['reason']];
                if ($this->policy->view($viewer, $appointment)) {
                    $item += [
                        'appointment_uuid' => $appointment->uuid,
                        'title' => $appointment->title,
                        'start_time' => $appointment->start_time?->utc()->format('Y-m-d\TH:i:s\Z'),
                        'end_time' => $appointment->end_time?->utc()->format('Y-m-d\TH:i:s\Z'),
                    ];
                }
                $items[] = $item;
            }
        }

        return ['has_conflicts' => $items !== [], 'items' => $items];
    }
}
