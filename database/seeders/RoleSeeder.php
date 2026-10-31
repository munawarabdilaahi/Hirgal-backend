<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = [
            [
                'name' => UserRole::SystemAdmin->label(),
                'slug' => UserRole::SystemAdmin->value,
                'description' => 'Unrestricted global system administration and platform management.',
                'is_system' => true,
            ],
            [
                'name' => UserRole::ProjectManager->label(),
                'slug' => UserRole::ProjectManager->value,
                'description' => 'Can create and oversee projects, allocate teams, and manage workflows.',
                'is_system' => true,
            ],
            [
                'name' => UserRole::TeamLeader->label(),
                'slug' => UserRole::TeamLeader->value,
                'description' => 'Can lead squads, manage team members, and coordinate cross-project tasks.',
                'is_system' => true,
            ],
            [
                'name' => UserRole::Member->label(),
                'slug' => UserRole::Member->value,
                'description' => 'Standard user who participates in assigned projects, tasks, and appointments.',
                'is_system' => true,
            ],
        ];

        foreach ($roles as $role) {
            Role::firstOrCreate(
                ['slug' => $role['slug']],
                $role
            );
        }
    }
}
