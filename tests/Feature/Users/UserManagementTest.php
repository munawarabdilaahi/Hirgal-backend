<?php

namespace Tests\Feature\Users;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $member;

    protected Role $adminRole;

    protected Role $memberRole;

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

    public function test_system_admin_can_list_users(): void
    {
        User::factory()->count(5)->create();

        $token = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/users');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data',
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);

        $this->assertGreaterThanOrEqual(7, $response->json('meta.total'));
    }

    public function test_admin_can_manually_create_an_active_member(): void
    {
        $this->actingAs($this->admin, 'sanctum');
        $payload = [
            'name' => 'Manual Member',
            'email' => 'Manual.Member@example.test',
            'password' => 'initial-password',
            'password_confirmation' => 'initial-password',
            'role_id' => $this->adminRole->id,
        ];

        $this->postJson('/api/v1/users', $payload)
            ->assertCreated()
            ->assertJsonPath('data.email', 'manual.member@example.test')
            ->assertJsonPath('data.account_status', 'active')
            ->assertJsonMissingPath('data.password');

        $created = User::where('email', 'manual.member@example.test')->sole();
        $this->assertTrue(Hash::check($payload['password'], $created->password));
        $this->assertSame([$this->memberRole->id], $created->roles()->pluck('roles.id')->all());
        $this->assertNotNull($created->profile);
        $this->assertDatabaseMissing('user_invitations', ['email' => $created->email]);
        $this->postJson('/api/v1/users', $payload)->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_manual_creation_checks_permission_and_password_confirmation(): void
    {
        $payload = [
            'name' => 'Manual Member',
            'email' => 'manual.member@example.test',
            'password' => 'initial-password',
            'password_confirmation' => 'wrong-password',
        ];
        $this->actingAs($this->member, 'sanctum')->postJson('/api/v1/users', $payload)->assertForbidden();
        $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/users', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');
        $this->assertDatabaseMissing('users', ['email' => $payload['email']]);
    }

    public function test_admin_can_filter_users_by_search_status_and_role(): void
    {
        $target = User::factory()->create(['name' => 'Specific Unique Person', 'account_status' => AccountStatus::Active]);
        $target->roles()->attach($this->memberRole->id);

        $token = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/users?search=Unique&status=active&role='.UserRole::Member->value);

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame($target->id, $response->json('data.0.id'));
    }

    public function test_member_without_users_view_permission_cannot_list_users(): void
    {
        // Member role by default does NOT have users.view permission
        $token = $this->member->createToken('member-session')->plainTextToken;

        // Remove users.view if it was present
        $this->memberRole->permissions()->detach();

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/users');

        $response->assertStatus(403);
    }

    public function test_admin_can_view_individual_user(): void
    {
        $token = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/users/'.$this->member->id);

        $response->assertOk()
            ->assertJsonPath('data.id', $this->member->id)
            ->assertJsonPath('data.name', 'Standard Member');
    }

    public function test_account_owner_only_fields_are_not_exposed_to_other_users(): void
    {
        $this->member->forceFill([
            'pending_email' => 'replacement@example.test',
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => ['code-one', 'code-two'],
        ])->save();

        $ownerToken = $this->member->createToken('member-session')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$ownerToken)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.pending_email', 'replacement@example.test')
            ->assertJsonPath('data.two_factor_enabled', true)
            ->assertJsonPath('data.recovery_codes_remaining', 2);

        $adminToken = $this->admin->createToken('admin-session')->plainTextToken;
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$adminToken)
            ->getJson('/api/v1/users/'.$this->member->id)
            ->assertOk()
            ->assertJsonPath('data.two_factor_enabled', true)
            ->assertJsonMissingPath('data.pending_email')
            ->assertJsonMissingPath('data.recovery_codes_remaining');
    }

    public function test_member_cannot_update_other_users(): void
    {
        $otherUser = User::factory()->create();
        $token = $this->member->createToken('member-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/v1/users/'.$otherUser->id, [
                'name' => 'Malicious Update',
            ]);

        $response->assertStatus(403);
    }

    public function test_admin_can_update_user_and_change_role(): void
    {
        $targetUser = User::factory()->create();
        $targetUser->roles()->attach($this->memberRole->id);

        $leadRole = Role::where('slug', UserRole::TeamLeader->value)->first();

        $token = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/v1/users/'.$targetUser->id, [
                'name' => 'Promoted User',
                'role_id' => $leadRole->id,
            ]);

        $response->assertOk()
            ->assertJsonPath('data.name', 'Promoted User')
            ->assertJsonPath('data.roles.0.slug', UserRole::TeamLeader->value);

        $this->assertTrue($targetUser->fresh()->hasRole(UserRole::TeamLeader->value));
    }

    public function test_cannot_demote_the_last_active_system_administrator(): void
    {
        // Admin is currently the only active System Admin
        $token = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/v1/users/'.$this->admin->id, [
                'role_id' => $this->memberRole->id,
            ]);

        $response->assertStatus(403);
        $this->assertTrue($this->admin->fresh()->hasRole(UserRole::SystemAdmin->value));
    }

    public function test_user_cannot_deactivate_own_account(): void
    {
        $token = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/users/'.$this->admin->id.'/deactivate');

        $response->assertStatus(403);
        $this->assertSame(AccountStatus::Active, $this->admin->fresh()->account_status);
    }

    public function test_admin_can_deactivate_user_and_revokes_their_tokens(): void
    {
        $targetUser = User::factory()->create(['account_status' => AccountStatus::Active]);
        $targetUser->roles()->attach($this->memberRole->id);

        $targetUserToken = $targetUser->createToken('active-session')->plainTextToken;

        $adminToken = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$adminToken)
            ->postJson('/api/v1/users/'.$targetUser->id.'/deactivate');

        $response->assertOk()
            ->assertJsonPath('data.account_status', AccountStatus::Suspended->value);

        $this->assertSame(AccountStatus::Suspended, $targetUser->fresh()->account_status);

        // Target user token is revoked
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$targetUserToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }

    public function test_admin_can_activate_suspended_user(): void
    {
        $targetUser = User::factory()->create(['account_status' => AccountStatus::Suspended]);
        $adminToken = $this->admin->createToken('admin-session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$adminToken)
            ->postJson('/api/v1/users/'.$targetUser->id.'/activate');

        $response->assertOk()
            ->assertJsonPath('data.account_status', AccountStatus::Active->value);

        $this->assertSame(AccountStatus::Active, $targetUser->fresh()->account_status);
    }

    public function test_admin_status_update_revokes_tokens_that_stay_revoked_after_reactivation(): void
    {
        $target = User::factory()->create();
        $target->roles()->attach($this->memberRole->id);
        $targetToken = $target->createToken('target')->plainTextToken;
        $adminToken = $this->admin->createToken('admin')->plainTextToken;

        $this->withToken($adminToken)->putJson('/api/v1/users/'.$target->id, ['account_status' => 'suspended'])->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)->postJson('/api/v1/users/'.$target->id.'/activate')->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($targetToken)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }
}
