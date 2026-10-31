<?php

namespace Database\Factories;

use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActivityLog>
 */
class ActivityLogFactory extends Factory
{
    protected $model = ActivityLog::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'action' => fake()->randomElement(['project.created', 'task.status_changed', 'member.added', 'appointment.booked']),
            'subject_type' => Project::class,
            'subject_id' => Project::factory(),
            'description' => fake()->sentence(),
            'properties' => [
                'ip' => fake()->ipv4(),
                'browser' => 'Chrome',
            ],
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'created_at' => now(),
        ];
    }
}
