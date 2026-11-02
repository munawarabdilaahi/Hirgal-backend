<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountStatus;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
    }

    public function test_user_can_login_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'jane@hirgal.local',
            'password' => Hash::make('Secret123!'),
            'account_status' => AccountStatus::Active,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'jane@hirgal.local',
            'password' => 'Secret123!',
            'device_name' => 'test-device',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Authenticated successfully.')
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'access_token',
                    'token_type',
                    'user' => [
                        'id',
                        'name',
                        'email',
                        'account_status',
                        'timezone',
                    ],
                ],
            ]);

        $this->assertNotEmpty($response->json('data.access_token'));
        $this->assertNotNull($user->fresh()->last_login_at);
    }

    public function test_login_fails_with_invalid_password(): void
    {
        User::factory()->create([
            'email' => 'jane@hirgal.local',
            'password' => Hash::make('Secret123!'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'jane@hirgal.local',
            'password' => 'WrongPassword!',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR')
            ->assertJsonValidationErrors(['email']);
    }

    public function test_login_fails_with_non_existent_email(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'nonexistent@hirgal.local',
            'password' => 'AnyPassword123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_suspended_user_cannot_login(): void
    {
        User::factory()->create([
            'email' => 'suspended@hirgal.local',
            'password' => Hash::make('Secret123!'),
            'account_status' => AccountStatus::Suspended,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'suspended@hirgal.local',
            'password' => 'Secret123!',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_sensitive_attributes_are_never_exposed_in_login_response(): void
    {
        User::factory()->create([
            'email' => 'secure@hirgal.local',
            'password' => Hash::make('Secret123!'),
            'account_status' => AccountStatus::Active,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'secure@hirgal.local',
            'password' => 'Secret123!',
        ]);

        $response->assertOk();

        $userData = $response->json('data.user');
        $this->assertArrayNotHasKey('password', $userData);
        $this->assertArrayNotHasKey('remember_token', $userData);
        $this->assertArrayNotHasKey('token_hash', $userData);
    }
}
