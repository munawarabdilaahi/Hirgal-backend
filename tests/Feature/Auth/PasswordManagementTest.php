<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PasswordManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
    }

    public function test_forgot_password_generates_token_and_dispatches_notification(): void
    {
        Notification::fake();

        $user = User::factory()->create(['email' => 'forgetful@hirgal.local']);

        $response = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'forgetful@hirgal.local',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true);

        Notification::assertSentTo($user, ResetPasswordNotification::class);
        $this->assertDatabaseHas('password_reset_tokens', ['email' => 'forgetful@hirgal.local']);
    }

    public function test_forgot_password_returns_generic_success_for_non_existent_email(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'unknown@hirgal.local',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true);

        Notification::assertNothingSent();
    }

    public function test_user_can_reset_password_with_valid_token(): void
    {
        $user = User::factory()->create([
            'email' => 'resetme@hirgal.local',
            'password' => Hash::make('OldPassword123!'),
        ]);

        $oldToken = $user->createToken('active-session')->plainTextToken;

        $rawToken = 'plain-token-string-1234567890';
        $hashedToken = hash('sha256', $rawToken);

        DB::table('password_reset_tokens')->insert([
            'email' => 'resetme@hirgal.local',
            'token' => $hashedToken,
            'created_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/auth/reset-password', [
            'email' => 'resetme@hirgal.local',
            'token' => $rawToken,
            'password' => 'NewSecretPassword123!',
            'password_confirmation' => 'NewSecretPassword123!',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true);

        // Password updated
        $this->assertTrue(Hash::check('NewSecretPassword123!', $user->fresh()->password));

        // Old token was revoked
        $this->withHeader('Authorization', 'Bearer '.$oldToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        // Reset token removed from database
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => 'resetme@hirgal.local']);
    }

    public function test_reset_password_fails_with_expired_token(): void
    {
        User::factory()->create(['email' => 'expired@hirgal.local']);

        $rawToken = 'expired-token-string';
        DB::table('password_reset_tokens')->insert([
            'email' => 'expired@hirgal.local',
            'token' => hash('sha256', $rawToken),
            'created_at' => now()->subMinutes(65),
        ]);

        $response = $this->postJson('/api/v1/auth/reset-password', [
            'email' => 'expired@hirgal.local',
            'token' => $rawToken,
            'password' => 'NewSecretPassword123!',
            'password_confirmation' => 'NewSecretPassword123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['token']);
    }

    public function test_authenticated_user_can_change_password(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('CurrentPassword123!'),
        ]);

        $token = $user->createToken('session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/auth/change-password', [
                'current_password' => 'CurrentPassword123!',
                'password' => 'FreshNewPassword123!',
                'password_confirmation' => 'FreshNewPassword123!',
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true);

        $this->assertTrue(Hash::check('FreshNewPassword123!', $user->fresh()->password));
    }

    public function test_change_password_fails_with_incorrect_current_password(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('CurrentPassword123!'),
        ]);

        $token = $user->createToken('session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/auth/change-password', [
                'current_password' => 'WrongCurrentPassword!',
                'password' => 'FreshNewPassword123!',
                'password_confirmation' => 'FreshNewPassword123!',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['current_password']);
    }

    public function test_change_password_can_logout_other_devices(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('CurrentPassword123!'),
        ]);

        $currentToken = $user->createToken('current-device')->plainTextToken;
        $otherToken = $user->createToken('other-device')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$currentToken)
            ->postJson('/api/v1/auth/change-password', [
                'current_password' => 'CurrentPassword123!',
                'password' => 'BrandNewPassword123!',
                'password_confirmation' => 'BrandNewPassword123!',
                'logout_other_devices' => true,
            ]);

        $response->assertOk();

        // Current token is still valid
        $this->withHeader('Authorization', 'Bearer '.$currentToken)
            ->getJson('/api/v1/auth/me')
            ->assertOk();

        // Other token is revoked
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$otherToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }
}
