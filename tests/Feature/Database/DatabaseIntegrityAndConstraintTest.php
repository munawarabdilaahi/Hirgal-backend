<?php

namespace Tests\Feature\Database;

use App\Enums\HabitLogStatus;
use App\Enums\ProjectMemberRole;
use App\Models\ActivityLog;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class DatabaseIntegrityAndConstraintTest extends TestCase
{
    use RefreshDatabase;

    public function test_duplicate_project_memberships_are_rejected(): void
    {
        $project = Project::factory()->create();
        $user = User::factory()->create();

        ProjectMember::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'role' => ProjectMemberRole::Member,
        ]);

        $this->expectException(QueryException::class);

        // Attempting to add the same user to the same project twice
        ProjectMember::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'role' => ProjectMemberRole::Viewer,
        ]);
    }

    public function test_duplicate_task_assignments_are_rejected(): void
    {
        $task = Task::factory()->create();
        $user = User::factory()->create();

        TaskAssignment::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'assigned_by' => $task->creator_id,
        ]);

        $this->expectException(QueryException::class);

        // Attempting to assign the same task to the same user twice
        TaskAssignment::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'assigned_by' => $task->creator_id,
        ]);
    }

    public function test_duplicate_habit_logs_for_same_date_are_rejected(): void
    {
        $habit = Habit::factory()->create();

        HabitLog::create([
            'habit_id' => $habit->id,
            'user_id' => $habit->user_id,
            'logged_date' => '2026-11-01',
            'status' => HabitLogStatus::Completed,
        ]);

        $this->expectException(QueryException::class);

        // Attempting to log the same habit twice on the exact same date
        HabitLog::create([
            'habit_id' => $habit->id,
            'user_id' => $habit->user_id,
            'logged_date' => '2026-11-01',
            'status' => HabitLogStatus::Completed,
        ]);
    }

    public function test_activity_log_cannot_be_updated_or_deleted(): void
    {
        $log = ActivityLog::create([
            'action' => 'project.created',
            'subject_type' => Project::class,
            'subject_id' => 1,
            'description' => 'Test event',
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Activity logs are append-only and cannot be updated.');
        $log->update(['description' => 'Tampered event']);
    }

    public function test_activity_log_cannot_be_deleted(): void
    {
        $log = ActivityLog::create([
            'action' => 'project.created',
            'subject_type' => Project::class,
            'subject_id' => 1,
            'description' => 'Test event',
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Activity logs are permanent and cannot be deleted.');
        $log->delete();
    }
}
