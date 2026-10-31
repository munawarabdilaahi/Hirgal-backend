<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Core systemic roles and permissions (safe and required for all environments including production)
        $this->call([
            RoleSeeder::class,
            PermissionSeeder::class,
            RolePermissionSeeder::class,
        ]);

        // 2. Development demonstration accounts & sample projects (strictly forbidden in production)
        if (! app()->isProduction()) {
            $this->call([
                DevelopmentUserSeeder::class,
                DevelopmentProjectSeeder::class,
            ]);
        }
    }
}
