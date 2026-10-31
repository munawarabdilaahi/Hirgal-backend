<?php

namespace Tests\Feature\Database;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DatabaseSchemaMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_twenty_seven_domain_tables_exist(): void
    {
        $domainTables = [
            // Domain 1: Auth & Identity
            'users',
            'user_profiles',
            'user_invitations',
            'password_reset_tokens',
            'personal_access_tokens',
            'sessions',

            // Domain 2: RBAC
            'roles',
            'permissions',
            'role_permissions',
            'user_roles',

            // Domain 3: Projects
            'projects',
            'project_members',
            'project_invitations',

            // Domain 4: Teams
            'teams',
            'team_members',
            'project_teams',

            // Domain 5: Tasks
            'tasks',
            'task_assignments',
            'task_comments',
            'task_attachments',

            // Domain 6: Appointments
            'appointments',
            'appointment_participants',

            // Domain 7: Follow-up Inbox & Notifications
            'notifications',
            'user_mentions',

            // Domain 8: Habit Tracker
            'habits',
            'habit_logs',

            // Domain 9: Activity Logs
            'activity_logs',
        ];

        foreach ($domainTables as $table) {
            $this->assertTrue(
                Schema::hasTable($table),
                "Failed asserting that domain table [{$table}] exists in the database schema."
            );
        }

        $this->assertCount(27, $domainTables);
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
