<?php

namespace Tests\Feature\Projects;

use App\Enums\AccountStatus;
use App\Enums\ProjectMemberRole;
use App\Enums\ProjectStatus;
use App\Enums\UserRole;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProjectManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $pm;

    protected User $member;

    protected Role $pmRole;

    protected Role $memberRole;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);

        $this->pmRole = Role::where('slug', UserRole::ProjectManager->value)->first();
        $this->memberRole = Role::where('slug', UserRole::Member->value)->first();

        $this->admin = User::factory()->create(['name' => 'Admin User']);
        $this->admin->roles()->attach(Role::where('slug', UserRole::SystemAdmin->value)->first()->id);

        $this->pm = User::factory()->create(['name' => 'Project Manager']);
        $this->pm->roles()->attach($this->pmRole->id);

        $this->member = User::factory()->create(['name' => 'Standard Member']);
        $this->member->roles()->attach($this->memberRole->id);
    }

    /**
     * Build per-request auth headers.
     *
     * Cached auth guards are flushed first because the test application instance
     * is shared between requests and RequestGuard memoizes the resolved user.
     *
     * @return array<string, string>
     */
    protected function auth(User $user, string $label = 'session'): array
    {
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer '.$user->createToken($label)->plainTextToken];
    }

    protected function createProjectFor(User $owner, array $attributes = []): Project
    {
        $project = Project::factory()->create(array_merge(['owner_id' => $owner->id], $attributes));

        ProjectMember::create([
            'project_id' => $project->id,
            'user_id' => $owner->id,
            'role' => ProjectMemberRole::Owner,
            'joined_at' => now(),
        ]);

        return $project;
    }

    protected function addProjectMember(Project $project, User $user, ProjectMemberRole $role): ProjectMember
    {
        return ProjectMember::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'role' => $role,
            'joined_at' => now(),
        ]);
    }

    public function test_unauthenticated_request_receives_401(): void
    {
        $this->getJson('/api/v1/projects')
            ->assertStatus(401)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'UNAUTHENTICATED');
    }

    public function test_suspended_account_receives_403(): void
    {
        $suspended = User::factory()->create(['account_status' => AccountStatus::Suspended]);
        $suspended->roles()->attach($this->memberRole->id);

        $this->getJson('/api/v1/projects', $this->auth($suspended, 'suspended'))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'ACCOUNT_NOT_ACTIVE');
    }

    public function test_member_can_list_only_their_own_projects(): void
    {
        $mine = $this->createProjectFor($this->pm);
        $this->addProjectMember($mine, $this->member, ProjectMemberRole::Member);

        $foreign = $this->createProjectFor(User::factory()->create());

        $response = $this->getJson('/api/v1/projects', $this->auth($this->member, 'member'))
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);

        $this->assertSame(1, $response->json('meta.total'));
        $this->assertSame($mine->uuid, $response->json('data.0.uuid'));
        $this->assertNotSame($foreign->uuid, $response->json('data.0.uuid'));
    }

    public function test_system_admin_can_list_all_projects(): void
    {
        $this->createProjectFor($this->pm);
        $this->createProjectFor(User::factory()->create());

        $response = $this->getJson('/api/v1/projects', $this->auth($this->admin, 'admin'))
            ->assertOk();

        $this->assertSame(2, $response->json('meta.total'));
    }

    public function test_project_create_requires_projects_create_permission(): void
    {
        $this->postJson('/api/v1/projects', ['name' => 'Nope Project'], $this->auth($this->member, 'member'))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_project_manager_can_create_project(): void
    {
        $response = $this->postJson('/api/v1/projects', [
            'name' => 'New Phase Project',
            'description' => 'Created through the API.',
            'priority' => 'high',
        ], $this->auth($this->pm, 'pm'))
            ->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'New Phase Project')
            ->assertJsonPath('data.priority', 'high')
            ->assertJsonPath('data.status', 'planning')
            ->assertJsonPath('data.owner.id', $this->pm->id)
            ->assertJsonPath('data.members_count', 1);

        $this->assertDatabaseHas('projects', [
            'uuid' => $response->json('data.uuid'),
            'owner_id' => $this->pm->id,
        ]);
    }

    public function test_create_project_requires_name(): void
    {
        $this->postJson('/api/v1/projects', [], $this->auth($this->pm, 'pm'))
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');
    }

    public function test_cross_tenant_project_returns_404_on_show(): void
    {
        $foreign = $this->createProjectFor(User::factory()->create());

        $this->getJson('/api/v1/projects/'.$foreign->uuid, $this->auth($this->member, 'member'))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_project_owner_can_update_project(): void
    {
        $project = $this->createProjectFor($this->pm);

        $this->putJson('/api/v1/projects/'.$project->uuid, [
            'name' => 'Renamed Project',
            'priority' => 'urgent',
        ], $this->auth($this->pm, 'pm'))
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed Project')
            ->assertJsonPath('data.priority', 'urgent');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'name' => 'Renamed Project',
        ]);
    }

    public function test_member_without_contextual_authority_cannot_update_project(): void
    {
        $project = $this->createProjectFor($this->pm);
        $this->addProjectMember($project, $this->member, ProjectMemberRole::Member);

        $this->putJson('/api/v1/projects/'.$project->uuid, ['name' => 'Hijacked'], $this->auth($this->member, 'member'))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_update_project_to_completed_sets_completed_at(): void
    {
        $project = $this->createProjectFor($this->pm, ['completed_at' => null]);

        $response = $this->putJson('/api/v1/projects/'.$project->uuid, ['status' => 'completed'], $this->auth($this->pm, 'pm'))
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->assertNotNull($response->json('data.completed_at'));
    }

    public function test_update_project_away_from_completed_clears_completed_at(): void
    {
        $project = $this->createProjectFor($this->pm, [
            'status' => ProjectStatus::Completed,
            'completed_at' => now(),
        ]);

        $response = $this->putJson('/api/v1/projects/'.$project->uuid, ['status' => 'active'], $this->auth($this->pm, 'pm'))
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $this->assertNull($response->json('data.completed_at'));
    }

    public function test_archive_project_transitions_status(): void
    {
        $project = $this->createProjectFor($this->pm);

        $this->postJson('/api/v1/projects/'.$project->uuid.'/archive', [], $this->auth($this->pm, 'pm'))
            ->assertOk()
            ->assertJsonPath('data.status', 'archived');

        $this->assertSame('archived', $project->fresh()->status->value);
    }

    public function test_member_cannot_archive_project(): void
    {
        $project = $this->createProjectFor($this->pm);
        $this->addProjectMember($project, $this->member, ProjectMemberRole::Member);

        $this->postJson('/api/v1/projects/'.$project->uuid.'/archive', [], $this->auth($this->member, 'member'))
            ->assertStatus(403);
    }

    public function test_soft_deleted_project_returns_404_on_show(): void
    {
        $project = $this->createProjectFor($this->pm);

        $this->deleteJson('/api/v1/projects/'.$project->uuid, [], $this->auth($this->pm, 'pm'))
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->getJson('/api/v1/projects/'.$project->uuid, $this->auth($this->pm, 'pm'))
            ->assertStatus(404);

        $this->assertSoftDeleted('projects', ['id' => $project->id]);
    }

    public function test_project_owner_can_restore_soft_deleted_project(): void
    {
        $project = $this->createProjectFor($this->pm);

        $this->deleteJson('/api/v1/projects/'.$project->uuid, [], $this->auth($this->pm, 'pm'))
            ->assertOk();

        $this->postJson('/api/v1/projects/'.$project->uuid.'/restore', [], $this->auth($this->pm, 'pm'))
            ->assertOk()
            ->assertJsonPath('data.uuid', $project->uuid);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'deleted_at' => null,
        ]);
    }

    public function test_contextual_lead_cannot_restore_or_delete_project(): void
    {
        $lead = User::factory()->create(['name' => 'Contextual Lead']);
        $lead->roles()->attach($this->pmRole->id);

        $project = $this->createProjectFor($this->pm);
        $this->addProjectMember($project, $lead, ProjectMemberRole::Lead);

        $this->deleteJson('/api/v1/projects/'.$project->uuid, [], $this->auth($lead, 'lead'))
            ->assertStatus(403);

        $this->deleteJson('/api/v1/projects/'.$project->uuid, [], $this->auth($this->pm, 'pm'))
            ->assertOk();

        $this->postJson('/api/v1/projects/'.$project->uuid.'/restore', [], $this->auth($lead, 'lead'))
            ->assertStatus(403);
    }

    public function test_unknown_uuid_returns_404(): void
    {
        $this->getJson('/api/v1/projects/'.Str::uuid(), $this->auth($this->pm, 'pm'))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_numeric_id_is_not_accepted_as_project_identifier(): void
    {
        $project = $this->createProjectFor($this->pm);

        $this->getJson('/api/v1/projects/'.$project->id, $this->auth($this->pm, 'pm'))
            ->assertStatus(404);
    }
}
