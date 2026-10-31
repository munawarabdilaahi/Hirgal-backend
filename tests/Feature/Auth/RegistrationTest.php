<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
    }

    public function test_public_registration_is_blocked_by_default(): void
    {
        Config::set('auth.allow_registration', false);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Alice Doe',
            'email' => 'alice@hirgal.local',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'FORBIDDEN');

        $this->assertDatabaseMissing('users', ['email' => 'alice@hirgal.local']);
    }

    public function test_public_registration_succeeds_when_enabled(): void
    {
        Config::set('auth.allow_registration', true);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Alice Doe',
            'email' => 'alice@hirgal.local',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'timezone' => 'America/New_York',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'User registered successfully.');

        $this->assertDatabaseHas('users', [
            'email' => 'alice@hirgal.local',
            'name' => 'Alice Doe',
            'account_status' => AccountStatus::Active->value,
            'timezone' => 'America/New_York',
        ]);

        $user = User::where('email', 'alice@hirgal.local')->first();
        $this->assertTrue($user->hasRole(UserRole::Member->value));
        $this->assertNotNull($user->profile);
    }

    public function test_registration_validation_fails_for_duplicate_email(): void
    {
        Config::set('auth.allow_registration', true);

        User::factory()->create(['email' => 'alice@hirgal.local']);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Alice Clone',
            'email' => 'alice@hirgal.local',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_registration_validation_fails_for_password_mismatch(): void
    {
        Config::set('auth.allow_registration', true);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Alice Doe',
            'email' => 'alice@hirgal.local',
            'password' => 'Password123!',
            'password_confirmation' => 'DifferentPassword123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }
}
