<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $allPermissions = Permission::all();

        // 1. System Admin gets everything
        $adminRole = Role::where('slug', UserRole::SystemAdmin->value)->first();
        if ($adminRole) {
            $adminRole->permissions()->sync($allPermissions->pluck('id'));
        }

        // 2. Project Manager
        $pmRole = Role::where('slug', UserRole::ProjectManager->value)->first();
        if ($pmRole) {
            $pmPermissions = $allPermissions->filter(function (Permission $permission) {
                return in_array($permission->module, ['projects', 'tasks', 'appointments'])
                    || in_array($permission->slug, [
                        'users.view',
                        'users.invite',
                        'teams.view',
                        'teams.create',
                        'teams.update',
                        'teams.manage',
                        'habits.manage',
                    ]);
            });
            $pmRole->permissions()->sync($pmPermissions->pluck('id'));
        }

        // 3. Team Leader
        $leadRole = Role::where('slug', UserRole::TeamLeader->value)->first();
        if ($leadRole) {
            $leadPermissions = $allPermissions->filter(function (Permission $permission) {
                return in_array($permission->slug, [
                    'projects.view',
                    'tasks.view',
                    'tasks.create',
                    'tasks.update',
                    'tasks.assign',
                    'tasks.comment',
                    'teams.view',
                    'teams.update',
                    'teams.manage',
                    'appointments.view',
                    'appointments.create',
                    'appointments.update',
                    'habits.manage',
                    'users.view',
                ]);
            });
            $leadRole->permissions()->sync($leadPermissions->pluck('id'));
        }

        // 4. Member
        $memberRole = Role::where('slug', UserRole::Member->value)->first();
        if ($memberRole) {
            $memberPermissions = $allPermissions->filter(function (Permission $permission) {
                return in_array($permission->slug, [
                    'projects.view',
                    'tasks.view',
                    'tasks.comment',
                    'appointments.view',
                    'habits.manage',
                    'users.view',
                ]);
            });
            $memberRole->permissions()->sync($memberPermissions->pluck('id'));
        }
    }
}
