<?php

namespace App\Services\Habit;

use App\Enums\HabitLogStatus;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\User;
use App\Policies\HabitPolicy;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
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

        if (isset($filters['search'])) {
            $search = '%'.$filters['search'].'%';
            $query->where(fn ($query) => $query->whereLike('title', $search)->orWhereLike('description', $search));
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
     * @param  list<Habit>  $habits  A page already scoped to the user.
     * @return array<int, list<array{date: string, is_scheduled: bool, can_check_in: bool, log: HabitLog|null}>>
     */
    public function week(User $user, array $habits, string $start): array
    {
        $timezone = $user->timezone ?: 'UTC';
        $first = Carbon::parse($start, $timezone)->startOfDay();
        $today = Carbon::today($timezone);
        $earliestEditable = $today->copy()->subDays(30);
        $logs = HabitLog::query()
            ->where('user_id', $user->id)
            ->whereIn('habit_id', array_map(fn (Habit $habit): int => $habit->id, $habits))
            ->where('logged_date', '>=', $first->toDateString())
            ->where('logged_date', '<', $first->copy()->addWeek()->toDateString())
            ->get()
            ->groupBy('habit_id')
            ->map(fn ($habitLogs) => $habitLogs->keyBy(fn (HabitLog $log): string => $log->logged_date->toDateString()));

        $week = [];
        foreach ($habits as $habit) {
            $created = $habit->created_at?->copy()->setTimezone($timezone)->startOfDay() ?? $today;
            for ($offset = 0; $offset < 7; $offset++) {
                $date = $first->copy()->addDays($offset);
                $key = $date->toDateString();
                $scheduled = $date->gte($created) && $this->streakService->isScheduledOn($habit, $date);
                $week[$habit->id][] = [
                    'date' => $key,
                    'is_scheduled' => $scheduled,
                    'can_check_in' => $scheduled && ! $habit->is_archived && $date->betweenIncluded($earliestEditable, $today),
                    'log' => $logs->get($habit->id)?->get($key),
                ];
            }
        }

        return $week;
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
     * @return array{from: string, through: string, days: list<array{date: string, completed: int}>}
     */
    public function activity(User $user): array
    {
        throw_unless($this->policy->viewAny($user), AuthorizationException::class);

        $today = Carbon::now($user->timezone ?: 'UTC');
        $through = $today->toDateString();
        $until = $today->copy()->addDay()->toDateString();
        $from = $today->subDays(364)->toDateString();

        $days = HabitLog::query()
            ->where('user_id', $user->id)
            ->whereHas('habit', fn ($query) => $query->where('user_id', $user->id))
            ->where('status', HabitLogStatus::Completed->value)
            ->where('logged_date', '>=', $from)
            ->where('logged_date', '<', $until)
            ->selectRaw('DATE(logged_date) as activity_date, COUNT(*) as completed')
            ->groupByRaw('DATE(logged_date)')
            ->orderBy('activity_date')
            ->get()
            ->map(fn (HabitLog $log): array => [
                'date' => $log->activity_date,
                'completed' => (int) $log->completed,
            ])
            ->all();

        return ['from' => $from, 'through' => $through, 'days' => $days];
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
