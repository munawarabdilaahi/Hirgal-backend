<?php

namespace Tests\Feature\Database;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DatabaseSchemaMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_thirty_two_tables_exist_with_proper_classification(): void
    {
        $coreBusinessDomainTables = [
            // Domain 1: Auth & Identity (3)
            'users',
            'user_profiles',
            'user_invitations',

            // Domain 2: RBAC (4)
            'roles',
            'permissions',
            'role_permissions',
            'user_roles',

            // Domain 3: Projects (3)
            'projects',
            'project_members',
            'project_invitations',

            // Domain 4: Teams (3)
            'teams',
            'team_members',
            'project_teams',

            // Domain 5: Tasks (4)
            'tasks',
            'task_assignments',
            'task_comments',
            'task_attachments',

            // Domain 6: Appointments (2)
            'appointments',
            'appointment_participants',

            // Domain 7: User Mentions (1)
            'user_mentions',

            // Domain 8: Habit Tracker (2)
            'habits',
            'habit_logs',

            // Domain 9: Activity Logs (1)
            'activity_logs',
        ];

        $frameworkInfrastructureTables = [
            // Category A: Auth & Sessions (3)
            'sessions',
            'password_reset_tokens',
            'personal_access_tokens',

            // Category B: Notifications (1)
            'notifications',

            // Category C: Queue & Jobs (3)
            'jobs',
            'job_batches',
            'failed_jobs',

            // Category D: Cache (2)
            'cache',
            'cache_locks',
        ];

        $this->assertCount(23, $coreBusinessDomainTables);
        $this->assertCount(9, $frameworkInfrastructureTables);

        foreach ($coreBusinessDomainTables as $table) {
            $this->assertTrue(
                Schema::hasTable($table),
                "Failed asserting that core business domain table [{$table}] exists in the database schema."
            );
        }

        foreach ($frameworkInfrastructureTables as $table) {
            $this->assertTrue(
                Schema::hasTable($table),
                "Failed asserting that framework infrastructure table [{$table}] exists in the database schema."
            );
        }

        $allTables = array_merge($coreBusinessDomainTables, $frameworkInfrastructureTables);
        $this->assertCount(32, $allTables);
    }

    public function test_expected_critical_columns_exist_on_core_tables(): void
    {
        // Users table
        $this->assertTrue(Schema::hasColumns('users', [
            'id', 'name', 'email', 'password', 'account_status', 'avatar_url', 'timezone', 'last_login_at', 'deleted_at',
        ]));

        // Projects table
        $this->assertTrue(Schema::hasColumns('projects', [
            'id', 'uuid', 'name', 'slug', 'status', 'priority', 'owner_id', 'deleted_at',
        ]));

        // Tasks table
        $this->assertTrue(Schema::hasColumns('tasks', [
            'id', 'uuid', 'project_id', 'parent_id', 'title', 'status', 'priority', 'creator_id', 'order_column', 'deleted_at',
        ]));

        // Habits & Logs
        $this->assertTrue(Schema::hasColumns('habits', [
            'id', 'uuid', 'user_id', 'title', 'frequency', 'target_days', 'is_archived',
        ]));
        $this->assertTrue(Schema::hasColumns('habit_logs', [
            'id', 'habit_id', 'user_id', 'logged_date', 'status',
        ]));
    }
}
