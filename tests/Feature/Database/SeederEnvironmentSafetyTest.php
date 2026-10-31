<?php

namespace Tests\Feature\Database;

use App\Models\Permission;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DevelopmentProjectSeeder;
use Database\Seeders\DevelopmentUserSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeederEnvironmentSafetyTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        // Restore testing environment
        $this->app['env'] = 'testing';
        parent::tearDown();
    }

    public function test_database_seeder_executes_all_seeders_in_non_production_environment(): void
    {
        $this->assertFalse(app()->isProduction());

        $this->seed(DatabaseSeeder::class);

        // Core systemic seeders executed
        $this->assertDatabaseHas('roles', ['name' => 'System Admin']);
        $this->assertDatabaseHas('roles', ['name' => 'Project Manager']);
        $this->assertGreaterThan(0, Role::count());
        $this->assertGreaterThan(0, Permission::count());

        // Development seeders executed
        $this->assertDatabaseHas('users', ['email' => 'admin@hirgal.local']);
        $this->assertDatabaseHas('users', ['email' => 'pm@hirgal.local']);
        $this->assertDatabaseHas('users', ['email' => 'lead@hirgal.local']);
        $this->assertDatabaseHas('users', ['email' => 'member@hirgal.local']);
        $this->assertGreaterThan(0, Project::count());
    }

    public function test_database_seeder_skips_development_seeders_in_production_environment(): void
    {
        $this->app['env'] = 'production';
        $this->assertTrue(app()->isProduction());

        // In production, administrators run db:seed with --force
        $this->artisan('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true])
            ->assertSuccessful();

        // Core systemic seeders MUST run in production
        $this->assertDatabaseHas('roles', ['name' => 'System Admin']);
        $this->assertDatabaseHas('roles', ['name' => 'Project Manager']);
        $this->assertGreaterThan(0, Role::count());
        $this->assertGreaterThan(0, Permission::count());

        // Development demo accounts MUST NOT be seeded in production
        $this->assertDatabaseMissing('users', ['email' => 'admin@hirgal.local']);
        $this->assertDatabaseMissing('users', ['email' => 'pm@hirgal.local']);
        $this->assertDatabaseMissing('users', ['email' => 'lead@hirgal.local']);
        $this->assertDatabaseMissing('users', ['email' => 'member@hirgal.local']);
        $this->assertSame(0, User::count());
        $this->assertSame(0, Project::count());
    }

    public function test_development_user_seeder_blocks_direct_execution_in_production(): void
    {
        $this->app['env'] = 'production';
        $this->assertTrue(app()->isProduction());

        // Call the seeder directly via artisan with --force
        $this->artisan('db:seed', ['--class' => DevelopmentUserSeeder::class, '--force' => true])
            ->assertSuccessful();

        $this->assertDatabaseMissing('users', ['email' => 'admin@hirgal.local']);
        $this->assertSame(0, User::count());
    }

    public function test_development_project_seeder_blocks_direct_execution_in_production(): void
    {
        $this->app['env'] = 'production';
        $this->assertTrue(app()->isProduction());

        // Call the seeder directly via artisan with --force
        $this->artisan('db:seed', ['--class' => DevelopmentProjectSeeder::class, '--force' => true])
            ->assertSuccessful();

        $this->assertSame(0, Project::count());
    }

    public function test_core_systemic_seeders_remain_runnable_independently(): void
    {
        $this->app['env'] = 'production';
        $this->assertTrue(app()->isProduction());

        $this->artisan('db:seed', ['--class' => RoleSeeder::class, '--force' => true])->assertSuccessful();
        $this->artisan('db:seed', ['--class' => PermissionSeeder::class, '--force' => true])->assertSuccessful();
        $this->artisan('db:seed', ['--class' => RolePermissionSeeder::class, '--force' => true])->assertSuccessful();

        $this->assertGreaterThanOrEqual(4, Role::count());
        $this->assertGreaterThan(0, Permission::count());
    }

    public function test_database_seeder_is_idempotent(): void
    {
        // First run
        $this->seed(DatabaseSeeder::class);
        $roleCount = Role::count();
        $permissionCount = Permission::count();
        $userCount = User::count();
        $projectCount = Project::count();

        // Second run must not duplicate records or throw constraint violations
        $this->seed(DatabaseSeeder::class);

        $this->assertSame($roleCount, Role::count());
        $this->assertSame($permissionCount, Permission::count());
        $this->assertSame($userCount, User::count());
        $this->assertSame($projectCount, Project::count());
    }
}
