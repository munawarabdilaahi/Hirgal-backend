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
use Illuminate\Support\Str;
use Tests\TestCase;

class TeamManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $pm;

    protected User $lead;

    protected User $member;

    protected Role $memberRole;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);

        $pmRole = Role::where('slug', UserRole::ProjectManager->value)->first();
        $leadRole = Role::where('slug', UserRole::TeamLeader->value)->first();
        $this->memberRole = Role::where('slug', UserRole::Member->value)->first();

        $this->admin = User::factory()->create(['name' => 'Admin User']);
        $this->admin->roles()->attach(Role::where('slug', UserRole::SystemAdmin->value)->first()->id);

        $this->pm = User::factory()->create(['name' => 'Project Manager']);
        $this->pm->roles()->attach($pmRole->id);

        $this->lead = User::factory()->create(['name' => 'Team Leader User']);
        $this->lead->roles()->attach($leadRole->id);

        $this->member = User::factory()->create(['name' => 'Standard Member']);
        $this->member->roles()->attach($this->memberRole->id);
    }

    /**
     * @return array<string, string>
     */
    protected function auth(User $user, string $label = 'session'): array
    {
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer '.$user->createToken($label)->plainTextToken];
    }

    /**
     * Create a team led by the given user with a leader roster row.
     */
    protected function createTeamLedBy(User $leader, array $attributes = []): Team
    {
        $team = Team::factory()->create(array_merge(['leader_id' => $leader->id], $attributes));

        TeamMember::firstOrCreate(
            ['team_id' => $team->id, 'user_id' => $leader->id],
            ['role' => TeamMemberRole::Leader, 'joined_at' => now()]
        );

        return $team;
    }

    public function test_member_without_teams_view_cannot_list_teams(): void
    {
        $this->getJson('/api/v1/teams', $this->auth($this->member, 'member'))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_team_leader_can_list_only_scoped_teams(): void
    {
        $mine = $this->createTeamLedBy($this->lead);
        $this->createTeamLedBy(User::factory()->create());

        $response = $this->getJson('/api/v1/teams', $this->auth($this->lead, 'lead'))
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);

        $this->assertSame(1, $response->json('meta.total'));
        $this->assertSame($mine->uuid, $response->json('data.0.uuid'));
    }

    public function test_system_admin_can_list_all_teams(): void
    {
        $this->createTeamLedBy($this->lead);
        $this->createTeamLedBy(User::factory()->create());

        $response = $this->getJson('/api/v1/teams', $this->auth($this->admin, 'admin'))
            ->assertOk();

        $this->assertSame(2, $response->json('meta.total'));
    }

    public function test_create_team_requires_teams_create_permission(): void
    {
        $this->postJson('/api/v1/teams', ['name' => 'Rogue Team'], $this->auth($this->lead, 'lead'))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_project_manager_can_create_team_with_designated_leader(): void
    {
        $response = $this->postJson('/api/v1/teams', [
            'name' => 'Delivery Guild',
            'description' => 'Cross-functional delivery team.',
            'leader_id' => $this->pm->id,
        ], $this->auth($this->pm, 'pm'))
            ->assertStatus(201)
            ->assertJsonPath('data.name', 'Delivery Guild')
            ->assertJsonPath('data.leader.id', $this->pm->id);

        $teamId = $response->json('data.id');

        $this->assertDatabaseHas('team_members', [
            'team_id' => $teamId,
            'user_id' => $this->pm->id,
            'role' => 'leader',
        ]);
    }

    public function test_create_team_requires_name(): void
    {
        $this->postJson('/api/v1/teams', [], $this->auth($this->pm, 'pm'))
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');
    }

    public function test_member_cannot_create_team(): void
    {
        $this->postJson('/api/v1/teams', ['name' => 'Member Team'], $this->auth($this->member, 'member'))
            ->assertStatus(403);
    }

    public function test_show_team_out_of_scope_returns_404(): void
    {
        $foreign = $this->createTeamLedBy(User::factory()->create());

        $this->getJson('/api/v1/teams/'.$foreign->uuid, $this->auth($this->lead, 'lead'))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_designated_leader_can_view_team(): void
    {
        $team = $this->createTeamLedBy($this->lead);

        $this->getJson('/api/v1/teams/'.$team->uuid, $this->auth($this->lead, 'lead'))
            ->assertOk()
            ->assertJsonPath('data.uuid', $team->uuid)
            ->assertJsonPath('data.leader.id', $this->lead->id);
    }

    public function test_designated_leader_can_update_team_name(): void
    {
        $team = $this->createTeamLedBy($this->lead);

        $this->putJson('/api/v1/teams/'.$team->uuid, ['name' => 'Renamed Guild'], $this->auth($this->lead, 'lead'))
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed Guild');

        $this->assertDatabaseHas('teams', ['id' => $team->id, 'name' => 'Renamed Guild']);
    }

    public function test_leadership_transfer_requires_membership_in_allocated_projects(): void
    {
        $project = Project::factory()->create(['owner_id' => $this->pm->id]);
        ProjectMember::create([
            'project_id' => $project->id,
            'user_id' => $this->pm->id,
            'role' => ProjectMemberRole::Owner,
            'joined_at' => now(),
        ]);
        ProjectMember::create([
            'project_id' => $project->id,
            'user_id' => $this->lead->id,
            'role' => ProjectMemberRole::Member,
            'joined_at' => now(),
        ]);

        $team = $this->createTeamLedBy($this->lead);
        ProjectTeam::create([
            'project_id' => $project->id,
            'team_id' => $team->id,
            'assigned_at' => now(),
        ]);

        $stranger = User::factory()->create();

        $this->putJson('/api/v1/teams/'.$team->uuid, ['leader_id' => $stranger->id], $this->auth($this->lead, 'lead'))
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        $this->assertSame($this->lead->id, $team->fresh()->leader_id);

        $this->putJson('/api/v1/teams/'.$team->uuid, ['leader_id' => $this->pm->id], $this->auth($this->lead, 'lead'))
            ->assertOk()
            ->assertJsonPath('data.leader.id', $this->pm->id);

        $this->assertDatabaseHas('team_members', [
            'team_id' => $team->id,
            'user_id' => $this->pm->id,
            'role' => 'leader',
        ]);
    }

    public function test_delete_team_requires_teams_delete_permission(): void
    {
        $team = $this->createTeamLedBy($this->pm);

        $this->deleteJson('/api/v1/teams/'.$team->uuid, [], $this->auth($this->pm, 'pm'))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'FORBIDDEN');

        $this->assertDatabaseHas('teams', ['id' => $team->id, 'deleted_at' => null]);
    }

    public function test_admin_can_delete_team(): void
    {
        $team = $this->createTeamLedBy($this->lead);

        $this->deleteJson('/api/v1/teams/'.$team->uuid, [], $this->auth($this->admin, 'admin'))
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->assertSoftDeleted('teams', ['id' => $team->id]);
    }

    public function test_unknown_team_uuid_returns_404(): void
    {
        $this->getJson('/api/v1/teams/'.Str::uuid(), $this->auth($this->lead, 'lead'))
            ->assertStatus(404);
    }
}
