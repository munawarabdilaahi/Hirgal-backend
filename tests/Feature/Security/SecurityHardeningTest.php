<?php

namespace Tests\Feature\Security;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use App\Models\UserInvitation;
use App\Notifications\ResetPasswordNotification;
use App\Notifications\UserInvitationNotification;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected Role $adminRole;

    protected Role $pmRole;

    protected Role $leadRole;

    protected Role $memberRole;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
        $this->seed(RolePermissionSeeder::class);

        $this->adminRole = Role::where('slug', UserRole::SystemAdmin->value)->firstOrFail();
        $this->pmRole = Role::where('slug', UserRole::ProjectManager->value)->firstOrFail();
        $this->leadRole = Role::where('slug', UserRole::TeamLeader->value)->firstOrFail();
        $this->memberRole = Role::where('slug', UserRole::Member->value)->firstOrFail();
    }

    protected function createUserWithRole(Role $role, array $attributes = []): User
    {
        $user = User::factory()->create(array_merge([
            'account_status' => AccountStatus::Active,
        ], $attributes));

        $user->roles()->attach($role->id);

        return $user;
    }

    // ==========================================
    // SEC-01: Self-Privilege Escalation
    // ==========================================

    public function test_sec_01_member_cannot_escalate_own_role_to_system_admin_via_users_endpoint(): void
    {
        $member = $this->createUserWithRole($this->memberRole);

        $response = $this->actingAs($member, 'sanctum')
            ->putJson("/api/v1/users/{$member->id}", [
                'role_id' => $this->adminRole->id,
            ]);

        $response->assertStatus(403);

        $this->app['auth']->forgetGuards();
        $member->refresh();
        $this->assertFalse($member->isSystemAdmin());
        $this->assertTrue($member->hasRole(UserRole::Member->value));
    }

    public function test_sec_01_member_cannot_modify_own_account_status_via_users_endpoint(): void
    {
        $member = $this->createUserWithRole($this->memberRole);

        $response = $this->actingAs($member, 'sanctum')
            ->putJson("/api/v1/users/{$member->id}", [
                'account_status' => AccountStatus::Suspended->value,
            ]);

        $response->assertStatus(403);
    }

    public function test_sec_01_member_cannot_update_other_users_via_admin_endpoint(): void
    {
        $member = $this->createUserWithRole($this->memberRole);
        $otherUser = $this->createUserWithRole($this->memberRole);

        $response = $this->actingAs($member, 'sanctum')
            ->putJson("/api/v1/users/{$otherUser->id}", [
                'name' => 'Hacked Name',
            ]);

        $response->assertStatus(403);
    }

    public function test_sec_01_member_can_update_own_profile_via_auth_me_endpoint(): void
    {
        $member = $this->createUserWithRole($this->memberRole);

        $response = $this->actingAs($member, 'sanctum')
            ->putJson('/api/v1/auth/me/profile', [
                'name' => 'Legitimate Member Name',
                'timezone' => 'America/New_York',
                'job_title' => 'Software Engineer',
                'department' => 'Engineering',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.name', 'Legitimate Member Name');

        $this->assertDatabaseHas('users', [
            'id' => $member->id,
            'name' => 'Legitimate Member Name',
            'timezone' => 'America/New_York',
        ]);
    }

    public function test_sec_01_system_admin_can_update_user_role_and_status(): void
    {
        $admin = $this->createUserWithRole($this->adminRole);
        $target = $this->createUserWithRole($this->memberRole);

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/users/{$target->id}", [
                'role_id' => $this->leadRole->id,
                'account_status' => AccountStatus::Suspended->value,
            ]);

        $response->assertStatus(200);

        $target->refresh();
        $this->assertTrue($target->hasRole(UserRole::TeamLeader->value));
        $this->assertEquals(AccountStatus::Suspended, $target->account_status);
    }

    // ==========================================
    // SEC-02: Invitation Privilege Escalation
    // ==========================================

    public function test_sec_02_project_manager_cannot_invite_system_admin(): void
    {
        $pm = $this->createUserWithRole($this->pmRole);

        $response = $this->actingAs($pm, 'sanctum')
            ->postJson('/api/v1/invitations', [
                'email' => 'unauthorized-admin@example.com',
                'role_id' => $this->adminRole->id,
            ]);

        $response->assertStatus(403);
        $this->assertDatabaseMissing('user_invitations', [
            'email' => 'unauthorized-admin@example.com',
        ]);
    }

    public function test_sec_02_project_manager_can_invite_regular_member(): void
    {
        Notification::fake();

        $pm = $this->createUserWithRole($this->pmRole);

        $response = $this->actingAs($pm, 'sanctum')
            ->postJson('/api/v1/invitations', [
                'email' => 'legitimate-member@example.com',
                'role_id' => $this->memberRole->id,
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('user_invitations', [
            'email' => 'legitimate-member@example.com',
            'role_id' => $this->memberRole->id,
        ]);
    }

    public function test_sec_02_system_admin_can_invite_system_admin(): void
    {
        Notification::fake();

        $admin = $this->createUserWithRole($this->adminRole);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/invitations', [
                'email' => 'new-admin@example.com',
                'role_id' => $this->adminRole->id,
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('user_invitations', [
            'email' => 'new-admin@example.com',
            'role_id' => $this->adminRole->id,
        ]);
    }

    public function test_sec_02_project_manager_cannot_delete_system_admin_invitation(): void
    {
        $admin = $this->createUserWithRole($this->adminRole);
        $pm = $this->createUserWithRole($this->pmRole);

        $invitation = UserInvitation::create([
            'email' => 'pending-admin@example.com',
            'token_hash' => hash('sha256', Str::random(64)),
            'role_id' => $this->adminRole->id,
            'invited_by' => $admin->id,
            'status' => 'pending',
            'expires_at' => now()->addDays(7),
        ]);

        $response = $this->actingAs($pm, 'sanctum')
            ->deleteJson("/api/v1/invitations/{$invitation->id}");

        $response->assertStatus(403);
        $this->assertDatabaseHas('user_invitations', ['id' => $invitation->id]);
    }

    // ==========================================
    // SEC-03: Last System Admin Guard & Locking
    // ==========================================

    public function test_sec_03_cannot_demote_the_last_active_system_admin(): void
    {
        $admin = $this->createUserWithRole($this->adminRole);

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/users/{$admin->id}", [
                'role_id' => $this->memberRole->id,
            ]);

        // Blocked either by self-role protection or last-admin protection
        $response->assertStatus(403);

        $admin->refresh();
        $this->assertTrue($admin->isSystemAdmin());
    }

    public function test_sec_03_cannot_deactivate_the_last_active_system_admin(): void
    {
        $admin = $this->createUserWithRole($this->adminRole);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/users/{$admin->id}/deactivate");

        $response->assertStatus(403);

        $admin->refresh();
        $this->assertEquals(AccountStatus::Active, $admin->account_status);
    }

    public function test_sec_03_can_deactivate_system_admin_when_another_active_admin_exists(): void
    {
        $admin1 = $this->createUserWithRole($this->adminRole);
        $admin2 = $this->createUserWithRole($this->adminRole);

        $response = $this->actingAs($admin1, 'sanctum')
            ->postJson("/api/v1/users/{$admin2->id}/deactivate");

        $response->assertStatus(200);

        $admin2->refresh();
        $this->assertEquals(AccountStatus::Suspended, $admin2->account_status);
    }

    // ==========================================
    // SEC-04: Invitation Token Leakage Mitigation
    // ==========================================

    public function test_sec_04_inspect_invitation_via_post_body_succeeds(): void
    {
        $admin = $this->createUserWithRole($this->adminRole);
        $rawToken = Str::random(64);

        UserInvitation::create([
            'email' => 'inspect-test@example.com',
            'token_hash' => hash('sha256', $rawToken),
            'role_id' => $this->memberRole->id,
            'invited_by' => $admin->id,
            'status' => 'pending',
            'expires_at' => now()->addDays(7),
        ]);

        $response = $this->postJson('/api/v1/invitations/inspect', [
            'token' => $rawToken,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.email', 'inspect-test@example.com')
            ->assertJsonPath('data.role.slug', UserRole::Member->value);
    }

    public function test_sec_04_inspect_invitation_with_invalid_token_returns_422(): void
    {
        $response = $this->postJson('/api/v1/invitations/inspect', [
            'token' => 'completely-invalid-nonexistent-token',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['token']);
    }

    public function test_sec_04_legacy_get_invitation_route_sets_deprecation_header(): void
    {
        $admin = $this->createUserWithRole($this->adminRole);
        $rawToken = Str::random(64);

        UserInvitation::create([
            'email' => 'deprecation-test@example.com',
            'token_hash' => hash('sha256', $rawToken),
            'role_id' => $this->memberRole->id,
            'invited_by' => $admin->id,
            'status' => 'pending',
            'expires_at' => now()->addDays(7),
        ]);

        $response = $this->getJson("/api/v1/invitations/{$rawToken}");

        $response->assertStatus(200)
            ->assertHeader('Deprecation', 'true');
    }

    // ==========================================
    // SEC-05: User Enumeration Mitigation
    // ==========================================

    public function test_sec_05_login_returns_identical_generic_error_for_nonexistent_and_bad_password(): void
    {
        $user = $this->createUserWithRole($this->memberRole, [
            'email' => 'valid-user@example.com',
            'password' => Hash::make('CorrectPassword123!'),
        ]);

        // 1. Non-existent email
        $responseNonExistent = $this->postJson('/api/v1/auth/login', [
            'email' => 'doesnotexist@example.com',
            'password' => 'WrongPassword123!',
        ]);

        $responseNonExistent->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        // 2. Existing email with incorrect password
        $responseBadPassword = $this->postJson('/api/v1/auth/login', [
            'email' => 'valid-user@example.com',
            'password' => 'WrongPassword123!',
        ]);

        $responseBadPassword->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        // Both error messages must be identical
        $this->assertEquals(
            $responseNonExistent->json('errors.email.0'),
            $responseBadPassword->json('errors.email.0')
        );
    }

    // ==========================================
    // SEC-06: Orphaned Reset Token Flooding
    // ==========================================

    public function test_sec_06_forgot_password_for_nonexistent_email_does_not_create_token_row(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'ghost-account@example.com',
        ]);

        $response->assertStatus(200);

        $this->assertEquals(
            0,
            DB::table('password_reset_tokens')->where('email', 'ghost-account@example.com')->count()
        );

        Notification::assertNothingSent();
    }

    public function test_sec_06_forgot_password_for_valid_email_creates_token_and_dispatches_notification(): void
    {
        Notification::fake();

        $user = $this->createUserWithRole($this->memberRole, [
            'email' => 'registered-user@example.com',
        ]);

        $response = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'registered-user@example.com',
        ]);

        $response->assertStatus(200);

        $this->assertEquals(
            1,
            DB::table('password_reset_tokens')->where('email', 'registered-user@example.com')->count()
        );

        Notification::assertSentTo($user, ResetPasswordNotification::class);
    }

    // ==========================================
    // SEC-07: Separate Directory from Admin User List
    // ==========================================

    public function test_sec_07_regular_member_cannot_access_administrative_users_index(): void
    {
        $member = $this->createUserWithRole($this->memberRole);

        $response = $this->actingAs($member, 'sanctum')
            ->getJson('/api/v1/users');

        $response->assertStatus(403);
    }

    public function test_sec_07_regular_member_can_access_directory_with_sanitized_fields(): void
    {
        $member = $this->createUserWithRole($this->memberRole);
        $otherMember = $this->createUserWithRole($this->memberRole, [
            'name' => 'Directory Colleague',
            'email' => 'colleague@example.com',
        ]);

        $response = $this->actingAs($member, 'sanctum')
            ->getJson('/api/v1/users/directory');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'name',
                        'email',
                        'avatar_url',
                        'timezone',
                        'job_title',
                        'department',
                    ],
                ],
                'meta' => [
                    'current_page',
                    'last_page',
                    'per_page',
                    'total',
                ],
            ]);

        $firstItem = $response->json('data.0');

        // Sensitive admin fields must NOT be in the directory resource
        $this->assertArrayNotHasKey('account_status', $firstItem);
        $this->assertArrayNotHasKey('email_verified_at', $firstItem);
        $this->assertArrayNotHasKey('last_login_at', $firstItem);
        $this->assertArrayNotHasKey('roles', $firstItem);
        $this->assertArrayNotHasKey('permissions', $firstItem);
    }

    public function test_sec_07_system_admin_can_access_administrative_user_list(): void
    {
        $admin = $this->createUserWithRole($this->adminRole);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/users');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'name',
                        'email',
                        'account_status',
                        'avatar_url',
                        'timezone',
                        'email_verified_at',
                        'last_login_at',
                        'created_at',
                        'updated_at',
                    ],
                ],
            ]);
    }

    // ==========================================
    // SEC-08: Notification Action URLs Point to Frontend
    // ==========================================

    public function test_sec_08_reset_password_notification_url_points_to_frontend(): void
    {
        config(['app.frontend_url' => 'https://app.hirgal.com']);

        $user = $this->createUserWithRole($this->memberRole, ['email' => 'notif-user@example.com']);
        $notification = new ResetPasswordNotification('test-token-123', 'notif-user@example.com');

        $mailMessage = $notification->toMail($user);

        $this->assertStringStartsWith('https://app.hirgal.com/reset-password', $mailMessage->actionUrl);
        $this->assertStringContainsString('token=test-token-123', $mailMessage->actionUrl);
        $this->assertStringContainsString('email=notif-user%40example.com', $mailMessage->actionUrl);
    }

    public function test_sec_08_invitation_notification_url_points_to_frontend(): void
    {
        config(['app.frontend_url' => 'https://app.hirgal.com']);

        $admin = $this->createUserWithRole($this->adminRole);
        $invitation = UserInvitation::create([
            'email' => 'invited-member@example.com',
            'token_hash' => hash('sha256', 'raw-secret-token'),
            'role_id' => $this->memberRole->id,
            'invited_by' => $admin->id,
            'status' => 'pending',
            'expires_at' => now()->addDays(7),
        ]);

        $notification = new UserInvitationNotification($invitation, 'raw-secret-token');
        $mailMessage = $notification->toMail($invitation);

        $this->assertStringStartsWith('https://app.hirgal.com/invitations/accept', $mailMessage->actionUrl);
        $this->assertStringContainsString('token=raw-secret-token', $mailMessage->actionUrl);
    }
}
