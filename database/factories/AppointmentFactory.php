<?php

namespace Database\Factories;

use App\Enums\AppointmentLocationType;
use App\Enums\AppointmentStatus;
use App\Enums\ParticipantStatus;
use App\Models\Appointment;
use App\Models\AppointmentParticipant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Appointment>
 */
class AppointmentFactory extends Factory
{
    protected $model = Appointment::class;

    public function definition(): array
    {
        $start = now()->addDays(rand(1, 14))->setHour(10)->setMinute(0)->setSecond(0);
        $end = (clone $start)->addHour();

        return [
            'uuid' => (string) Str::uuid(),
            'organizer_id' => User::factory(),
            'project_id' => null,
            'team_id' => null,
            'title' => fake()->sentence(3).' Sync',
            'description' => fake()->paragraph(),
            'timezone' => 'UTC',
            'start_time' => $start,
            'end_time' => $end,
            'location_type' => AppointmentLocationType::Virtual,
            'meeting_link' => 'https://meet.google.com/'.Str::lower(Str::random(3)).'-'.Str::lower(Str::random(4)).'-'.Str::lower(Str::random(3)),
            'location_address' => null,
            'status' => AppointmentStatus::Scheduled,
        ];
    }

    public function withParticipants(int $count = 2): static
    {
        return $this->afterCreating(function (Appointment $appointment) use ($count): void {
            User::factory()->count($count)->create()->each(function (User $user) use ($appointment): void {
                AppointmentParticipant::create([
                    'appointment_id' => $appointment->id,
                    'user_id' => $user->id,
                    'status' => ParticipantStatus::Pending,
                    'response_notes' => null,
                    'responded_at' => null,
                ]);
            });
        });
    }
}
