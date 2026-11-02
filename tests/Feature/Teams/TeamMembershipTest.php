<?php

namespace Tests\Feature\Teams;

use App\Enums\ProjectMemberRole;
use App\Enums\TeamMemberRole;
use App\Enums\UserRole;
use App\Models\Permission;
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

class TeamMembershipTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $leader;

    protected User $rosterManager;

    protected User $rosterMember;

    protected Team $team;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);

        $pmRole = Role::where('slug', UserRole::ProjectManager->value)->first();
        $memberRole = Role::where('slug', UserRole::Member->value)->first();

        $this->admin = User::factory()->create(['name' => 'Admin User']);
        $this->admin->roles()->attach(Role::where('slug', UserRole::SystemAdmin->value)->first()->id);

        $this->leader = User::factory()->create(['name' => 'Designated Leader']);
        $this->leader->roles()->attach($pmRole->id);

        $this->rosterManager = User::factory()->create(['name' => 'Roster Manager']);
        $this->rosterManager->roles()->attach($pmRole->id);

        $this->rosterMember = User::factory()->create(['name' => 'Roster Member']);
        $this->rosterMember->roles()->attach($memberRole->id);

        $this->team = Team::factory()->create(['leader_id' => $this->leader->id]);

        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $this->leader->id,
            'role' => TeamMemberRole::Leader,
            'joined_at' => now(),
        ]);
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $this->rosterManager->id,
            'role' => TeamMemberRole::Member,
            'joined_at' => now(),
        ]);
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $this->rosterMember->id,
            'role' => TeamMemberRole::Member,
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

    protected function rosterRowFor(User $user): TeamMember
    {
        return TeamMember::where('team_id', $this->team->id)
            ->where('user_id', $user->id)
            ->firstOrFail();
    }

    public function test_roster_member_without_teams_view_cannot_list_members(): void
    {
        $permission = Permission::where('slug', 'teams.view')->first();
        $this->rosterMember->roles()->first()->permissions()->attach($permission->id);

        $this->getJson('/api/v1/teams/'.$this->team->uuid.'/members', $this->auth($this->rosterMember, 'roster'))
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->rosterMember->roles()->first()->permissions()->detach($permission->id);

        $this->getJson('/api/v1/teams/'.$this->team->uuid.'/members', $this->auth($this->rosterMember, 'roster'))
            ->assertStatus(403);
    }

    public function test_member_without_teams_view_cannot_list_members(): void
    {
        $this->getJson('/api/v1/teams/'.$this->team->uuid.'/members', $this->auth($this->rosterMember, 'roster'))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_designated_leader_can_list_members(): void
    {
        $response = $this->getJson('/api/v1/teams/'.$this->team->uuid.'/members', $this->auth($this->leader, 'leader'))
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);

        $this->assertSame(3, $response->json('meta.total'));
    }

    public function test_designated_leader_can_add_member(): void
    {
        $newUser = User::factory()->create();

        $this->postJson('/api/v1/teams/'.$this->team->uuid.'/members', [
            'user_id' => $newUser->id,
            'role' => 'member',
        ], $this->auth($this->leader, 'leader'))
            ->assertStatus(201)
            ->assertJsonPath('data.role', 'member')
            ->assertJsonPath('data.user.id', $newUser->id);

        $this->assertDatabaseHas('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $newUser->id,
            'role' => 'member',
        ]);
    }

    public function test_add_member_to_allocated_team_requires_project_membership(): void
    {
        $project = $this->createProjectWithOwner();
        $this->allocateTeamTo($project);

        $stranger = User::factory()->create();

        $this->postJson('/api/v1/teams/'.$this->team->uuid.'/members', [
            'user_id' => $stranger->id,
            'role' => 'member',
        ], $this->auth($this->leader, 'leader'))
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        $this->assertDatabaseMissing('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $stranger->id,
        ]);
    }

    public function test_add_member_requires_teams_manage_permission(): void
    {
        $permission = Permission::where('slug', 'teams.view')->first();
        $this->rosterMember->roles()->first()->permissions()->attach($permission->id);

        $newUser = User::factory()->create();

        $this->postJson('/api/v1/teams/'.$this->team->uuid.'/members', [
            'user_id' => $newUser->id,
            'role' => 'member',
        ], $this->auth($this->rosterMember, 'roster'))
            ->assertStatus(403);

        $this->assertDatabaseMissing('team_members', [
            'team_id' => $this->team->id,
            'user_id' => $newUser->id,
        ]);
    }

    public function test_roster_role_can_be_updated_by_authority(): void
    {
        $row = $this->rosterRowFor($this->rosterMember);

        $this->putJson(
            '/api/v1/teams/'.$this->team->uuid.'/members/'.$row->id,
            ['role' => 'leader'],
            $this->auth($this->leader, 'leader')
        )
            ->assertOk()
            ->assertJsonPath('data.role', 'leader');

        $this->assertSame('leader', $row->fresh()->role->value);
    }

    public function test_designated_leader_roster_role_cannot_change(): void
    {
        $row = $this->rosterRowFor($this->leader);

        $this->putJson(
            '/api/v1/teams/'.$this->team->uuid.'/members/'.$row->id,
            ['role' => 'member'],
            $this->auth($this->leader, 'leader')
        )
            ->assertStatus(403);

        $this->assertSame('leader', $row->fresh()->role->value);
    }

    public function test_designated_leader_cannot_be_removed(): void
    {
        $row = $this->rosterRowFor($this->leader);

        $this->deleteJson(
            '/api/v1/teams/'.$this->team->uuid.'/members/'.$row->id,
            [],
            $this->auth($this->admin, 'admin')
        )
            ->assertStatus(403);

        $this->assertDatabaseHas('team_members', ['id' => $row->id]);
    }

    public function test_plain_roster_member_cannot_update_others(): void
    {
        $row = $this->rosterRowFor($this->rosterMember);

        $this->putJson(
            '/api/v1/teams/'.$this->team->uuid.'/members/'.$row->id,
            ['role' => 'leader'],
            $this->auth($this->rosterManager, 'manager')
        )
            ->assertStatus(403);
    }

    public function test_roster_member_can_be_removed(): void
    {
        $row = $this->rosterRowFor($this->rosterMember);

        $this->deleteJson(
            '/api/v1/teams/'.$this->team->uuid.'/members/'.$row->id,
            [],
            $this->auth($this->leader, 'leader')
        )
            ->assertOk()
            ->assertJsonPath('data.user.id', $this->rosterMember->id);

        $this->assertDatabaseMissing('team_members', ['id' => $row->id]);
    }

    public function test_out_of_scope_cannot_manage_roster(): void
    {
        $outsider = User::factory()->create();
        $outsider->roles()->attach(Role::where('slug', UserRole::ProjectManager->value)->first()->id);
        $row = $this->rosterRowFor($this->rosterMember);

        $this->deleteJson(
            '/api/v1/teams/'.$this->team->uuid.'/members/'.$row->id,
            [],
            $this->auth($outsider, 'outsider')
        )
            ->assertStatus(404);

        $this->assertDatabaseHas('team_members', ['id' => $row->id]);
    }

    protected function createProjectWithOwner(): Project
    {
        $project = Project::factory()->create(['owner_id' => $this->leader->id]);

        ProjectMember::create([
            'project_id' => $project->id,
            'user_id' => $this->leader->id,
            'role' => ProjectMemberRole::Owner,
            'joined_at' => now(),
        ]);

        return $project;
    }

    protected function allocateTeamTo(Project $project): void
    {
        ProjectTeam::create([
            'project_id' => $project->id,
            'team_id' => $this->team->id,
            'assigned_at' => now(),
        ]);
    }
}
