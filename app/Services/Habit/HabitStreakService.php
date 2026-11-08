<?php

namespace App\Services\Habit;

use App\Enums\HabitFrequency;
use App\Enums\HabitLogStatus;
use App\Models\Habit;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class HabitStreakService
{
    /**
     * Determine whether the habit is scheduled for the given calendar date.
     */
    public function isScheduledOn(Habit $habit, CarbonInterface $date): bool
    {
        if ($habit->frequency === HabitFrequency::Daily) {
            return true;
        }

        $targetDays = array_map('strtolower', (array) ($habit->target_days ?? []));

        if ($targetDays === []) {
            return true;
        }

        $dayOfWeek = strtolower($date->format('D')); // 'mon', 'tue', etc.

        return in_array($dayOfWeek, $targetDays, true);
    }

    /**
     * Calculate comprehensive streak and completion metrics for a habit.
     *
     * @return array{
     *     current_streak: int,
     *     longest_streak: int,
     *     total_completed: int,
     *     total_skipped: int,
     *     total_failed: int,
     *     completion_rate: float
     * }
     */
    public function calculateStats(Habit $habit, ?CarbonInterface $asOfDate = null, ?string $timezone = null): array
    {
        $tz = $timezone ?: 'UTC';
        $today = ($asOfDate ? $asOfDate->copy() : Carbon::now($tz))->setTimezone($tz)->startOfDay();

        // Canonical history start (Product Owner ruling): a habit's valid
        // tracking history begins on its creation date. Legacy pre-creation
        // records are preserved in storage but excluded from all statistics.
        $historyStart = Carbon::parse($habit->created_at ?? now())->setTimezone($tz)->startOfDay();

        /** @var Collection<string, mixed> $logsByDate */
        $logs = $habit->logs()
            ->whereDate('logged_date', '>=', $historyStart->format('Y-m-d'))
            ->get();
        $logsByDate = $logs->keyBy(fn ($log): string => Carbon::parse($log->logged_date)->format('Y-m-d'));

        $totalCompleted = $logs->where('status', HabitLogStatus::Completed)->count();
        $totalSkipped = $logs->where('status', HabitLogStatus::Skipped)->count();
        $totalFailed = $logs->where('status', HabitLogStatus::Failed)->count();

        $currentStreak = $this->calculateCurrentStreak($habit, $today, $logsByDate, $tz);
        $longestStreak = $this->calculateLongestStreak($habit, $today, $logsByDate, $currentStreak, $tz);
        $completionRate = $this->calculateCompletionRate($habit, $today, $totalCompleted);

        return [
            'current_streak' => $currentStreak,
            'longest_streak' => $longestStreak,
            'total_completed' => $totalCompleted,
            'total_skipped' => $totalSkipped,
            'total_failed' => $totalFailed,
            'completion_rate' => $completionRate,
        ];
    }

    /**
     * Compute the current active streak walking backward from the evaluation date.
     *
     * Approved Decision 5: skipped days freeze the streak; failed or missed
     * scheduled days break it. The evaluation date itself only receives a grace
     * period while it is still in progress (today or later) — a scheduled day in
     * the past without a log is missed and breaks the streak.
     *
     * @param  Collection<string, mixed>  $logsByDate
     */
    private function calculateCurrentStreak(Habit $habit, CarbonInterface $today, Collection $logsByDate, string $timezone): int
    {
        $currentStreak = 0;
        $cursor = $today->copy();
        $todayKey = $today->format('Y-m-d');
        $todayLog = $logsByDate->get($todayKey);
        $actualToday = Carbon::now($timezone)->startOfDay();
        $isInProgressDay = $today->greaterThanOrEqualTo($actualToday);

        if ($this->isScheduledOn($habit, $today)) {
            if ($todayLog !== null) {
                if ($todayLog->status === HabitLogStatus::Completed) {
                    $currentStreak++;
                    $cursor = $cursor->subDay();
                } elseif ($todayLog->status === HabitLogStatus::Skipped) {
                    // Skipped freezes streak; step back to evaluate prior days
                    $cursor = $cursor->subDay();
                } else {
                    // Failed explicitly breaks the streak today
                    return 0;
                }
            } elseif ($isInProgressDay) {
                // The in-progress day is not logged yet; the streak from prior days remains alive
                $cursor = $cursor->subDay();
            } else {
                // A past scheduled day without a log is missed and breaks the streak
                return 0;
            }
        } else {
            // Today is not a scheduled day; check backward
            $cursor = $cursor->subDay();
        }

        $habitStartDate = Carbon::parse($habit->created_at ?? now())->setTimezone($today->timezone)->startOfDay();
        $maxLookbackDays = 1000;
        $iterations = 0;

        while ($cursor->greaterThanOrEqualTo($habitStartDate) && $iterations < $maxLookbackDays) {
            $iterations++;

            if ($this->isScheduledOn($habit, $cursor)) {
                $dateKey = $cursor->format('Y-m-d');
                $log = $logsByDate->get($dateKey);

                if ($log !== null) {
                    if ($log->status === HabitLogStatus::Completed) {
                        $currentStreak++;
                    } elseif ($log->status === HabitLogStatus::Skipped) {
                        // Freezes streak, continue backward
                    } else {
                        // Failed breaks the streak
                        break;
                    }
                } else {
                    // Missed scheduled day breaks the streak
                    break;
                }
            }

            $cursor = $cursor->subDay();
        }

        return $currentStreak;
    }

    /**
     * Compute the historical longest streak walking chronologically forward.
     *
     * @param  Collection<string, mixed>  $logsByDate
     */
    private function calculateLongestStreak(Habit $habit, CarbonInterface $today, Collection $logsByDate, int $currentStreak, string $timezone): int
    {
        $habitStartDate = Carbon::parse($habit->created_at ?? now())->setTimezone($today->timezone)->startOfDay();
        $actualToday = Carbon::now($timezone)->startOfDay();
        $isInProgressDay = $today->greaterThanOrEqualTo($actualToday);

        $cursor = $habitStartDate->copy();
        $runningStreak = 0;
        $longestStreak = 0;

        while ($cursor->lessThanOrEqualTo($today)) {
            if ($this->isScheduledOn($habit, $cursor)) {
                $dateKey = $cursor->format('Y-m-d');
                $log = $logsByDate->get($dateKey);

                if ($log !== null) {
                    if ($log->status === HabitLogStatus::Completed) {
                        $runningStreak++;
                        if ($runningStreak > $longestStreak) {
                            $longestStreak = $runningStreak;
                        }
                    } elseif ($log->status === HabitLogStatus::Skipped) {
                        // Frozen; runningStreak continues unchanged
                    } else {
                        $runningStreak = 0;
                    }
                } else {
                    if (! ($cursor->eq($today) && $isInProgressDay)) {
                        $runningStreak = 0;
                    }
                }
            }

            $cursor = $cursor->addDay();
        }

        return max($longestStreak, $currentStreak);
    }

    /**
     * Calculate completion percentage.
     */
    private function calculateCompletionRate(Habit $habit, CarbonInterface $today, int $totalCompleted): float
    {
        $habitStartDate = Carbon::parse($habit->created_at ?? now())->setTimezone($today->timezone)->startOfDay();
        $cursor = $habitStartDate->copy();
        $scheduledDays = 0;

        while ($cursor->lessThanOrEqualTo($today)) {
            if ($this->isScheduledOn($habit, $cursor)) {
                $scheduledDays++;
            }
            $cursor = $cursor->addDay();
        }

        if ($scheduledDays === 0) {
            return 0.0;
        }

        return round(min(100.0, ($totalCompleted / $scheduledDays) * 100), 1);
    }
}
