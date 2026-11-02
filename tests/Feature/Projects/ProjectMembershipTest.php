<?php

namespace Tests\Feature\Projects;

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

class ProjectMembershipTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $owner;

    protected User $lead;

    protected User $member;

    protected User $outsider;

    protected Project $project;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);

        $pmRole = Role::where('slug', UserRole::ProjectManager->value)->first();
        $memberRole = Role::where('slug', UserRole::Member->value)->first();

        $this->admin = User::factory()->create(['name' => 'Admin User']);
        $this->admin->roles()->attach(Role::where('slug', UserRole::SystemAdmin->value)->first()->id);

        $this->owner = User::factory()->create(['name' => 'Project Owner']);
        $this->owner->roles()->attach($pmRole->id);

        $this->lead = User::factory()->create(['name' => 'Project Lead']);
        $this->lead->roles()->attach($pmRole->id);

        $this->member = User::factory()->create(['name' => 'Project Member']);
        $this->member->roles()->attach($memberRole->id);

        $this->outsider = User::factory()->create(['name' => 'Outsider User']);
        $this->outsider->roles()->attach($memberRole->id);

        $this->project = Project::factory()->create(['owner_id' => $this->owner->id]);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->owner->id,
            'role' => ProjectMemberRole::Owner,
            'joined_at' => now(),
        ]);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->lead->id,
            'role' => ProjectMemberRole::Lead,
            'joined_at' => now(),
        ]);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member->id,
            'role' => ProjectMemberRole::Member,
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

    protected function memberRowFor(User $user): ProjectMember
    {
        return ProjectMember::where('project_id', $this->project->id)
            ->where('user_id', $user->id)
            ->firstOrFail();
    }

    public function test_owner_can_add_member_with_member_role(): void
    {
        $newUser = User::factory()->create();

        $response = $this->postJson('/api/v1/projects/'.$this->project->uuid.'/members', [
            'user_id' => $newUser->id,
            'role' => 'member',
        ], $this->auth($this->owner, 'owner'))
            ->assertStatus(201)
            ->assertJsonPath('data.role', 'member')
            ->assertJsonPath('data.user.id', $newUser->id);

        $this->assertDatabaseHas('project_members', [
            'project_id' => $this->project->id,
            'user_id' => $newUser->id,
            'role' => 'member',
        ]);

        $this->assertNotNull($response->json('data.joined_at'));
    }

    public function test_add_member_requires_projects_invite_permission(): void
    {
        $newUser = User::factory()->create();

        $this->postJson('/api/v1/projects/'.$this->project->uuid.'/members', [
            'user_id' => $newUser->id,
            'role' => 'member',
        ], $this->auth($this->member, 'member'))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_add_member_rejects_owner_role(): void
    {
        $newUser = User::factory()->create();

        $this->postJson('/api/v1/projects/'.$this->project->uuid.'/members', [
            'user_id' => $newUser->id,
            'role' => 'owner',
        ], $this->auth($this->owner, 'owner'))
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');
    }

    public function test_add_existing_member_returns_422(): void
    {
        $this->postJson('/api/v1/projects/'.$this->project->uuid.'/members', [
            'user_id' => $this->member->id,
            'role' => 'viewer',
        ], $this->auth($this->owner, 'owner'))
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');
    }

    public function test_lead_cannot_grant_lead_role(): void
    {
        $newUser = User::factory()->create();

        $this->postJson('/api/v1/projects/'.$this->project->uuid.'/members', [
            'user_id' => $newUser->id,
            'role' => 'lead',
        ], $this->auth($this->lead, 'lead'))
            ->assertStatus(403);
    }

    public function test_lead_can_add_member_with_member_role(): void
    {
        $newUser = User::factory()->create();

        $this->postJson('/api/v1/projects/'.$this->project->uuid.'/members', [
            'user_id' => $newUser->id,
            'role' => 'member',
        ], $this->auth($this->lead, 'lead'))
            ->assertStatus(201)
            ->assertJsonPath('data.role', 'member');
    }

    public function test_out_of_scope_member_list_returns_404(): void
    {
        $this->getJson('/api/v1/projects/'.$this->project->uuid.'/members', $this->auth($this->outsider, 'outsider'))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_member_list_returns_full_roster(): void
    {
        $response = $this->getJson('/api/v1/projects/'.$this->project->uuid.'/members', $this->auth($this->owner, 'owner'))
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);

        $this->assertSame(3, $response->json('meta.total'));
    }

    public function test_update_member_role_success(): void
    {
        $memberRow = $this->memberRowFor($this->member);

        $this->putJson(
            '/api/v1/projects/'.$this->project->uuid.'/members/'.$memberRow->id,
            ['role' => 'viewer'],
            $this->auth($this->owner, 'owner')
        )
            ->assertOk()
            ->assertJsonPath('data.role', 'viewer');

        $this->assertSame('viewer', $memberRow->fresh()->role->value);
    }

    public function test_update_owner_membership_row_rejected(): void
    {
        $ownerRow = $this->memberRowFor($this->owner);

        $this->putJson(
            '/api/v1/projects/'.$this->project->uuid.'/members/'.$ownerRow->id,
            ['role' => 'member'],
            $this->auth($this->owner, 'owner')
        )
            ->assertStatus(403);
    }

    public function test_lead_cannot_grant_lead_role_on_update(): void
    {
        $memberRow = $this->memberRowFor($this->member);

        $this->putJson(
            '/api/v1/projects/'.$this->project->uuid.'/members/'.$memberRow->id,
            ['role' => 'lead'],
            $this->auth($this->lead, 'lead')
        )
            ->assertStatus(403);

        $this->assertSame('member', $memberRow->fresh()->role->value);
    }

    public function test_member_from_another_project_cannot_be_targeted(): void
    {
        $foreignProject = Project::factory()->create(['owner_id' => $this->outsider->id]);
        $foreignRow = ProjectMember::create([
            'project_id' => $foreignProject->id,
            'user_id' => $this->outsider->id,
            'role' => ProjectMemberRole::Member,
            'joined_at' => now(),
        ]);

        $this->putJson(
            '/api/v1/projects/'.$this->project->uuid.'/members/'.$foreignRow->id,
            ['role' => 'viewer'],
            $this->auth($this->owner, 'owner')
        )
            ->assertStatus(404);
    }

    public function test_remove_member_success(): void
    {
        $memberRow = $this->memberRowFor($this->member);

        $this->deleteJson(
            '/api/v1/projects/'.$this->project->uuid.'/members/'.$memberRow->id,
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.removed_teams', []);

        $this->assertDatabaseMissing('project_members', ['id' => $memberRow->id]);
    }

    public function test_remove_owner_membership_rejected(): void
    {
        $ownerRow = $this->memberRowFor($this->owner);

        $this->deleteJson(
            '/api/v1/projects/'.$this->project->uuid.'/members/'.$ownerRow->id,
            [],
            $this->auth($this->lead, 'lead')
        )
            ->assertStatus(403);

        $this->assertDatabaseHas('project_members', ['id' => $ownerRow->id]);
    }

    public function test_admin_can_remove_owner_membership(): void
    {
        $ownerRow = $this->memberRowFor($this->owner);

        $this->deleteJson(
            '/api/v1/projects/'.$this->project->uuid.'/members/'.$ownerRow->id,
            [],
            $this->auth($this->admin, 'admin')
        )
            ->assertOk();

        $this->assertDatabaseMissing('project_members', ['id' => $ownerRow->id]);
    }

    public function test_remove_member_cascades_team_roster(): void
    {
        $team = $this->createAllocatedTeam($this->owner, [$this->owner, $this->member]);
        $memberRow = $this->memberRowFor($this->member);

        $response = $this->deleteJson(
            '/api/v1/projects/'.$this->project->uuid.'/members/'.$memberRow->id,
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertOk();

        $this->assertSame([$team->name], $response->json('meta.removed_teams'));
        $this->assertDatabaseMissing('team_members', [
            'team_id' => $team->id,
            'user_id' => $this->member->id,
        ]);
        $this->assertDatabaseHas('team_members', [
            'team_id' => $team->id,
            'user_id' => $this->owner->id,
        ]);
    }

    public function test_remove_designated_team_leader_member_is_blocked(): void
    {
        $team = $this->createAllocatedTeam($this->member, [$this->member, $this->owner]);
        $memberRow = $this->memberRowFor($this->member);

        $this->deleteJson(
            '/api/v1/projects/'.$this->project->uuid.'/members/'.$memberRow->id,
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        $this->assertDatabaseHas('project_members', ['id' => $memberRow->id]);
        $this->assertDatabaseHas('team_members', [
            'team_id' => $team->id,
            'user_id' => $this->member->id,
        ]);
    }

    public function test_outsider_cannot_manage_members(): void
    {
        $memberRow = $this->memberRowFor($this->member);

        $this->deleteJson(
            '/api/v1/projects/'.$this->project->uuid.'/members/'.$memberRow->id,
            [],
            $this->auth($this->outsider, 'outsider')
        )
            ->assertStatus(404);

        $this->assertDatabaseHas('project_members', ['id' => $memberRow->id]);
    }

    /**
     * Create a team whose roster is fully inside the project and allocate it.
     *
     * @param  array<int, User>  $roster
     */
    protected function createAllocatedTeam(User $leader, array $roster): Team
    {
        $team = Team::factory()->create(['leader_id' => $leader->id]);

        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => $leader->id,
            'role' => TeamMemberRole::Leader,
            'joined_at' => now(),
        ]);

        foreach ($roster as $user) {
            TeamMember::firstOrCreate(
                ['team_id' => $team->id, 'user_id' => $user->id],
                ['role' => TeamMemberRole::Member, 'joined_at' => now()]
            );
        }

        ProjectTeam::create([
            'project_id' => $this->project->id,
            'team_id' => $team->id,
            'assigned_at' => now(),
        ]);

        return $team;
    }
}
