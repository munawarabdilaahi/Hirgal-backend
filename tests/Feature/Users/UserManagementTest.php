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
}
