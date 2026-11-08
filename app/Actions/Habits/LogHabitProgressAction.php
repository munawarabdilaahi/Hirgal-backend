<?php

namespace App\Actions\Habits;

use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LogHabitProgressAction
{
    /**
     * Record or update daily check-in log for a habit.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(User $user, Habit $habit, array $data): HabitLog
    {
        return DB::transaction(function () use ($user, $habit, $data): HabitLog {
            $tz = $user->timezone ?: 'UTC';
            $today = Carbon::now($tz)->startOfDay();
            $loggedDate = Carbon::parse($data['logged_date'], $tz)->startOfDay();

            // Validate that logged date is not in the future relative to user timezone
            if ($loggedDate->greaterThan($today)) {
                throw ValidationException::withMessages([
                    'logged_date' => ['Cannot record habit check-in for a future date.'],
                ]);
            }

            // Approved Decision 6: Backdated logging allowed within the previous 30 days
            $minAllowedDate = $today->copy()->subDays(30);
            if ($loggedDate->lessThan($minAllowedDate)) {
                throw ValidationException::withMessages([
                    'logged_date' => ['Cannot record habit check-in older than 30 days.'],
                ]);
            }

            // Canonical history start: logging before the habit was created is rejected.
            $historyStart = Carbon::parse($habit->created_at ?? now())->setTimezone($tz)->startOfDay();
            if ($loggedDate->lessThan($historyStart)) {
                throw ValidationException::withMessages([
                    'logged_date' => ['Cannot record habit check-in before the habit was created.'],
                ]);
            }

            // Upsert: One log per habit per calendar date, preserving composite (habit_id, user_id)
            $log = HabitLog::query()
                ->where('habit_id', $habit->id)
                ->whereDate('logged_date', $loggedDate->format('Y-m-d'))
                ->first();

            if ($log !== null) {
                $log->update([
                    'status' => $data['status'],
                    'notes' => $data['notes'] ?? null,
                ]);

                return $log->fresh();
            }

            /** @var HabitLog $log */
            $log = HabitLog::query()->create([
                'habit_id' => $habit->id,
                'user_id' => $user->id,
                'logged_date' => $loggedDate->format('Y-m-d'),
                'status' => $data['status'],
                'notes' => $data['notes'] ?? null,
            ]);

            return $log->fresh();
        });
    }
}
