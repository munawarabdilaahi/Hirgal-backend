<?php

namespace Database\Factories;

use App\Enums\HabitFrequency;
use App\Enums\HabitLogStatus;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Habit>
 */
class HabitFactory extends Factory
{
    protected $model = Habit::class;

    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'user_id' => User::factory(),
            'title' => fake()->randomElement(['Daily Standup', 'Code Review', 'Documentation', 'Exercise', 'Reading']),
            'description' => fake()->sentence(),
            'frequency' => HabitFrequency::Daily,
            'target_days' => ['mon', 'tue', 'wed', 'thu', 'fri'],
            'color' => fake()->hexColor(),
            'is_archived' => false,
        ];
    }

    public function withLogs(int $days = 5): static
    {
        return $this->afterCreating(function (Habit $habit) use ($days): void {
            for ($i = 0; $i < $days; $i++) {
                HabitLog::create([
                    'habit_id' => $habit->id,
                    'user_id' => $habit->user_id,
                    'logged_date' => now()->subDays($i)->toDateString(),
                    'status' => HabitLogStatus::Completed,
                    'notes' => fake()->sentence(),
                ]);
            }
        });
    }
}
