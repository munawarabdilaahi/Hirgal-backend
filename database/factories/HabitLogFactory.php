<?php

namespace Database\Factories;

use App\Enums\HabitLogStatus;
use App\Models\Habit;
use App\Models\HabitLog;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HabitLog>
 */
class HabitLogFactory extends Factory
{
    protected $model = HabitLog::class;

    public function definition(): array
    {
        return [
            'habit_id' => Habit::factory(),
            'user_id' => function (array $attributes) {
                return Habit::find($attributes['habit_id'])->user_id;
            },
            'logged_date' => fake()->unique()->date(),
            'status' => HabitLogStatus::Completed,
            'notes' => fake()->sentence(),
        ];
    }
}
