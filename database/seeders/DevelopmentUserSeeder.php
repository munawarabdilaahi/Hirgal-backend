<?php

namespace Database\Seeders;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DevelopmentUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->warn('DevelopmentUserSeeder execution blocked: Cannot seed development demo accounts in production environment.');

            return;
        }

        $defaultPassword = Hash::make('Password123!');

        $users = [
            [
                'name' => 'System Administrator',
                'email' => 'admin@hirgal.local',
                'role' => UserRole::SystemAdmin->value,
                'job_title' => 'Chief Technology Officer',
                'department' => 'Executive',
            ],
            [
                'name' => 'Sarah Project Manager',
                'email' => 'pm@hirgal.local',
                'role' => UserRole::ProjectManager->value,
                'job_title' => 'Senior Technical PM',
                'department' => 'Product Delivery',
            ],
            [
                'name' => 'Alex Team Leader',
                'email' => 'lead@hirgal.local',
                'role' => UserRole::TeamLeader->value,
                'job_title' => 'Backend Engineering Lead',
                'department' => 'Engineering',
            ],
            [
                'name' => 'David Engineer',
                'email' => 'member@hirgal.local',
                'role' => UserRole::Member->value,
                'job_title' => 'Full-Stack Developer',
                'department' => 'Engineering',
            ],
        ];

        foreach ($users as $data) {
            $user = User::firstOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'password' => $defaultPassword,
                    'account_status' => AccountStatus::Active,
                    'email_verified_at' => now(),
                    'timezone' => 'UTC',
                ]
            );

            UserProfile::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'job_title' => $data['job_title'],
                    'department' => $data['department'],
                    'bio' => "Demonstration account for {$data['name']}.",
                    'notification_preferences' => ['email' => true, 'in_app' => true],
                    'theme_preference' => 'system',
                ]
            );

            $role = Role::where('slug', $data['role'])->first();
            if ($role) {
                $user->roles()->syncWithoutDetaching([$role->id]);
            }
        }
    }
}
