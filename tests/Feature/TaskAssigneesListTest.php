<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\ProjectMemberRole;
use App\Enums\UserRole;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskAssigneesListTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $pm;

    protected User $lead;

    protected User $member;

    protected User $inactiveUser;

    protected Project $project;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);

        $adminRole = Role::where('slug', UserRole::SystemAdmin->value)->firstOrFail();
        $pmRole = Role::where('slug', UserRole::ProjectManager->value)->firstOrFail();
        $leadRole = Role::where('slug', UserRole::TeamLeader->value)->firstOrFail();
        $memberRole = Role::where('slug', UserRole::Member->value)->firstOrFail();

        $this->admin = User::factory()->create([
            'name' => 'System Administrator',
            'email' => 'admin@hirgal.test',
            'account_status' => AccountStatus::Active,
        ]);
        $this->admin->roles()->attach($adminRole->id);

        $this->pm = User::factory()->create([
            'name' => 'Sarah PM',
            'email' => 'sarah@hirgal.test',
            'account_status' => AccountStatus::Active,
        ]);
        $this->pm->roles()->attach($pmRole->id);

        $this->lead = User::factory()->create([
            'name' => 'Alex Lead',
            'email' => 'alex@hirgal.test',
            'account_status' => AccountStatus::Active,
        ]);
        $this->lead->roles()->attach($leadRole->id);

        $this->member = User::factory()->create([
            'name' => 'David Member',
            'email' => 'david@hirgal.test',
            'account_status' => AccountStatus::Active,
        ]);
        $this->member->roles()->attach($memberRole->id);

        $this->inactiveUser = User::factory()->create([
            'name' => 'Inactive User',
            'email' => 'inactive@hirgal.test',
            'account_status' => AccountStatus::Suspended,
        ]);
        $this->inactiveUser->roles()->attach($memberRole->id);

        $this->project = Project::factory()->create([
            'owner_id' => $this->pm->id,
        ]);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->pm->id,
            'role' => ProjectMemberRole::Owner,
            'joined_at' => now(),
        ]);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->lead->id,
            'role' => ProjectMemberRole::Lead,
            'joined_at' => now(),
        ]);
    }

    public function test_assignees_endpoint_returns_multiple_workspace_users_and_not_only_auth_user(): void
    {
        $response = $this->actingAs($this->admin)->getJson('/api/v1/tasks/assignees');

        $response->assertOk()
            ->assertJsonPath('success', true);

        $users = collect($response->json('data'));
        $userIds = $users->pluck('id')->all();

        // Must include all active users across different roles
        $this->assertContains($this->admin->id, $userIds);
        $this->assertContains($this->pm->id, $userIds);
        $this->assertContains($this->lead->id, $userIds);
        $this->assertContains($this->member->id, $userIds);

        // Authenticated user must not be the only user
        $this->assertGreaterThan(1, $users->count());
        $this->assertCount(4, $users);

        // Verify roles and profile fields returned
        $adminEntry = $users->firstWhere('id', $this->admin->id);
        $this->assertSame('System Administrator', $adminEntry['name']);
        $this->assertNotNull($adminEntry['role']);
    }

    public function test_assignees_endpoint_excludes_inactive_users(): void
    {
        $response = $this->actingAs($this->admin)->getJson('/api/v1/tasks/assignees');

        $response->assertOk();
        $userIds = collect($response->json('data'))->pluck('id')->all();

        $this->assertNotContains($this->inactiveUser->id, $userIds);
    }

    public function test_assignees_endpoint_scopes_to_project_members_when_project_is_provided(): void
    {
        $response = $this->actingAs($this->admin)->getJson("/api/v1/tasks/assignees?project={$this->project->uuid}");

        $response->assertOk();
        $userIds = collect($response->json('data'))->pluck('id')->all();

        // Project members (pm and lead) must be present
        $this->assertContains($this->pm->id, $userIds);
        $this->assertContains($this->lead->id, $userIds);

        // Non-project member must be excluded
        $this->assertNotContains($this->member->id, $userIds);
    }

    public function test_assignees_endpoint_filters_by_search_query(): void
    {
        $response = $this->actingAs($this->admin)->getJson('/api/v1/tasks/assignees?search=alex');

        $response->assertOk();
        $users = collect($response->json('data'));

        $this->assertTrue($users->contains('id', $this->lead->id));
        $this->assertFalse($users->contains('id', $this->pm->id));
        $this->assertFalse($users->contains('id', $this->member->id));

        // Search by email
        $emailResponse = $this->actingAs($this->admin)->getJson('/api/v1/tasks/assignees?search=david@hirgal.test');
        $emailResponse->assertOk();
        $emailUsers = collect($emailResponse->json('data'));

        $this->assertTrue($emailUsers->contains('id', $this->member->id));
        $this->assertFalse($emailUsers->contains('id', $this->admin->id));
    }

    public function test_assignees_endpoint_rejects_unauthorized_project_access(): void
    {
        // Member has no access to a private project
        $otherOwner = User::factory()->create();
        $privateProject = Project::factory()->create(['owner_id' => $otherOwner->id]);

        $response = $this->actingAs($this->member)->getJson("/api/v1/tasks/assignees?project={$privateProject->uuid}");

        $response->assertNotFound();
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/v1/tasks/assignees');

        $response->assertUnauthorized();
    }
}
