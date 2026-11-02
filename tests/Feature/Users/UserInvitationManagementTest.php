<?php

namespace Tests\Feature\Users;

use App\Enums\InvitationStatus;
use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use App\Models\UserInvitation;
use App\Notifications\UserInvitationNotification;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class UserInvitationManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $member;

    protected Role $memberRole;

    protected Role $adminRole;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);

        $this->adminRole = Role::where('slug', UserRole::SystemAdmin->value)->first();
        $this->memberRole = Role::where('slug', UserRole::Member->value)->first();

        $this->admin = User::factory()->create(['name' => 'Admin User']);
        $this->admin->roles()->attach($this->adminRole->id);

        $this->member = User::factory()->create(['name' => 'Standard Member']);
        $this->member->roles()->attach($this->memberRole->id);
    }

    public function test_system_admin_can_list_invitations(): void
    {
        UserInvitation::factory()->count(3)->create(['invited_by' => $this->admin->id]);

        $token = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/invitations');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'email', 'status', 'expires_at', 'role'],
                ],
                'meta',
            ]);
    }

    public function test_regular_member_without_permission_cannot_dispatch_invitations(): void
    {
        $token = $this->member->createToken('member-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/invitations', [
                'email' => 'prospective@hirgal.local',
                'role_id' => $this->memberRole->id,
            ]);

        $response->assertStatus(403);
    }

    public function test_system_admin_can_create_and_dispatch_invitation(): void
    {
        Notification::fake();

        $token = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/invitations', [
                'email' => 'newhire@hirgal.local',
                'role_id' => $this->memberRole->id,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.email', 'newhire@hirgal.local')
            ->assertJsonPath('data.status', 'pending');

        $this->assertDatabaseHas('user_invitations', [
            'email' => 'newhire@hirgal.local',
            'role_id' => $this->memberRole->id,
            'status' => InvitationStatus::Pending->value,
            'invited_by' => $this->admin->id,
        ]);

        Notification::assertSentTo(
            new AnonymousNotifiable,
            UserInvitationNotification::class
        );
    }

    public function test_cannot_invite_email_that_already_has_an_active_account(): void
    {
        User::factory()->create(['email' => 'existing@hirgal.local']);

        $token = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/invitations', [
                'email' => 'existing@hirgal.local',
                'role_id' => $this->memberRole->id,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_cannot_create_duplicate_pending_invitation_for_same_email(): void
    {
        UserInvitation::create([
            'email' => 'pending@hirgal.local',
            'role_id' => $this->memberRole->id,
            'token_hash' => hash('sha256', 'existing-token'),
            'status' => InvitationStatus::Pending,
            'invited_by' => $this->admin->id,
            'expires_at' => now()->addDays(5),
        ]);

        $token = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/invitations', [
                'email' => 'pending@hirgal.local',
                'role_id' => $this->memberRole->id,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_admin_can_resend_invitation_with_fresh_token(): void
    {
        Notification::fake();

        $invitation = UserInvitation::create([
            'email' => 'resendme@hirgal.local',
            'role_id' => $this->memberRole->id,
            'token_hash' => hash('sha256', 'old-token'),
            'status' => InvitationStatus::Pending,
            'invited_by' => $this->admin->id,
            'expires_at' => now()->addDays(1),
        ]);

        $oldHash = $invitation->token_hash;

        $token = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/invitations/'.$invitation->id.'/resend');

        $response->assertOk()
            ->assertJsonPath('success', true);

        $fresh = $invitation->fresh();
        $this->assertNotSame($oldHash, $fresh->token_hash);
        $this->assertTrue($fresh->expires_at->isAfter(now()->addDays(6)));

        Notification::assertSentTo(
            new AnonymousNotifiable,
            UserInvitationNotification::class
        );
    }

    public function test_admin_can_revoke_invitation(): void
    {
        $invitation = UserInvitation::create([
            'email' => 'revokeme@hirgal.local',
            'role_id' => $this->memberRole->id,
            'token_hash' => hash('sha256', 'revokable-token'),
            'status' => InvitationStatus::Pending,
            'invited_by' => $this->admin->id,
            'expires_at' => now()->addDays(5),
        ]);

        $token = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/v1/invitations/'.$invitation->id);

        $response->assertOk()
            ->assertJsonPath('data.status', InvitationStatus::Revoked->value);

        $this->assertSame(InvitationStatus::Revoked, $invitation->fresh()->status);
    }
}
