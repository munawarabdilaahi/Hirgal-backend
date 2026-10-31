<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountStatus;
use App\Enums\InvitationStatus;
use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use App\Models\UserInvitation;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvitationAcceptanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
    }

    public function test_user_can_inspect_invitation_with_valid_token(): void
    {
        $inviter = User::factory()->create();
        $role = Role::where('slug', UserRole::Member->value)->first();

        $rawToken = 'valid-invitation-token-12345';
        $hashed = hash('sha256', $rawToken);

        $invitation = UserInvitation::create([
            'email' => 'invitee@hirgal.local',
            'role_id' => $role->id,
            'token_hash' => $hashed,
            'status' => InvitationStatus::Pending,
            'invited_by' => $inviter->id,
            'expires_at' => now()->addDays(7),
        ]);

        $response = $this->getJson('/api/v1/invitations/'.$rawToken);

        $response->assertOk()
            ->assertJsonPath('data.email', 'invitee@hirgal.local')
            ->assertJsonPath('data.role.slug', UserRole::Member->value)
            ->assertJsonPath('data.status', 'pending');

        $this->assertArrayNotHasKey('token_hash', $response->json('data'));
    }

    public function test_user_can_accept_invitation_and_activate_account(): void
    {
        $inviter = User::factory()->create();
        $leadRole = Role::where('slug', UserRole::TeamLeader->value)->first();

        $rawToken = 'team-leader-invitation-token';
        $hashed = hash('sha256', $rawToken);

        $invitation = UserInvitation::create([
            'email' => 'newleader@hirgal.local',
            'role_id' => $leadRole->id,
            'token_hash' => $hashed,
            'status' => InvitationStatus::Pending,
            'invited_by' => $inviter->id,
            'expires_at' => now()->addDays(7),
        ]);

        $response = $this->postJson('/api/v1/invitations/'.$rawToken.'/accept', [
            'name' => 'Sarah Leader',
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'SecurePassword123!',
            'timezone' => 'America/Chicago',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'access_token',
                    'token_type',
                    'user' => ['id', 'name', 'email'],
                ],
            ]);

        // Assert user exists and has correct attributes
        $this->assertDatabaseHas('users', [
            'email' => 'newleader@hirgal.local',
            'name' => 'Sarah Leader',
            'account_status' => AccountStatus::Active->value,
            'timezone' => 'America/Chicago',
        ]);

        $user = User::where('email', 'newleader@hirgal.local')->first();
        $this->assertTrue($user->hasRole(UserRole::TeamLeader->value));
        $this->assertNotNull($user->profile);

        // Assert invitation is marked accepted
        $this->assertSame(InvitationStatus::Accepted, $invitation->fresh()->status);
        $this->assertNotNull($invitation->fresh()->accepted_at);
    }

    public function test_cannot_reuse_accepted_invitation_token(): void
    {
        $inviter = User::factory()->create();
        $role = Role::where('slug', UserRole::Member->value)->first();

        $rawToken = 'already-accepted-token';
        $hashed = hash('sha256', $rawToken);

        UserInvitation::create([
            'email' => 'used@hirgal.local',
            'role_id' => $role->id,
            'token_hash' => $hashed,
            'status' => InvitationStatus::Accepted,
            'invited_by' => $inviter->id,
            'expires_at' => now()->addDays(7),
            'accepted_at' => now()->subDay(),
        ]);

        $response = $this->postJson('/api/v1/invitations/'.$rawToken.'/accept', [
            'name' => 'Used Token User',
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'SecurePassword123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['token']);
    }

    public function test_cannot_accept_expired_invitation(): void
    {
        $inviter = User::factory()->create();
        $role = Role::where('slug', UserRole::Member->value)->first();

        $rawToken = 'expired-token';
        $hashed = hash('sha256', $rawToken);

        $invitation = UserInvitation::create([
            'email' => 'late@hirgal.local',
            'role_id' => $role->id,
            'token_hash' => $hashed,
            'status' => InvitationStatus::Pending,
            'invited_by' => $inviter->id,
            'expires_at' => now()->subHours(2),
        ]);

        $response = $this->postJson('/api/v1/invitations/'.$rawToken.'/accept', [
            'name' => 'Late User',
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'SecurePassword123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['token']);

        $this->assertSame(InvitationStatus::Expired, $invitation->fresh()->status);
    }

    public function test_cannot_accept_revoked_invitation(): void
    {
        $inviter = User::factory()->create();
        $role = Role::where('slug', UserRole::Member->value)->first();

        $rawToken = 'revoked-token';
        $hashed = hash('sha256', $rawToken);

        UserInvitation::create([
            'email' => 'revoked@hirgal.local',
            'role_id' => $role->id,
            'token_hash' => $hashed,
            'status' => InvitationStatus::Revoked,
            'invited_by' => $inviter->id,
            'expires_at' => now()->addDays(5),
        ]);

        $response = $this->postJson('/api/v1/invitations/'.$rawToken.'/accept', [
            'name' => 'Revoked User',
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'SecurePassword123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['token']);
    }
}
