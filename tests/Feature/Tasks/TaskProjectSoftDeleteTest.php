<?php

namespace Tests\Feature\Tasks;

use App\Enums\ProjectMemberRole;
use App\Enums\TeamMemberRole;
use App\Enums\UserRole;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectTeam;
use App\Models\Role;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskProjectSoftDeleteTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $owner;

    protected User $lead;

    protected User $member;

    protected Project $project;

    protected Project $otherProject;

    protected Task $task;

    protected Task $otherTask;

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

        $this->lead = User::factory()->create(['name' => 'Contextual Lead']);
        $this->lead->roles()->attach($leadRole->id);

        $this->member = User::factory()->create(['name' => 'Contextual Member']);
        $this->member->roles()->attach($memberRole->id);

        $this->project = Project::factory()->create(['owner_id' => $this->owner->id]);

        foreach ([
            [$this->owner, ProjectMemberRole::Owner],
            [$this->lead, ProjectMemberRole::Lead],
            [$this->member, ProjectMemberRole::Member],
        ] as [$user, $role]) {
            ProjectMember::create([
                'project_id' => $this->project->id,
                'user_id' => $user->id,
                'role' => $role,
                'joined_at' => now(),
            ]);
        }

        $this->task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->owner->id,
        ]);

        $this->otherProject = Project::factory()->create(['owner_id' => $this->owner->id]);

        foreach ([
            [$this->owner, ProjectMemberRole::Owner],
            [$this->member, ProjectMemberRole::Member],
        ] as [$user, $role]) {
            ProjectMember::create([
                'project_id' => $this->otherProject->id,
                'user_id' => $user->id,
                'role' => $role,
                'joined_at' => now(),
            ]);
        }

        $this->otherTask = Task::factory()->create([
            'project_id' => $this->otherProject->id,
            'creator_id' => $this->owner->id,
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

    protected function softDeletePrimaryProject(): void
    {
        $this->deleteJson('/api/v1/projects/'.$this->project->uuid, [], $this->auth($this->owner, 'owner'))
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->assertSoftDeleted('projects', ['id' => $this->project->id]);
    }

    public function test_get_task_of_soft_deleted_project_returns_404(): void
    {
        $this->softDeletePrimaryProject();

        $this->getJson('/api/v1/tasks/'.$this->task->uuid, $this->auth($this->member, 'member'))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');

        $this->getJson('/api/v1/tasks/'.$this->task->uuid, $this->auth($this->admin, 'admin'))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_update_task_of_soft_deleted_project_returns_404(): void
    {
        $originalTitle = $this->task->title;

        $this->softDeletePrimaryProject();

        $this->putJson('/api/v1/tasks/'.$this->task->uuid, ['title' => 'Nope'], $this->auth($this->lead, 'lead'))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');

        $this->putJson('/api/v1/tasks/'.$this->task->uuid, ['title' => 'Nope'], $this->auth($this->admin, 'admin'))
            ->assertStatus(404);

        $this->assertSame($originalTitle, $this->task->fresh()->title);
    }

    public function test_delete_task_of_soft_deleted_project_returns_404_and_keeps_task(): void
    {
        $this->softDeletePrimaryProject();

        $this->deleteJson('/api/v1/tasks/'.$this->task->uuid, [], $this->auth($this->owner, 'owner'))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');

        $this->deleteJson('/api/v1/tasks/'.$this->task->uuid, [], $this->auth($this->admin, 'admin'))
            ->assertStatus(404);

        $this->assertDatabaseHas('tasks', [
            'id' => $this->task->id,
            'deleted_at' => null,
        ]);
    }

    public function test_assign_task_of_soft_deleted_project_returns_404(): void
    {
        $this->softDeletePrimaryProject();

        $this->postJson('/api/v1/tasks/'.$this->task->uuid.'/assign', [
            'user_ids' => [$this->member->id],
        ], $this->auth($this->lead, 'lead'))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');

        $this->postJson('/api/v1/tasks/'.$this->task->uuid.'/assign', [
            'user_ids' => [$this->member->id],
        ], $this->auth($this->admin, 'admin'))
            ->assertStatus(404);

        $this->assertDatabaseMissing('task_assignments', [
            'task_id' => $this->task->id,
            'user_id' => $this->member->id,
        ]);
    }

    public function test_unassign_task_of_soft_deleted_project_returns_404_and_keeps_assignment(): void
    {
        TaskAssignment::create([
            'task_id' => $this->task->id,
            'user_id' => $this->member->id,
            'assigned_by' => $this->owner->id,
            'assigned_at' => now(),
        ]);

        $this->softDeletePrimaryProject();

        $this->deleteJson(
            '/api/v1/tasks/'.$this->task->uuid.'/assignees/'.$this->member->id,
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');

        $this->deleteJson(
            '/api/v1/tasks/'.$this->task->uuid.'/assignees/'.$this->member->id,
            [],
            $this->auth($this->admin, 'admin')
        )
            ->assertStatus(404);

        $this->assertDatabaseHas('task_assignments', [
            'task_id' => $this->task->id,
            'user_id' => $this->member->id,
        ]);
    }

    public function test_task_list_excludes_tasks_of_soft_deleted_projects(): void
    {
        $this->getJson('/api/v1/tasks', $this->auth($this->member, 'member'))
            ->assertOk()
            ->assertJsonPath('meta.total', 2);

        $this->softDeletePrimaryProject();

        $memberList = $this->getJson('/api/v1/tasks', $this->auth($this->member, 'member'))
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.uuid', $this->otherTask->uuid);

        $this->assertNotNull($memberList->json('data.0.project'));

        $this->getJson('/api/v1/tasks', $this->auth($this->admin, 'admin'))
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.uuid', $this->otherTask->uuid);
    }

    public function test_project_specific_task_list_respects_soft_deletion(): void
    {
        $this->getJson('/api/v1/tasks?project='.$this->project->uuid, $this->auth($this->member, 'member'))
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->softDeletePrimaryProject();

        $this->getJson('/api/v1/tasks?project='.$this->project->uuid, $this->auth($this->member, 'member'))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_team_filtered_task_list_excludes_tasks_of_soft_deleted_projects(): void
    {
        $team = Team::factory()->create(['leader_id' => $this->lead->id]);

        foreach ([
            [$this->lead, TeamMemberRole::Leader],
            [$this->member, TeamMemberRole::Member],
            [$this->owner, TeamMemberRole::Member],
        ] as [$user, $role]) {
            TeamMember::create([
                'team_id' => $team->id,
                'user_id' => $user->id,
                'role' => $role,
                'joined_at' => now(),
            ]);
        }

        ProjectTeam::create([
            'project_id' => $this->project->id,
            'team_id' => $team->id,
            'assigned_at' => now(),
        ]);

        $this->getJson('/api/v1/tasks?team='.$team->uuid, $this->auth($this->member, 'member'))
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.uuid', $this->task->uuid);

        $this->softDeletePrimaryProject();

        $this->getJson('/api/v1/tasks?team='.$team->uuid, $this->auth($this->member, 'member'))
            ->assertOk()
            ->assertJsonPath('meta.total', 0)
            ->assertJsonPath('data', []);
    }

    public function test_restoring_project_restores_task_visibility(): void
    {
        $this->softDeletePrimaryProject();

        $this->getJson('/api/v1/tasks/'.$this->task->uuid, $this->auth($this->member, 'member'))
            ->assertStatus(404);

        $this->getJson('/api/v1/tasks', $this->auth($this->member, 'member'))
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->postJson('/api/v1/projects/'.$this->project->uuid.'/restore', [], $this->auth($this->owner, 'owner'))
            ->assertOk()
            ->assertJsonPath('data.uuid', $this->project->uuid);

        $this->getJson('/api/v1/tasks/'.$this->task->uuid, $this->auth($this->member, 'member'))
            ->assertOk()
            ->assertJsonPath('data.uuid', $this->task->uuid);

        $this->getJson('/api/v1/tasks', $this->auth($this->member, 'member'))
            ->assertOk()
            ->assertJsonPath('meta.total', 2);
    }

    public function test_non_numeric_assignee_identifier_returns_validation_error(): void
    {
        $this->deleteJson(
            '/api/v1/tasks/'.$this->task->uuid.'/assignees/abc',
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        $this->deleteJson(
            '/api/v1/tasks/'.$this->task->uuid.'/assignees/abc',
            [],
            $this->auth($this->admin, 'admin')
        )
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        $this->assertSame(0, TaskAssignment::count());
    }

    public function test_valid_unassign_flow_remains_operational(): void
    {
        TaskAssignment::create([
            'task_id' => $this->task->id,
            'user_id' => $this->member->id,
            'assigned_by' => $this->owner->id,
            'assigned_at' => now(),
        ]);

        $this->deleteJson(
            '/api/v1/tasks/'.$this->task->uuid.'/assignees/'.$this->member->id,
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertOk()
            ->assertJsonPath('data.uuid', $this->task->uuid)
            ->assertJsonPath('data.assignees', []);

        $this->assertDatabaseMissing('task_assignments', [
            'task_id' => $this->task->id,
            'user_id' => $this->member->id,
        ]);
    }

    public function test_nonexistent_numeric_assignee_returns_404(): void
    {
        $this->deleteJson(
            '/api/v1/tasks/'.$this->task->uuid.'/assignees/999999',
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_unauthorized_member_cannot_unassign_on_active_project(): void
    {
        TaskAssignment::create([
            'task_id' => $this->task->id,
            'user_id' => $this->lead->id,
            'assigned_by' => $this->owner->id,
            'assigned_at' => now(),
        ]);

        $this->deleteJson(
            '/api/v1/tasks/'.$this->task->uuid.'/assignees/'.$this->lead->id,
            [],
            $this->auth($this->member, 'member')
        )
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'FORBIDDEN');

        $this->assertDatabaseHas('task_assignments', [
            'task_id' => $this->task->id,
            'user_id' => $this->lead->id,
        ]);
    }
}
