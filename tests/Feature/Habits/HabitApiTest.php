<?php

namespace Tests\Feature\Habits;

use App\Actions\Habits\LogHabitProgressAction;
use App\Enums\HabitFrequency;
use App\Enums\HabitLogStatus;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class HabitApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-11-08 12:00:00', 'UTC'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_authenticated_user_can_create_daily_and_custom_weekday_habits(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $this->actingAs($user, 'sanctum');

        $dailyResponse = $this->postJson('/api/v1/habits', [
            'title' => 'Morning Meditation',
            'description' => '10 minutes mindfulness',
            'frequency' => 'daily',
            'color' => '#10B981',
        ]);

        $dailyResponse->assertCreated()
            ->assertJsonPath('data.title', 'Morning Meditation')
            ->assertJsonPath('data.frequency', 'daily')
            ->assertJsonPath('data.color', '#10B981');

        $this->assertDatabaseHas('habits', [
            'user_id' => $user->id,
            'title' => 'Morning Meditation',
            'frequency' => 'daily',
        ]);

        $customResponse = $this->postJson('/api/v1/habits', [
            'title' => 'Gym Workout',
            'frequency' => 'custom',
            'target_days' => ['mon', 'wed', 'fri'],
            'color' => '#3B82F6',
        ]);

        $customResponse->assertCreated()
            ->assertJsonPath('data.title', 'Gym Workout')
            ->assertJsonPath('data.frequency', 'custom')
            ->assertJsonPath('data.target_days', ['mon', 'wed', 'fri']);
    }

    public function test_habit_creation_validation_rejects_invalid_frequency_or_invalid_custom_target_days(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $this->actingAs($user, 'sanctum');

        // Custom frequency requires target_days
        $this->postJson('/api/v1/habits', [
            'title' => 'Invalid Habit',
            'frequency' => 'custom',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('target_days');

        // Target days with invalid weekday
        $this->postJson('/api/v1/habits', [
            'title' => 'Invalid Weekday',
            'frequency' => 'custom',
            'target_days' => ['mon', 'funday'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('target_days.1');

        // Invalid frequency enum
        $this->postJson('/api/v1/habits', [
            'title' => 'Bad Frequency',
            'frequency' => 'hourly',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('frequency');
    }

    public function test_weekly_frequency_is_rejected_by_api_and_filters(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $this->actingAs($user, 'sanctum');

        // Approved Decision 4: only daily and custom weekday schedules exist
        $this->postJson('/api/v1/habits', [
            'title' => 'Weekly Habit',
            'frequency' => 'weekly',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('frequency');

        $this->getJson('/api/v1/habits?frequency=weekly')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('frequency');
    }

    public function test_user_can_list_habits_and_cannot_see_other_users_habits(): void
    {
        $userA = $this->userWithPermissions(['habits.manage']);
        $userB = $this->userWithPermissions(['habits.manage']);

        Habit::factory()->create(['user_id' => $userA->id, 'title' => 'User A Habit']);
        Habit::factory()->create(['user_id' => $userB->id, 'title' => 'User B Secret Habit']);

        $this->actingAs($userA, 'sanctum');

        $response = $this->getJson('/api/v1/habits');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'User A Habit')
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
    }

    public function test_user_can_view_single_habit_and_cross_user_access_returns_404(): void
    {
        $userA = $this->userWithPermissions(['habits.manage']);
        $userB = $this->userWithPermissions(['habits.manage']);

        $habitB = Habit::factory()->create(['user_id' => $userB->id, 'title' => 'User B Habit']);

        $this->actingAs($userA, 'sanctum');

        // IDOR protection: returns 404
        $this->getJson('/api/v1/habits/'.$habitB->uuid)
            ->assertNotFound();

        // System Admin also cannot access via standard route (Strict Personal Privacy)
        $admin = $this->userWithPermissions(['habits.manage'], 'system-admin');
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/habits/'.$habitB->uuid)
            ->assertNotFound();
    }

    public function test_user_can_update_archive_and_restore_habit(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create(['user_id' => $user->id, 'title' => 'Old Title']);

        $this->actingAs($user, 'sanctum');

        // Update
        $this->putJson('/api/v1/habits/'.$habit->uuid, [
            'title' => 'Updated Title',
            'color' => '#EF4444',
        ])->assertOk()
            ->assertJsonPath('data.title', 'Updated Title')
            ->assertJsonPath('data.color', '#EF4444');

        // Archive
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/archive')
            ->assertOk()
            ->assertJsonPath('data.is_archived', true);

        $this->assertDatabaseHas('habits', ['id' => $habit->id, 'is_archived' => 1]);

        // Restore
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/restore')
            ->assertOk()
            ->assertJsonPath('data.is_archived', false);

        $this->assertDatabaseHas('habits', ['id' => $habit->id, 'is_archived' => 0]);
    }

    public function test_user_can_soft_delete_habit(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user, 'sanctum');

        $this->deleteJson('/api/v1/habits/'.$habit->uuid)->assertOk();

        $this->assertSoftDeleted('habits', ['id' => $habit->id]);

        $this->getJson('/api/v1/habits/'.$habit->uuid)->assertNotFound();
    }

    public function test_update_to_custom_frequency_requires_target_days(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $dailyHabit = Habit::factory()->create([
            'user_id' => $user->id,
            'frequency' => HabitFrequency::Daily,
            'target_days' => null,
        ]);
        $customHabit = Habit::factory()->create([
            'user_id' => $user->id,
            'frequency' => HabitFrequency::Custom,
            'target_days' => ['mon', 'tue', 'wed', 'thu', 'fri'],
        ]);

        $this->actingAs($user, 'sanctum');

        // Switching a habit without weekdays to custom without target_days is rejected
        $this->putJson('/api/v1/habits/'.$dailyHabit->uuid, [
            'frequency' => 'custom',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('target_days');

        // Explicitly clearing target_days on an existing custom habit is rejected
        $this->putJson('/api/v1/habits/'.$customHabit->uuid, [
            'target_days' => null,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('target_days');

        // Valid custom update succeeds
        $this->putJson('/api/v1/habits/'.$customHabit->uuid, [
            'frequency' => 'custom',
            'target_days' => ['mon', 'wed'],
        ])->assertOk()
            ->assertJsonPath('data.frequency', 'custom')
            ->assertJsonPath('data.target_days', ['mon', 'wed']);
    }

    public function test_daily_checkin_upsert_on_same_date(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create(['user_id' => $user->id]);
        $date = Carbon::now($user->timezone)->format('Y-m-d');

        $this->actingAs($user, 'sanctum');

        // Initial check-in
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/logs', [
            'logged_date' => $date,
            'status' => 'completed',
            'notes' => 'Felt great',
        ])->assertOk()
            ->assertJsonPath('data.log.status', 'completed')
            ->assertJsonPath('data.log.notes', 'Felt great');

        $this->assertDatabaseCount('habit_logs', 1);

        // Upsert on same date updates status and notes instead of duplicate row
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/logs', [
            'logged_date' => $date,
            'status' => 'skipped',
            'notes' => 'Updated: took a rest instead',
        ])->assertOk()
            ->assertJsonPath('data.log.status', 'skipped')
            ->assertJsonPath('data.log.notes', 'Updated: took a rest instead');

        $this->assertDatabaseCount('habit_logs', 1);
    }

    public function test_backdated_logging_allowed_within_30_days_and_future_or_older_dates_rejected(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        // Habit predates the full editing window so every window boundary below
        // also satisfies the canonical history start (creation date).
        $habit = Habit::factory()->create([
            'user_id' => $user->id,
            'created_at' => now()->subDays(40),
        ]);
        $tz = $user->timezone ?: 'UTC';
        $today = Carbon::now($tz);

        $this->actingAs($user, 'sanctum');

        // Backdated 5 days ago: ALLOWED (Decision 6)
        $past5Days = $today->copy()->subDays(5)->format('Y-m-d');
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/logs', [
            'logged_date' => $past5Days,
            'status' => 'completed',
        ])->assertOk();

        // Exactly 30 days ago: ALLOWED (window is inclusive)
        $past30Days = $today->copy()->subDays(30)->format('Y-m-d');
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/logs', [
            'logged_date' => $past30Days,
            'status' => 'completed',
        ])->assertOk();

        // Future date: REJECTED
        $tomorrow = $today->copy()->addDay()->format('Y-m-d');
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/logs', [
            'logged_date' => $tomorrow,
            'status' => 'completed',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('logged_date');

        // Older than 30 days: REJECTED
        $past35Days = $today->copy()->subDays(35)->format('Y-m-d');
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/logs', [
            'logged_date' => $past35Days,
            'status' => 'completed',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('logged_date');

        $this->assertDatabaseCount('habit_logs', 2);
    }

    public function test_precreation_logging_is_rejected_at_the_api_layer(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create([
            'user_id' => $user->id,
            'created_at' => Carbon::parse('2026-11-01 00:00:00'),
        ]);

        $this->actingAs($user, 'sanctum');

        // Oct 30 is inside the 30-day editing window but before the habit's
        // creation date, so the canonical history boundary rejects it.
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/logs', [
            'logged_date' => '2026-10-30',
            'status' => 'completed',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('logged_date')
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        // The creation date itself is the first valid history day.
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/logs', [
            'logged_date' => '2026-11-01',
            'status' => 'completed',
        ])->assertOk();

        $this->assertDatabaseCount('habit_logs', 1);
    }

    public function test_log_action_rejects_precreation_dates_independently_of_http_validation(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create([
            'user_id' => $user->id,
            'created_at' => Carbon::parse('2026-11-01 00:00:00'),
        ]);

        $action = app(LogHabitProgressAction::class);

        try {
            $action->execute($user, $habit, [
                'logged_date' => '2026-10-30',
                'status' => HabitLogStatus::Completed->value,
            ]);
            $this->fail('Expected ValidationException for a pre-creation log date.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('logged_date', $exception->errors());
        }

        // The service layer never persists a pre-creation record.
        $this->assertDatabaseCount('habit_logs', 0);
    }

    public function test_habit_log_window_uses_user_profile_timezone(): void
    {
        $user = $this->userWithPermissions(['habits.manage'], 'habit-test-role', ['timezone' => 'Pacific/Auckland']);
        // Created 10 days ago so the window boundary checks below are not
        // superseded by the creation-date history boundary.
        $habit = Habit::factory()->create([
            'user_id' => $user->id,
            'created_at' => now()->subDays(10),
        ]);

        // Frozen now is 2026-11-08 12:00 UTC, which is 2026-11-09 01:00 in Auckland (UTC+13)
        $this->actingAs($user, 'sanctum');

        // Local "today" (Nov 9) is allowed even though it is still Nov 8 in UTC
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/logs', [
            'logged_date' => '2026-11-09',
            'status' => 'completed',
        ])->assertOk();

        // Local "tomorrow" (Nov 10) is rejected
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/logs', [
            'logged_date' => '2026-11-10',
            'status' => 'completed',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('logged_date');

        // Local yesterday (Nov 7) is within the 30-day window
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/logs', [
            'logged_date' => '2026-11-07',
            'status' => 'completed',
        ])->assertOk();

        $this->assertDatabaseCount('habit_logs', 2);
    }

    public function test_cross_user_log_operations_return_404(): void
    {
        $owner = $this->userWithPermissions(['habits.manage']);
        $attacker = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create(['user_id' => $owner->id]);

        $this->actingAs($attacker, 'sanctum');

        $this->postJson('/api/v1/habits/'.$habit->uuid.'/logs', [
            'logged_date' => Carbon::now()->format('Y-m-d'),
            'status' => 'completed',
        ])->assertNotFound();

        $this->getJson('/api/v1/habits/'.$habit->uuid.'/logs')
            ->assertNotFound();

        $this->deleteJson('/api/v1/habits/'.$habit->uuid.'/logs/'.Carbon::now()->format('Y-m-d'))
            ->assertNotFound();

        $this->assertDatabaseCount('habit_logs', 0);
    }

    public function test_system_admin_cannot_list_or_access_other_users_habits(): void
    {
        $victim = $this->userWithPermissions(['habits.manage']);
        $victimHabit = Habit::factory()->create(['user_id' => $victim->id, 'title' => 'Victim Secret Habit']);

        $admin = $this->userWithPermissions(['habits.manage'], 'system-admin');
        Habit::factory()->create(['user_id' => $admin->id, 'title' => 'Admin Personal Habit']);

        $this->actingAs($admin, 'sanctum');

        // Strict personal privacy: the admin listing only contains their own habits
        $this->getJson('/api/v1/habits')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Admin Personal Habit');

        // Direct access to another user's habit resolves to 404 through standard endpoints
        $this->getJson('/api/v1/habits/'.$victimHabit->uuid)->assertNotFound();

        $this->postJson('/api/v1/habits/'.$victimHabit->uuid.'/logs', [
            'logged_date' => Carbon::now()->format('Y-m-d'),
            'status' => 'completed',
        ])->assertNotFound();

        $this->getJson('/api/v1/habits/'.$victimHabit->uuid.'/logs')->assertNotFound();

        $this->assertDatabaseCount('habit_logs', 0);
    }

    public function test_daily_overview_matrix_returns_all_habits_and_checkin_status(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habit1 = Habit::factory()->create(['user_id' => $user->id, 'title' => 'Read Book', 'frequency' => 'daily']);
        $habit2 = Habit::factory()->create(['user_id' => $user->id, 'title' => 'Run 5km', 'frequency' => 'daily']);

        $date = Carbon::now($user->timezone)->format('Y-m-d');

        // Log habit 1 as completed for today
        HabitLog::create([
            'habit_id' => $habit1->id,
            'user_id' => $user->id,
            'logged_date' => $date,
            'status' => HabitLogStatus::Completed,
        ]);

        $this->actingAs($user, 'sanctum');

        $response = $this->getJson('/api/v1/habits/daily-overview?date='.$date);

        $response->assertOk()
            ->assertJsonPath('data.date', $date)
            ->assertJsonCount(2, 'data.habits');

        $habitsData = $response->json('data.habits');
        $this->assertSame('Read Book', $habitsData[0]['habit']['title']);
        $this->assertSame('completed', $habitsData[0]['log']['status']);
        $this->assertTrue($habitsData[0]['is_scheduled']);

        $this->assertSame('Run 5km', $habitsData[1]['habit']['title']);
        $this->assertNull($habitsData[1]['log']);
    }

    public function test_daily_overview_rejects_invalid_date(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $this->actingAs($user, 'sanctum');

        $this->getJson('/api/v1/habits/daily-overview?date=not-a-date')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date');

        $this->getJson('/api/v1/habits/daily-overview?date=2026-02-30')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date');
    }

    public function test_archived_habits_are_excluded_by_default_and_included_with_filter(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        Habit::factory()->create(['user_id' => $user->id, 'title' => 'Active Habit', 'is_archived' => false]);
        Habit::factory()->create(['user_id' => $user->id, 'title' => 'Archived Habit', 'is_archived' => true]);

        $this->actingAs($user, 'sanctum');

        // Default listing hides archived habits
        $this->getJson('/api/v1/habits')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Active Habit');

        // Explicit filter surfaces archived habits
        $this->getJson('/api/v1/habits?is_archived=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Archived Habit');

        // Daily overview only shows active habits
        $this->getJson('/api/v1/habits/daily-overview')
            ->assertOk()
            ->assertJsonCount(1, 'data.habits')
            ->assertJsonPath('data.habits.0.habit.title', 'Active Habit');
    }

    public function test_habit_list_returns_latest_30_logs_per_habit(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habitA = Habit::factory()->create([
            'user_id' => $user->id,
            'title' => 'Habit Alpha',
            'created_at' => now()->subMinutes(2),
        ]);
        $habitB = Habit::factory()->create([
            'user_id' => $user->id,
            'title' => 'Habit Beta',
            'created_at' => now()->subMinute(),
        ]);

        foreach ([$habitA, $habitB] as $habit) {
            for ($i = 0; $i < 35; $i++) {
                HabitLog::create([
                    'habit_id' => $habit->id,
                    'user_id' => $user->id,
                    'logged_date' => now()->subDays($i)->format('Y-m-d'),
                    'status' => HabitLogStatus::Completed,
                ]);
            }
        }

        $this->actingAs($user, 'sanctum');

        $response = $this->getJson('/api/v1/habits')->assertOk();

        $items = $response->json('data');
        $this->assertCount(2, $items);

        // Newest habit first (created_at desc), each carrying its own 30 most recent logs
        $this->assertSame('Habit Beta', $items[0]['title']);
        $this->assertSame('Habit Alpha', $items[1]['title']);

        foreach ($items as $item) {
            $this->assertCount(30, $item['latest_logs']);
            $this->assertSame('2026-11-08', $item['latest_logs'][0]['logged_date']);
            $this->assertSame(now()->subDays(29)->format('Y-m-d'), $item['latest_logs'][29]['logged_date']);
        }
    }

    public function test_streak_calculation_scheduled_days_vs_rest_days_and_skipped_freeze(): void
    {
        // Test custom weekdays: Mon, Wed, Fri
        $user = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create([
            'user_id' => $user->id,
            'frequency' => HabitFrequency::Custom,
            'target_days' => ['mon', 'wed', 'fri'],
            'created_at' => Carbon::parse('2026-11-01 00:00:00'),
        ]);

        // Logs:
        // Mon 2026-11-02: completed (streak = 1)
        // Tue 2026-11-03: rest day
        // Wed 2026-11-04: completed (streak = 2)
        // Thu 2026-11-05: rest day
        // Fri 2026-11-06: skipped (streak freezes at 2!)
        // Sat 2026-11-07: rest day
        // Sun 2026-11-08: rest day
        HabitLog::create(['habit_id' => $habit->id, 'user_id' => $user->id, 'logged_date' => '2026-11-02', 'status' => HabitLogStatus::Completed]);
        HabitLog::create(['habit_id' => $habit->id, 'user_id' => $user->id, 'logged_date' => '2026-11-04', 'status' => HabitLogStatus::Completed]);
        HabitLog::create(['habit_id' => $habit->id, 'user_id' => $user->id, 'logged_date' => '2026-11-06', 'status' => HabitLogStatus::Skipped]);

        $this->actingAs($user, 'sanctum');

        // Evaluate as of Sun 2026-11-08 (rest day, frozen test clock)
        $response = $this->getJson('/api/v1/habits/'.$habit->uuid);

        $response->assertOk();
        // Since Friday was skipped, streak is frozen at 2 (not reset!)
        $this->assertSame(2, $response->json('data.current_streak'));
        $this->assertSame(2, $response->json('data.longest_streak'));
    }

    public function test_failed_scheduled_day_breaks_streak(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create([
            'user_id' => $user->id,
            'frequency' => HabitFrequency::Daily,
            'created_at' => Carbon::parse('2026-11-01 00:00:00'),
        ]);

        // Nov 5: completed
        // Nov 6: completed
        // Nov 7: failed (breaks streak!)
        HabitLog::create(['habit_id' => $habit->id, 'user_id' => $user->id, 'logged_date' => '2026-11-05', 'status' => HabitLogStatus::Completed]);
        HabitLog::create(['habit_id' => $habit->id, 'user_id' => $user->id, 'logged_date' => '2026-11-06', 'status' => HabitLogStatus::Completed]);
        HabitLog::create(['habit_id' => $habit->id, 'user_id' => $user->id, 'logged_date' => '2026-11-07', 'status' => HabitLogStatus::Failed]);

        $this->actingAs($user, 'sanctum');

        $response = $this->getJson('/api/v1/habits/'.$habit->uuid);

        $response->assertOk();
        // Failed breaks streak today
        $this->assertSame(0, $response->json('data.current_streak'));
        // Longest streak was 2
        $this->assertSame(2, $response->json('data.longest_streak'));
    }

    public function test_missed_scheduled_day_breaks_streak(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create([
            'user_id' => $user->id,
            'frequency' => HabitFrequency::Custom,
            'target_days' => ['mon', 'wed', 'fri'],
            'created_at' => Carbon::parse('2026-11-01 00:00:00'),
        ]);

        // Mon Nov 2: completed
        // Wed Nov 4: MISSED (no log at all — breaks the streak)
        // Fri Nov 6: completed (starts a fresh streak of 1)
        HabitLog::create(['habit_id' => $habit->id, 'user_id' => $user->id, 'logged_date' => '2026-11-02', 'status' => HabitLogStatus::Completed]);
        HabitLog::create(['habit_id' => $habit->id, 'user_id' => $user->id, 'logged_date' => '2026-11-06', 'status' => HabitLogStatus::Completed]);

        $this->actingAs($user, 'sanctum');

        $response = $this->getJson('/api/v1/habits/'.$habit->uuid);

        $response->assertOk();
        $this->assertSame(1, $response->json('data.current_streak'));
        $this->assertSame(1, $response->json('data.longest_streak'));
    }

    public function test_unlogged_current_day_keeps_streak_alive(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create([
            'user_id' => $user->id,
            'frequency' => HabitFrequency::Daily,
            'created_at' => Carbon::parse('2026-11-01 00:00:00'),
        ]);

        // Nov 7 completed; Nov 8 (today, in progress) not logged yet
        HabitLog::create(['habit_id' => $habit->id, 'user_id' => $user->id, 'logged_date' => '2026-11-07', 'status' => HabitLogStatus::Completed]);

        $this->actingAs($user, 'sanctum');

        $response = $this->getJson('/api/v1/habits/'.$habit->uuid);

        $response->assertOk();
        // The in-progress day has not been missed yet, so yesterday's completion still counts
        $this->assertSame(1, $response->json('data.current_streak'));
        $this->assertSame(1, $response->json('data.longest_streak'));
    }

    public function test_historical_daily_overview_marks_missed_past_day_as_broken(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create([
            'user_id' => $user->id,
            'frequency' => HabitFrequency::Daily,
            'created_at' => Carbon::parse('2026-11-01 00:00:00'),
            'title' => 'Historical Habit',
        ]);

        HabitLog::create(['habit_id' => $habit->id, 'user_id' => $user->id, 'logged_date' => '2026-11-05', 'status' => HabitLogStatus::Completed]);

        $this->actingAs($user, 'sanctum');

        // As of Nov 5 (logged): streak = 1 (Nov 4 missed breaks the walk further back)
        $this->getJson('/api/v1/habits/daily-overview?date=2026-11-05')
            ->assertOk()
            ->assertJsonPath('data.habits.0.habit.current_streak', 1);

        // As of Nov 6 (past, scheduled, never logged): the missed day breaks the streak
        $this->getJson('/api/v1/habits/daily-overview?date=2026-11-06')
            ->assertOk()
            ->assertJsonPath('data.habits.0.habit.current_streak', 0);
    }

    public function test_legacy_precreation_logs_are_preserved_but_excluded_from_statistics(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create([
            'user_id' => $user->id,
            'frequency' => HabitFrequency::Daily,
            'created_at' => Carbon::parse('2026-11-01 00:00:00'),
            'title' => 'Legacy History Habit',
        ]);

        // Legacy pre-creation records written before the canonical history
        // start existed. They must be preserved in storage untouched.
        foreach (['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'] as $legacyDate) {
            HabitLog::create([
                'habit_id' => $habit->id,
                'user_id' => $user->id,
                'logged_date' => $legacyDate,
                'status' => HabitLogStatus::Completed,
            ]);
        }

        // Valid post-creation history: Nov 5, 6, 7 completed.
        // Nov 1-4 are post-creation but unlogged (missed), Nov 8 is in progress.
        foreach (['2026-11-05', '2026-11-06', '2026-11-07'] as $validDate) {
            HabitLog::create([
                'habit_id' => $habit->id,
                'user_id' => $user->id,
                'logged_date' => $validDate,
                'status' => HabitLogStatus::Completed,
            ]);
        }

        $this->actingAs($user, 'sanctum');

        $response = $this->getJson('/api/v1/habits/'.$habit->uuid)->assertOk();

        // Current streak counts only post-creation days: Nov 5, 6, 7 (Nov 4 missed breaks).
        $this->assertSame(3, $response->json('data.current_streak'));

        // Longest streak starts at the creation date: the 4-day legacy chain
        // before Nov 1 must not extend it beyond Nov 5-7.
        $this->assertSame(3, $response->json('data.longest_streak'));

        // Total completed counts only valid logs from the creation date onward.
        $this->assertSame(3, $response->json('data.stats.total_completed'));

        // Completion rate: 3 completed of 8 scheduled days (Nov 1..Nov 8).
        $this->assertSame(37.5, $response->json('data.stats.completion_rate'));

        // The list endpoint applies the same canonical history start.
        $list = $this->getJson('/api/v1/habits')->assertOk();
        $this->assertSame(3, $list->json('data.0.current_streak'));
        $this->assertSame(3, $list->json('data.0.longest_streak'));
        $this->assertSame(3, $list->json('data.0.stats.total_completed'));

        // Legacy records are preserved, never silently deleted (7 = 4 legacy + 3 valid).
        $this->assertDatabaseCount('habit_logs', 7);
        $this->assertSame(4, HabitLog::query()
            ->where('habit_id', $habit->id)
            ->where('logged_date', '<', '2026-11-01')
            ->count());
    }

    public function test_delete_log_rejects_invalid_date_and_out_of_window_date(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create(['user_id' => $user->id]);

        // Pre-existing log older than the 30-day editing window
        HabitLog::create([
            'habit_id' => $habit->id,
            'user_id' => $user->id,
            'logged_date' => '2026-10-01',
            'status' => HabitLogStatus::Completed,
        ]);

        $this->actingAs($user, 'sanctum');

        // Unparseable date must be a 422, never a 500
        $this->deleteJson('/api/v1/habits/'.$habit->uuid.'/logs/not-a-date')
            ->assertUnprocessable()
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        // Overflow date is rejected by round-trip validation
        $this->deleteJson('/api/v1/habits/'.$habit->uuid.'/logs/2026-02-30')
            ->assertUnprocessable()
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        // Logs older than 30 days cannot be removed (Decision 6 editing window)
        $this->deleteJson('/api/v1/habits/'.$habit->uuid.'/logs/2026-10-01')
            ->assertUnprocessable()
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        $this->assertSame(1, HabitLog::query()
            ->where('habit_id', $habit->id)
            ->whereDate('logged_date', '2026-10-01')
            ->count());
    }

    public function test_user_can_delete_checkin_log(): void
    {
        $user = $this->userWithPermissions(['habits.manage']);
        $habit = Habit::factory()->create(['user_id' => $user->id]);
        $date = Carbon::now($user->timezone)->format('Y-m-d');

        HabitLog::create([
            'habit_id' => $habit->id,
            'user_id' => $user->id,
            'logged_date' => $date,
            'status' => HabitLogStatus::Completed,
        ]);

        $this->actingAs($user, 'sanctum');

        $this->deleteJson('/api/v1/habits/'.$habit->uuid.'/logs/'.$date)->assertOk();

        $this->assertDatabaseMissing('habit_logs', [
            'habit_id' => $habit->id,
            'logged_date' => $date,
        ]);
    }

    public function test_user_without_habits_permission_is_forbidden(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum');

        $this->getJson('/api/v1/habits')
            ->assertForbidden()
            ->assertJsonPath('error_code', 'FORBIDDEN');

        $this->postJson('/api/v1/habits', [
            'title' => 'No Permission',
            'frequency' => 'daily',
        ])->assertForbidden()
            ->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_unauthenticated_request_is_rejected_with_401(): void
    {
        $this->getJson('/api/v1/habits')->assertUnauthorized();
    }

    /**
     * @param  array<int, string>  $permissions
     * @param  array<string, mixed>  $attributes
     */
    private function userWithPermissions(array $permissions, string $roleSlug = 'habit-test-role', array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $role = Role::factory()->create(['slug' => $roleSlug === 'system-admin' ? $roleSlug : $roleSlug.'-'.$user->id]);
        $permissionIds = [];
        foreach ($permissions as $slug) {
            $permissionIds[] = Permission::query()->firstOrCreate(['slug' => $slug], [
                'name' => $slug,
                'module' => 'habits',
                'description' => $slug,
            ])->id;
        }
        $role->permissions()->sync($permissionIds);
        $user->roles()->attach($role);

        return $user;
    }
}
