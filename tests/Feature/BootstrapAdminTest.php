<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BootstrapAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_creates_first_administrator_with_a_profile(): void
    {
        $this->seed(RoleSeeder::class);
        $this->artisan('hirgal:bootstrap-admin')
            ->expectsQuestion('Administrator name', 'First Admin')
            ->expectsQuestion('Administrator email', 'first@example.com')
            ->expectsQuestion('Administrator password (at least 12 characters)', 'a-strong-password-123')
            ->expectsQuestion('Confirm password', 'a-strong-password-123')
            ->assertSuccessful();

        $user = User::where('email', 'first@example.com')->firstOrFail();
        $this->assertTrue(Hash::check('a-strong-password-123', $user->password));
        $this->assertTrue($user->hasRole(UserRole::SystemAdmin->value));
        $this->assertNotNull($user->profile);
    }

    public function test_rejects_invalid_password_and_noninteractive_execution(): void
    {
        $this->seed(RoleSeeder::class);
        $this->artisan('hirgal:bootstrap-admin')
            ->expectsQuestion('Administrator name', 'First Admin')
            ->expectsQuestion('Administrator email', 'first@example.com')
            ->expectsQuestion('Administrator password (at least 12 characters)', 'short')
            ->expectsQuestion('Confirm password', 'short')
            ->assertFailed();
        $this->artisan('hirgal:bootstrap-admin', ['--no-interaction' => true])->assertFailed();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_does_not_create_a_second_administrator(): void
    {
        $this->seed(RoleSeeder::class);
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::where('slug', UserRole::SystemAdmin->value)->firstOrFail());
        $this->artisan('hirgal:bootstrap-admin')
            ->expectsQuestion('Administrator name', 'Another Admin')
            ->expectsQuestion('Administrator email', 'another@example.com')
            ->expectsQuestion('Administrator password (at least 12 characters)', 'a-strong-password-123')
            ->expectsQuestion('Confirm password', 'a-strong-password-123')
            ->assertFailed();
        $this->assertDatabaseMissing('users', ['email' => 'another@example.com']);
    }
}
