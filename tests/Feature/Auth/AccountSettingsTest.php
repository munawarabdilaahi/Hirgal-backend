<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use App\Models\UserInvitation;
use App\Models\UserProfile;
use App\Notifications\EmailChangeVerificationNotification;
use App\Notifications\PasswordChangedNotification;
use App\Notifications\TaskReminder;
use App\Notifications\UserInvitationNotification;
use App\Services\Security\TwoFactorAuthenticationService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AccountSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
    }

    private function member(array $attributes = []): User
    {
        $user = User::factory()->create(array_merge([
            'password' => Hash::make('Password123!'),
        ], $attributes));
        $user->roles()->attach(Role::where('slug', UserRole::Member->value)->firstOrFail()->id);

        return $user;
    }

    public function test_account_endpoints_require_authentication(): void
    {
        $this->getJson('/api/v1/auth/me/sessions')->assertStatus(401);
        $this->getJson('/api/v1/auth/me/security-activity')->assertStatus(401);
        $this->postJson('/api/v1/auth/me/two-factor/setup')->assertStatus(401);
        $this->deleteJson('/api/v1/auth/me')->assertStatus(401);
    }

    public function test_sessions_list_only_contains_the_authenticated_users_sessions(): void
    {
        $user = $this->member();
        $other = $this->member();
        $token = $user->createToken('Laptop')->plainTextToken;
        $other->createToken('Other laptop');

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/auth/me/sessions');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.tracks_browser_sessions', false);

        $ids = collect($response->json('data.sessions'))->pluck('label');
        $this->assertContains('Laptop', $ids->all());
        $this->assertNotContains('Other laptop', $ids->all());
        $this->assertTrue(collect($response->json('data.sessions'))->firstWhere('label', 'Laptop')['current']);
        $this->assertStringNotContainsString($token, $response->getContent());
    }

    public function test_revoking_another_token_requires_the_current_password(): void
    {
        $user = $this->member();
        $current = $user->createToken('Current')->plainTextToken;
        $other = $user->createToken('Other');
        $target = 'token-'.$other->accessToken->id;

        $this->withHeader('Authorization', 'Bearer '.$current)
            ->postJson('/api/v1/auth/me/sessions/revoke', ['target' => $target, 'current_password' => 'wrong'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['current_password']);

        $this->assertDatabaseHas('personal_access_tokens', ['id' => $other->accessToken->id]);

        $this->withHeader('Authorization', 'Bearer '.$current)
            ->postJson('/api/v1/auth/me/sessions/revoke', ['target' => $target, 'current_password' => 'Password123!'])
            ->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $other->accessToken->id]);
    }

    public function test_sessions_exclude_tokens_at_the_expiration_boundary(): void
    {
        $this->travelTo(now()->startOfSecond());
        $user = $this->member();
        $expired = $user->createToken('Expired')->accessToken;
        $expired->forceFill(['created_at' => now()->subDays(30)])->save();
        $current = $user->createToken('Current')->plainTextToken;

        $response = $this->withToken($current)->getJson('/api/v1/auth/me/sessions')->assertOk();

        $labels = collect($response->json('data.sessions'))->pluck('label')->all();
        $this->assertContains('Current', $labels);
        $this->assertNotContains('Expired', $labels);
    }

    public function test_data_export_requires_password_and_never_returns_secrets(): void
    {
        $user = $this->member(['name' => 'Export User']);
        $user->forceFill([
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => ['hashed-one'],
        ])->save();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/export', ['current_password' => 'nope'])
            ->assertStatus(422);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/export', ['current_password' => 'Password123!'])
            ->assertOk()
            ->assertJsonPath('data.identity.email', $user->email)
            ->assertJsonPath('data.security.two_factor_enabled', true);

        $this->assertStringNotContainsString('JBSWY3DPEHPK3PXP', $response->getContent());
        $this->assertStringNotContainsString('hashed-one', $response->getContent());
        $this->assertDatabaseHas('activity_logs', ['action' => 'account.data_exported', 'user_id' => $user->id]);
    }

    public function test_avatar_can_be_uploaded_served_via_signed_url_and_removed(): void
    {
        Storage::fake('local');
        $user = $this->member();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/avatar', [
                'avatar' => UploadedFile::fake()->image('avatar.png', 256, 256),
            ])
            ->assertOk();

        $url = $response->json('data.avatar_url');
        $this->assertIsString($url);
        $this->assertStringContainsString('signature=', $url);
        $this->assertStringNotContainsString('account-avatars', $url);

        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/png');

        $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/v1/auth/me/avatar')
            ->assertOk()
            ->assertJsonPath('data.avatar_url', null);

        $this->assertNull($user->fresh()->avatar_url);
    }

    public function test_avatar_upload_rejects_non_image_and_oversized_files(): void
    {
        Storage::fake('local');
        $user = $this->member();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/avatar', ['avatar' => UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf')])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['avatar']);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/avatar', ['avatar' => UploadedFile::fake()->image('tiny.png', 32, 32)])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['avatar']);
    }

    public function test_avatar_upload_accepts_high_resolution_portrait_photos(): void
    {
        Storage::fake('local');
        $user = $this->member();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/avatar', [
                'avatar' => UploadedFile::fake()->image('profile_portrait_1MB.jpg', 3000, 4000)->size(1024),
            ])
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);

        $this->assertNotNull($user->fresh()->avatar_url);
    }

    public function test_email_change_requires_verification_before_updating_the_address(): void
    {
        Notification::fake();
        $user = $this->member(['email' => 'old@example.com']);
        $code = null;

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/email-change', [
                'email' => 'new@example.com',
                'current_password' => 'Password123!',
            ])
            ->assertOk();

        Notification::assertSentOnDemand(
            EmailChangeVerificationNotification::class,
            function (EmailChangeVerificationNotification $notification) use (&$code): bool {
                $code = $notification->code;

                return $notification->pendingEmail === 'new@example.com';
            }
        );

        $this->assertSame('old@example.com', $user->fresh()->email);
        $this->assertSame('new@example.com', $user->fresh()->pending_email);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/email-change/confirm', [
                'code' => '000000',
                'current_password' => 'Password123!',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['code']);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/email-change/confirm', [
                'code' => $code,
                'current_password' => 'Password123!',
            ])
            ->assertOk()
            ->assertJsonPath('data.email', 'new@example.com');

        $fresh = $user->fresh();
        $this->assertSame('new@example.com', $fresh->email);
        $this->assertNull($fresh->pending_email);
        $this->assertNotNull($fresh->email_verified_at);
        $this->assertDatabaseHas('activity_logs', ['action' => 'account.email_changed', 'subject_id' => $user->id]);
    }

    public function test_notification_preferences_control_non_security_notification_channels(): void
    {
        $user = $this->member();
        UserProfile::factory()->create([
            'user_id' => $user->id,
            'notification_preferences' => [
                'email_notifications' => false,
                'in_app_notifications' => false,
                'workspace_invitations' => false,
            ],
        ]);
        $user->unsetRelation('profile');

        $this->assertSame([], (new TaskReminder(new Task))->via($user));
        $this->assertSame([], (new UserInvitationNotification(new UserInvitation, 'raw-token'))->via($user));
    }

    public function test_notification_preferences_keep_enabled_channels_available(): void
    {
        $user = $this->member();
        UserProfile::factory()->create([
            'user_id' => $user->id,
            'notification_preferences' => [
                'email_notifications' => true,
                'in_app_notifications' => true,
                'workspace_invitations' => true,
            ],
        ]);
        $user->unsetRelation('profile');

        $this->assertSame(['database'], (new TaskReminder(new Task))->via($user));
        $this->assertSame(['mail'], (new UserInvitationNotification(new UserInvitation, 'raw-token'))->via($user));
    }

    public function test_email_change_fails_if_the_pending_address_is_taken_before_confirmation(): void
    {
        Notification::fake();
        $user = $this->member(['email' => 'owner@example.com']);
        $code = null;

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/email-change', [
                'email' => 'claimed@example.com',
                'current_password' => 'Password123!',
            ])
            ->assertOk();

        Notification::assertSentOnDemand(
            EmailChangeVerificationNotification::class,
            function (EmailChangeVerificationNotification $notification) use (&$code): bool {
                $code = $notification->code;

                return true;
            }
        );

        User::factory()->create(['email' => 'claimed@example.com']);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/email-change/confirm', [
                'code' => $code,
                'current_password' => 'Password123!',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        $this->assertSame('owner@example.com', $user->fresh()->email);
    }

    public function test_two_factor_setup_confirm_and_recovery_code_login(): void
    {
        $user = $this->member(['email' => 'totp@example.com']);
        $service = app(TwoFactorAuthenticationService::class);

        $setup = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/two-factor/setup', ['current_password' => 'Password123!'])
            ->assertOk()
            ->assertJsonStructure(['data' => ['secret', 'provisioning_uri', 'issuer']]);

        $secret = $setup->json('data.secret');
        $this->assertStringStartsWith('otpauth://totp/', $setup->json('data.provisioning_uri'));

        $confirmation = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/two-factor/confirm', ['code' => $service->currentCode($secret)])
            ->assertOk();

        $recoveryCodes = $confirmation->json('data.recovery_codes');
        $this->assertCount(8, $recoveryCodes);
        $this->assertTrue($user->fresh()->hasTwoFactorAuthentication());

        $this->app['auth']->forgetGuards();
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => 'totp@example.com',
            'password' => 'Password123!',
        ])->assertOk()->assertJsonPath('data.two_factor_required', true);

        $challengeToken = $loginRes->json('data.challenge_token');
        $this->assertNotEmpty($challengeToken);

        $this->postJson('/api/v1/auth/two-factor/verify', [
            'challenge_token' => $challengeToken,
            'recovery_code' => $recoveryCodes[0],
        ])->assertOk()->assertJsonStructure(['data' => ['access_token', 'user']]);

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/two-factor/verify', [
            'challenge_token' => $challengeToken,
            'recovery_code' => $recoveryCodes[0],
        ])->assertStatus(422)->assertJsonValidationErrors(['challenge']);

        $this->assertCount(7, $user->fresh()->two_factor_recovery_codes);
    }

    public function test_two_factor_requires_a_fresh_code_and_rejects_replay(): void
    {
        $user = $this->member(['email' => 'replay@example.com']);
        $service = app(TwoFactorAuthenticationService::class);

        $secret = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/two-factor/setup', ['current_password' => 'Password123!'])
            ->json('data.secret');

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/two-factor/confirm', ['code' => $service->currentCode($secret)])
            ->assertOk();

        $this->app['auth']->forgetGuards();

        $this->postJson('/api/v1/auth/login', [
            'email' => 'replay@example.com',
            'password' => 'Password123!',
            'two_factor_code' => $service->currentCode($secret),
        ])->assertStatus(422);

        $this->travel(31)->seconds();
        $this->postJson('/api/v1/auth/login', [
            'email' => 'replay@example.com',
            'password' => 'Password123!',
            'two_factor_code' => $service->currentCode($secret),
        ])->assertOk();
    }

    public function test_two_factor_can_be_disabled_only_with_password_and_valid_code(): void
    {
        $user = $this->member();
        $service = app(TwoFactorAuthenticationService::class);
        $secret = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/two-factor/setup', ['current_password' => 'Password123!'])
            ->json('data.secret');
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/me/two-factor/confirm', ['code' => $service->currentCode($secret)])
            ->assertOk();

        $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/v1/auth/me/two-factor', ['code' => '000000', 'current_password' => 'Password123!'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['code']);

        $this->travel(31)->seconds();

        $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/v1/auth/me/two-factor', [
                'code' => $service->currentCode($secret),
                'current_password' => 'Password123!',
            ])
            ->assertOk();

        $this->assertFalse($user->fresh()->hasTwoFactorAuthentication());
        $this->assertNull($user->fresh()->two_factor_secret);
        $this->assertDatabaseHas('activity_logs', ['action' => 'account.two_factor_disabled', 'user_id' => $user->id]);
    }

    public function test_password_change_sends_notification_and_audit_record(): void
    {
        Notification::fake();
        $user = $this->member();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/change-password', [
                'current_password' => 'Password123!',
                'password' => 'AnotherPassword123!',
                'password_confirmation' => 'AnotherPassword123!',
            ])
            ->assertOk();

        Notification::assertSentTo($user, PasswordChangedNotification::class);
        $this->assertDatabaseHas('activity_logs', ['action' => 'account.password_changed', 'user_id' => $user->id]);
    }

    public function test_account_deactivation_revokes_sessions_and_blocks_login(): void
    {
        $user = $this->member(['email' => 'deactivate@example.com']);
        $token = $user->createToken('session');

        $this->withHeader('Authorization', 'Bearer '.$token->plainTextToken)
            ->postJson('/api/v1/auth/me/deactivate', ['current_password' => 'Password123!'])
            ->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $token->accessToken->id]);
        $this->assertSame(AccountStatus::Suspended, $user->fresh()->account_status);

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/login', [
            'email' => 'deactivate@example.com',
            'password' => 'Password123!',
        ])->assertStatus(403);
    }

    public function test_the_last_system_admin_cannot_deactivate_their_account(): void
    {
        $admin = User::factory()->create(['password' => Hash::make('Password123!')]);
        $admin->roles()->attach(Role::where('slug', UserRole::SystemAdmin->value)->firstOrFail()->id);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/auth/me/deactivate', ['current_password' => 'Password123!'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['account']);

        $this->assertSame(AccountStatus::Active, $admin->fresh()->account_status);
    }

    public function test_account_deletion_requires_confirmation_and_blocks_project_owners(): void
    {
        $owner = $this->member();
        Project::factory()->create(['owner_id' => $owner->id]);

        $this->actingAs($owner, 'sanctum')
            ->deleteJson('/api/v1/auth/me', [
                'current_password' => 'Password123!',
                'confirm' => 'DELETE',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['account']);

        $ordinary = $this->member();
        $this->actingAs($ordinary, 'sanctum')
            ->deleteJson('/api/v1/auth/me', [
                'current_password' => 'Password123!',
                'confirm' => 'delete',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['confirm']);

        $this->actingAs($ordinary, 'sanctum')
            ->deleteJson('/api/v1/auth/me', [
                'current_password' => 'Password123!',
                'confirm' => 'DELETE',
            ])
            ->assertOk();

        $this->assertSoftDeleted('users', ['id' => $ordinary->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'account.deleted', 'user_id' => $ordinary->id]);
    }

    public function test_profile_update_normalizes_notification_preferences_and_keeps_security_alerts_enabled(): void
    {
        $user = $this->member();

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/v1/auth/me/profile', [
                'notification_preferences' => [
                    'email_notifications' => false,
                    'in_app_notifications' => true,
                    'security_alerts' => false,
                    'login_alerts' => false,
                    'unknown_key' => 'ignored',
                ],
                'locale' => 'en',
                'date_format' => 'd/m/Y',
                'time_format' => '12h',
            ])
            ->assertOk()
            ->assertJsonPath('data.profile.date_format', 'd/m/Y')
            ->assertJsonPath('data.profile.time_format', '12h');

        $preferences = $user->fresh()->profile?->notification_preferences;
        $this->assertFalse($preferences['email_notifications']);
        $this->assertTrue($preferences['security_alerts']);
        $this->assertTrue($preferences['login_alerts']);
        $this->assertArrayNotHasKey('unknown_key', $preferences);
    }
}
