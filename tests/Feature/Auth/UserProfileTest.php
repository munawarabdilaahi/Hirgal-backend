<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use App\Models\UserProfile;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
    }

    public function test_authenticated_user_can_retrieve_their_profile(): void
    {
        $user = User::factory()->create(['name' => 'John Doe']);
        $role = Role::where('slug', UserRole::Member->value)->first();
        $user->roles()->attach($role->id);

        UserProfile::create([
            'user_id' => $user->id,
            'job_title' => 'Software Engineer',
            'department' => 'Technology',
        ]);

        $token = $user->createToken('session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/auth/me');

        $response->assertOk()
            ->assertJsonPath('data.name', 'John Doe')
            ->assertJsonPath('data.profile.job_title', 'Software Engineer')
            ->assertJsonPath('data.roles.0.slug', UserRole::Member->value);
    }

    public function test_authenticated_user_can_update_permitted_profile_fields(): void
    {
        $user = User::factory()->create(['name' => 'Original Name']);
        $token = $user->createToken('session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/v1/auth/me/profile', [
                'name' => 'Updated Name',
                'phone' => '+1234567890',
                'job_title' => 'Principal Architect',
                'department' => 'Engineering',
                'bio' => 'Lover of clean domain architecture.',
                'theme_preference' => 'dark',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.name', 'Updated Name')
            ->assertJsonPath('data.profile.job_title', 'Principal Architect')
            ->assertJsonPath('data.profile.theme_preference', 'dark');

        $this->assertDatabaseHas('user_profiles', [
            'user_id' => $user->id,
            'phone' => '+1234567890',
            'job_title' => 'Principal Architect',
        ]);
    }

    public function test_protected_fields_are_ignored_during_profile_update(): void
    {
        $user = User::factory()->create([
            'account_status' => AccountStatus::Active,
        ]);
        $role = Role::where('slug', UserRole::Member->value)->first();
        $user->roles()->attach($role->id);

        $adminRole = Role::where('slug', UserRole::SystemAdmin->value)->first();

        $token = $user->createToken('session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/v1/auth/me/profile', [
                'name' => 'Attempted Hacker',
                'account_status' => 'suspended',
                'role_id' => $adminRole->id,
                'email_verified_at' => null,
            ]);

        $response->assertOk();

        $fresh = $user->fresh();
        // Account status remains active
        $this->assertSame(AccountStatus::Active, $fresh->account_status);
        // Role remains Member, not escalated to System Admin
        $this->assertFalse($fresh->hasRole(UserRole::SystemAdmin->value));
    }

    public function test_suspended_user_is_blocked_by_account_active_middleware(): void
    {
        $user = User::factory()->create([
            'account_status' => AccountStatus::Suspended,
        ]);

        $token = $user->createToken('session')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/auth/me');

        $response->assertStatus(403)
            ->assertJsonPath('error_code', 'ACCOUNT_NOT_ACTIVE');
    }
}
