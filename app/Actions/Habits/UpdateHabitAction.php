<?php

namespace App\Actions\Habits;

use App\Models\Habit;
use Illuminate\Support\Facades\DB;

class UpdateHabitAction
{
    /**
     * Update an existing personal habit.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(Habit $habit, array $data): Habit
    {
        return DB::transaction(function () use ($habit, $data): Habit {
            $habit->fill(array_intersect_key($data, array_flip([
                'title',
                'description',
                'frequency',
                'target_days',
                'color',
            ])));

            $habit->save();

            return $habit->fresh();
        });
    }
}
