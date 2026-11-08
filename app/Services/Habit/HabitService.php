<?php

namespace App\Services\Habit;

use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\User;
use App\Policies\HabitPolicy;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class HabitService
{
    public function __construct(
        protected HabitPolicy $policy,
        protected HabitStreakService $streakService,
    ) {}

    /**
     * List user habits with optional status and frequency filters.
     *
     * @param  array<string, mixed>  $filters
     */
    public function list(User $user, array $filters = []): LengthAwarePaginator
    {
        abort_unless($this->policy->viewAny($user), 403);

        $query = Habit::query()->where('user_id', $user->id);

        if (isset($filters['is_archived'])) {
            $isArchived = filter_var($filters['is_archived'], FILTER_VALIDATE_BOOLEAN);
            $query->where('is_archived', $isArchived);
        } else {
            // Default to non-archived habits
            $query->where('is_archived', false);
        }

        if (isset($filters['frequency'])) {
            $query->where('frequency', $filters['frequency']);
        }

        $paginator = $query->orderBy('created_at', 'desc')->orderBy('id', 'desc')->paginate((int) ($filters['per_page'] ?? 15));

        $habitIds = collect($paginator->items())->pluck('id');
        $recentLogs = HabitLog::query()
            ->whereIn('habit_id', $habitIds)
            ->orderByDesc('logged_date')
            ->get()
            ->groupBy('habit_id');

        foreach ($paginator->items() as $habit) {
            $habit->setRelation(
                'logs',
                $recentLogs->get($habit->id, collect())->take(30)->values()
            );
        }

        return $paginator;
    }

    /**
     * Resolve a habit by UUID ensuring user ownership and policy compliance.
     */
    public function resolveHabit(User $user, string $uuid): Habit
    {
        /** @var Habit $habit */
        $habit = Habit::query()
            ->where('uuid', $uuid)
            ->where('user_id', $user->id)
            ->firstOrFail();

        abort_unless($this->policy->view($user, $habit), 404);

        return $habit;
    }

    /**
     * Provide a daily check-in matrix for all active habits of the user.
     *
     * @return array{
     *     date: string,
     *     timezone: string,
     *     habits: array<int, array<string, mixed>>
     * }
     */
    public function dailyOverview(User $user, ?string $date = null): array
    {
        abort_unless($this->policy->viewAny($user), 403);

        $tz = $user->timezone ?: 'UTC';
        $targetDate = $date
            ? Carbon::parse($date, $tz)->startOfDay()
            : Carbon::now($tz)->startOfDay();
        $dateStr = $targetDate->format('Y-m-d');

        $habits = Habit::query()
            ->where('user_id', $user->id)
            ->where('is_archived', false)
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $logs = HabitLog::query()
            ->where('user_id', $user->id)
            ->whereDate('logged_date', $dateStr)
            ->get()
            ->keyBy('habit_id');

        $items = [];
        foreach ($habits as $habit) {
            $log = $logs->get($habit->id);
            $stats = $this->streakService->calculateStats($habit, $targetDate, $tz);

            $items[] = [
                'habit' => $habit,
                'is_scheduled' => $this->streakService->isScheduledOn($habit, $targetDate),
                'log' => $log,
                'current_streak' => $stats['current_streak'],
                'longest_streak' => $stats['longest_streak'],
            ];
        }

        return [
            'date' => $dateStr,
            'timezone' => $tz,
            'habits' => $items,
        ];
    }

    /**
     * Archive a habit.
     */
    public function archive(User $user, Habit $habit): Habit
    {
        abort_unless($this->policy->update($user, $habit), 404);

        $habit->update(['is_archived' => true]);

        return $habit->fresh();
    }

    /**
     * Restore an archived habit.
     */
    public function restore(User $user, Habit $habit): Habit
    {
        abort_unless($this->policy->update($user, $habit), 404);

        $habit->update(['is_archived' => false]);

        return $habit->fresh();
    }

    /**
     * Soft-delete a habit.
     */
    public function delete(User $user, Habit $habit): void
    {
        abort_unless($this->policy->delete($user, $habit), 404);

        DB::transaction(function () use ($habit): void {
            $habit->delete();
        });
    }
}
