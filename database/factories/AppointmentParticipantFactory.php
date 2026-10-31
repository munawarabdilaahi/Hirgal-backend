<?php

namespace Database\Factories;

use App\Enums\ParticipantStatus;
use App\Models\Appointment;
use App\Models\AppointmentParticipant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AppointmentParticipant>
 */
class AppointmentParticipantFactory extends Factory
{
    protected $model = AppointmentParticipant::class;

    public function definition(): array
    {
        return [
            'appointment_id' => Appointment::factory(),
            'user_id' => User::factory(),
            'status' => ParticipantStatus::Pending,
            'response_notes' => null,
            'responded_at' => null,
        ];
    }
}
