<?php

namespace Tests\Feature\Teams;

use App\Enums\ProjectMemberRole;
use App\Enums\TeamMemberRole;
use App\Enums\UserRole;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectTeam;
use App\Models\Role;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeamProjectAllocationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $owner;

    protected User $teamLeader;

    protected User $member;

    protected Project $project;

    protected Team $team;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);

        $pmRole = Role::where('slug', UserRole::ProjectManager->value)->first();
        $leadRole = Role::where('slug', UserRole::TeamLeader->value)->first();
        $memberRole = Role::where('slug', UserRole::Member->value)->first();

        $this->admin = User::factory()->create(['name' => 'Admin User']);
        $this->admin->roles()->attach(Role::where('slug', UserRole::SystemAdmin->value)->first()->id);

        $this->owner = User::factory()->create(['name' => 'Project Owner']);
        $this->owner->roles()->attach($pmRole->id);

        $this->teamLeader = User::factory()->create(['name' => 'Team Leader']);
        $this->teamLeader->roles()->attach($leadRole->id);

        $this->member = User::factory()->create(['name' => 'Project Member']);
        $this->member->roles()->attach($memberRole->id);

        $this->project = Project::factory()->create(['owner_id' => $this->owner->id]);

        foreach ([
            [$this->owner, ProjectMemberRole::Owner],
            [$this->member, ProjectMemberRole::Member],
            [$this->teamLeader, ProjectMemberRole::Member],
        ] as [$user, $role]) {
            ProjectMember::create([
                'project_id' => $this->project->id,
                'user_id' => $user->id,
                'role' => $role,
                'joined_at' => now(),
            ]);
        }

        $this->team = Team::factory()->create(['leader_id' => $this->teamLeader->id]);
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $this->teamLeader->id,
            'role' => TeamMemberRole::Leader,
            'joined_at' => now(),
        ]);
    }

    /**
     * @return array<string, string>
     */
    protected function auth(User $user, string $label = 'session'): array
    {
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer '.$user->createToken($label)->plainTextToken];
    }

    public function test_project_owner_in_roster_can_allocate_team(): void
    {
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $this->owner->id,
            'role' => TeamMemberRole::Member,
            'joined_at' => now(),
        ]);

        $this->postJson(
            '/api/v1/projects/'.$this->project->uuid.'/teams/'.$this->team->uuid,
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertStatus(201)
            ->assertJsonPath('data.uuid', $this->team->uuid);

        $this->assertDatabaseHas('project_teams', [
            'project_id' => $this->project->id,
            'team_id' => $this->team->id,
        ]);
    }

    public function test_allocate_requires_projects_update_permission(): void
    {
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $this->member->id,
            'role' => TeamMemberRole::Member,
            'joined_at' => now(),
        ]);

        $this->postJson(
            '/api/v1/projects/'.$this->project->uuid.'/teams/'.$this->team->uuid,
            [],
            $this->auth($this->member, 'member')
        )
            ->assertStatus(403);

        $this->assertDatabaseMissing('project_teams', [
            'project_id' => $this->project->id,
            'team_id' => $this->team->id,
        ]);
    }

    public function test_team_leader_without_projects_update_cannot_allocate(): void
    {
        $this->postJson(
            '/api/v1/projects/'.$this->project->uuid.'/teams/'.$this->team->uuid,
            [],
            $this->auth($this->teamLeader, 'team-leader')
        )
            ->assertStatus(403);
    }

    public function test_actor_out_of_team_scope_cannot_allocate(): void
    {
        $this->postJson(
            '/api/v1/projects/'.$this->project->uuid.'/teams/'.$this->team->uuid,
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_allocate_fails_when_roster_not_in_project(): void
    {
        $outsider = User::factory()->create();

        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $this->owner->id,
            'role' => TeamMemberRole::Member,
            'joined_at' => now(),
        ]);
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $outsider->id,
            'role' => TeamMemberRole::Member,
            'joined_at' => now(),
        ]);

        $this->postJson(
            '/api/v1/projects/'.$this->project->uuid.'/teams/'.$this->team->uuid,
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        $this->assertDatabaseMissing('project_teams', [
            'project_id' => $this->project->id,
            'team_id' => $this->team->id,
        ]);
    }

    public function test_invariants_apply_to_system_admin(): void
    {
        $outsider = User::factory()->create();
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $outsider->id,
            'role' => TeamMemberRole::Member,
            'joined_at' => now(),
        ]);

        $this->postJson(
            '/api/v1/projects/'.$this->project->uuid.'/teams/'.$this->team->uuid,
            [],
            $this->auth($this->admin, 'admin')
        )
            ->assertStatus(422);

        $this->assertDatabaseMissing('project_teams', [
            'project_id' => $this->project->id,
            'team_id' => $this->team->id,
        ]);
    }

    public function test_allocate_out_of_scope_team_returns_404(): void
    {
        $foreignTeam = Team::factory()->create(['leader_id' => User::factory()->create()->id]);

        $this->postJson(
            '/api/v1/projects/'.$this->project->uuid.'/teams/'.$foreignTeam->uuid,
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_project_team_list_requires_teams_view(): void
    {
        $this->allocateDirectly();

        $this->getJson('/api/v1/projects/'.$this->project->uuid.'/teams', $this->auth($this->member, 'member'))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_project_team_list_returns_allocated_teams(): void
    {
        $this->allocateDirectly();

        $response = $this->getJson(
            '/api/v1/projects/'.$this->project->uuid.'/teams',
            $this->auth($this->owner, 'owner')
        )
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertCount(1, $response->json('data'));
        $this->assertSame($this->team->uuid, $response->json('data.0.uuid'));
        $this->assertSame($this->teamLeader->id, $response->json('data.0.leader.id'));
    }

    public function test_deallocate_team(): void
    {
        $this->allocateDirectly();

        $this->deleteJson(
            '/api/v1/projects/'.$this->project->uuid.'/teams/'.$this->team->uuid,
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->assertDatabaseMissing('project_teams', [
            'project_id' => $this->project->id,
            'team_id' => $this->team->id,
        ]);
    }

    public function test_deallocate_unallocated_team_returns_404(): void
    {
        $this->deleteJson(
            '/api/v1/projects/'.$this->project->uuid.'/teams/'.$this->team->uuid,
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertStatus(404);
    }

    public function test_actor_out_of_project_scope_cannot_see_allocation(): void
    {
        $this->allocateDirectly();

        $outsider = User::factory()->create();
        $outsider->roles()->attach(Role::where('slug', UserRole::ProjectManager->value)->first()->id);

        $this->getJson('/api/v1/projects/'.$this->project->uuid.'/teams', $this->auth($outsider, 'outsider'))
            ->assertStatus(404);
    }

    protected function allocateDirectly(): void
    {
        ProjectTeam::create([
            'project_id' => $this->project->id,
            'team_id' => $this->team->id,
            'assigned_at' => now(),
        ]);
    }
}
