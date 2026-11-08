<?php

namespace App\Actions\Habits;

use App\Models\Habit;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateHabitAction
{
    /**
     * Create a new personal habit.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(User $user, array $data): Habit
    {
        return DB::transaction(function () use ($user, $data): Habit {
            return Habit::query()->create([
                'uuid' => (string) Str::uuid(),
                'user_id' => $user->id,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'frequency' => $data['frequency'],
                'target_days' => $data['target_days'] ?? null,
                'color' => $data['color'] ?? '#3B82F6',
                'is_archived' => false,
            ]);
        });
    }
}
