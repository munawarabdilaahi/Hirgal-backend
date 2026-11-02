<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $permissions = [
            // Users
            ['name' => 'View Users', 'slug' => 'users.view', 'module' => 'users', 'description' => 'Can view full administrative user management list.'],
            ['name' => 'View Directory', 'slug' => 'users.view_directory', 'module' => 'users', 'description' => 'Can view basic member directory for collaboration.'],
            ['name' => 'Create Users', 'slug' => 'users.create', 'module' => 'users', 'description' => 'Can create new user accounts directly.'],
            ['name' => 'Update Users', 'slug' => 'users.update', 'module' => 'users', 'description' => 'Can update user profiles and account statuses.'],
            ['name' => 'Delete Users', 'slug' => 'users.delete', 'module' => 'users', 'description' => 'Can deactivate or delete user accounts.'],
            ['name' => 'Invite Users', 'slug' => 'users.invite', 'module' => 'users', 'description' => 'Can dispatch onboarding user invitations.'],

            // Roles & RBAC
            ['name' => 'View Roles', 'slug' => 'roles.view', 'module' => 'roles', 'description' => 'Can view system roles and permission matrices.'],
            ['name' => 'Manage Roles', 'slug' => 'roles.manage', 'module' => 'roles', 'description' => 'Can modify role assignments and permission grants.'],

            // Projects
            ['name' => 'View Projects', 'slug' => 'projects.view', 'module' => 'projects', 'description' => 'Can view authorized projects.'],
            ['name' => 'Create Projects', 'slug' => 'projects.create', 'module' => 'projects', 'description' => 'Can create new projects and define settings.'],
            ['name' => 'Update Projects', 'slug' => 'projects.update', 'module' => 'projects', 'description' => 'Can modify project metadata and workflows.'],
            ['name' => 'Delete Projects', 'slug' => 'projects.delete', 'module' => 'projects', 'description' => 'Can soft-delete projects.'],
            ['name' => 'Archive Projects', 'slug' => 'projects.archive', 'module' => 'projects', 'description' => 'Can archive completed projects.'],
            ['name' => 'Invite Project Members', 'slug' => 'projects.invite', 'module' => 'projects', 'description' => 'Can invite users to join projects.'],

            // Tasks
            ['name' => 'View Tasks', 'slug' => 'tasks.view', 'module' => 'tasks', 'description' => 'Can view tasks in authorized projects.'],
            ['name' => 'Create Tasks', 'slug' => 'tasks.create', 'module' => 'tasks', 'description' => 'Can create tasks within authorized projects.'],
            ['name' => 'Update Tasks', 'slug' => 'tasks.update', 'module' => 'tasks', 'description' => 'Can edit task descriptions, dates, and priorities.'],
            ['name' => 'Delete Tasks', 'slug' => 'tasks.delete', 'module' => 'tasks', 'description' => 'Can delete tasks.'],
            ['name' => 'Assign Tasks', 'slug' => 'tasks.assign', 'module' => 'tasks', 'description' => 'Can delegate tasks to project members.'],
            ['name' => 'Comment on Tasks', 'slug' => 'tasks.comment', 'module' => 'tasks', 'description' => 'Can post comments and mention users.'],

            // Teams
            ['name' => 'View Teams', 'slug' => 'teams.view', 'module' => 'teams', 'description' => 'Can view team directory.'],
            ['name' => 'Create Teams', 'slug' => 'teams.create', 'module' => 'teams', 'description' => 'Can create organizational teams.'],
            ['name' => 'Update Teams', 'slug' => 'teams.update', 'module' => 'teams', 'description' => 'Can update team info and leaders.'],
            ['name' => 'Delete Teams', 'slug' => 'teams.delete', 'module' => 'teams', 'description' => 'Can disband teams.'],
            ['name' => 'Manage Teams', 'slug' => 'teams.manage', 'module' => 'teams', 'description' => 'Can add or remove team members.'],

            // Appointments
            ['name' => 'View Appointments', 'slug' => 'appointments.view', 'module' => 'appointments', 'description' => 'Can view own and invited calendar appointments.'],
            ['name' => 'Create Appointments', 'slug' => 'appointments.create', 'module' => 'appointments', 'description' => 'Can schedule new meetings and invite participants.'],
            ['name' => 'Update Appointments', 'slug' => 'appointments.update', 'module' => 'appointments', 'description' => 'Can modify scheduled meeting times and links.'],
            ['name' => 'Delete Appointments', 'slug' => 'appointments.delete', 'module' => 'appointments', 'description' => 'Can cancel appointments.'],

            // Habits
            ['name' => 'Manage Habits', 'slug' => 'habits.manage', 'module' => 'habits', 'description' => 'Can create and track personal habits.'],

            // Auditing
            ['name' => 'View Audit Logs', 'slug' => 'audit.view', 'module' => 'audit', 'description' => 'Can inspect system-wide activity and security audit trails.'],
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(
                ['slug' => $permission['slug']],
                $permission
            );
        }
    }
}
