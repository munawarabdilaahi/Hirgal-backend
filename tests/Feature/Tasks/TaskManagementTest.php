<?php

namespace Tests\Feature\Tasks;

use App\Enums\ProjectMemberRole;
use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Enums\UserRole;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Role;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class TaskManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $owner;

    protected User $lead;

    protected User $member;

    protected User $taskWorker;

    protected Project $project;

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

        $this->taskWorker = User::factory()->create(['name' => 'Task Worker']);
        $this->taskWorker->roles()->attach($leadRole->id);

        $this->project = Project::factory()->create(['owner_id' => $this->owner->id]);

        foreach ([
            [$this->owner, ProjectMemberRole::Owner],
            [$this->lead, ProjectMemberRole::Lead],
            [$this->member, ProjectMemberRole::Member],
            [$this->taskWorker, ProjectMemberRole::Member],
        ] as [$user, $role]) {
            ProjectMember::create([
                'project_id' => $this->project->id,
                'user_id' => $user->id,
                'role' => $role,
                'joined_at' => now(),
            ]);
        }
    }

    /**
     * @return array<string, string>
     */
    protected function auth(User $user, string $label = 'session'): array
    {
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer '.$user->createToken($label)->plainTextToken];
    }

    public function test_member_can_list_only_scoped_tasks(): void
    {
        Task::factory()->create(['project_id' => $this->project->id, 'creator_id' => $this->owner->id]);

        $foreignProject = Project::factory()->create(['owner_id' => User::factory()->create()->id]);
        Task::factory()->create(['project_id' => $foreignProject->id]);

        $response = $this->getJson('/api/v1/tasks', $this->auth($this->member, 'member'))
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);

        $this->assertSame(1, $response->json('meta.total'));
    }

    public function test_system_admin_can_list_all_tasks(): void
    {
        Task::factory()->create(['project_id' => $this->project->id, 'creator_id' => $this->owner->id]);
        $foreignProject = Project::factory()->create(['owner_id' => User::factory()->create()->id]);
        Task::factory()->create(['project_id' => $foreignProject->id]);

        $response = $this->getJson('/api/v1/tasks', $this->auth($this->admin, 'admin'))
            ->assertOk();

        $this->assertSame(2, $response->json('meta.total'));
    }

    public function test_member_without_tasks_create_cannot_create_task(): void
    {
        $this->postJson('/api/v1/projects/'.$this->project->uuid.'/tasks', [
            'title' => 'Sneaky task',
        ], $this->auth($this->member, 'member'))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_task_worker_with_global_permission_can_create_task(): void
    {
        $response = $this->postJson('/api/v1/projects/'.$this->project->uuid.'/tasks', [
            'title' => 'Ship the feature',
            'priority' => 'high',
            'status' => 'todo',
        ], $this->auth($this->taskWorker, 'worker'))
            ->assertStatus(201)
            ->assertJsonPath('data.title', 'Ship the feature')
            ->assertJsonPath('data.priority', 'high')
            ->assertJsonPath('data.status', 'todo')
            ->assertJsonPath('data.creator.id', $this->taskWorker->id);

        $this->assertDatabaseHas('tasks', [
            'uuid' => $response->json('data.uuid'),
            'project_id' => $this->project->id,
            'creator_id' => $this->taskWorker->id,
        ]);
    }

    public function test_create_task_requires_title(): void
    {
        $this->postJson('/api/v1/projects/'.$this->project->uuid.'/tasks', [], $this->auth($this->lead, 'lead'))
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');
    }

    public function test_create_task_with_parent_from_same_project(): void
    {
        $parent = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->owner->id,
        ]);

        $response = $this->postJson('/api/v1/projects/'.$this->project->uuid.'/tasks', [
            'title' => 'Child task',
            'parent' => $parent->uuid,
        ], $this->auth($this->lead, 'lead'))
            ->assertStatus(201)
            ->assertJsonPath('data.parent.uuid', $parent->uuid);

        $this->assertDatabaseHas('tasks', [
            'uuid' => $response->json('data.uuid'),
            'parent_id' => $parent->id,
        ]);
    }

    public function test_create_task_with_foreign_parent_is_rejected(): void
    {
        $foreignProject = Project::factory()->create(['owner_id' => User::factory()->create()->id]);
        $foreignParent = Task::factory()->create(['project_id' => $foreignProject->id]);

        $this->postJson('/api/v1/projects/'.$this->project->uuid.'/tasks', [
            'title' => 'Cross-project child',
            'parent' => $foreignParent->uuid,
        ], $this->auth($this->lead, 'lead'))
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');
    }

    public function test_create_task_rejects_non_member_assignee(): void
    {
        $stranger = User::factory()->create();

        $this->postJson('/api/v1/projects/'.$this->project->uuid.'/tasks', [
            'title' => 'Assigned task',
            'assignees' => [$stranger->id],
        ], $this->auth($this->lead, 'lead'))
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');
    }

    public function test_create_task_with_project_member_assignee(): void
    {
        $response = $this->postJson('/api/v1/projects/'.$this->project->uuid.'/tasks', [
            'title' => 'Assigned task',
            'assignees' => [$this->member->id],
        ], $this->auth($this->lead, 'lead'))
            ->assertStatus(201);

        $assigneeIds = array_column($response->json('data.assignees'), 'id');
        $this->assertContains($this->member->id, $assigneeIds);
    }

    public function test_viewer_contextual_role_cannot_create_task(): void
    {
        ProjectMember::where('project_id', $this->project->id)
            ->where('user_id', $this->lead->id)
            ->update(['role' => ProjectMemberRole::Viewer]);

        $this->postJson('/api/v1/projects/'.$this->project->uuid.'/tasks', [
            'title' => 'Viewer task',
        ], $this->auth($this->lead, 'lead'))
            ->assertStatus(403);
    }

    public function test_foreign_project_filter_returns_404(): void
    {
        $foreignProject = Project::factory()->create(['owner_id' => User::factory()->create()->id]);

        $this->getJson('/api/v1/tasks?project='.$foreignProject->uuid, $this->auth($this->member, 'member'))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_invalid_project_filter_returns_422(): void
    {
        $this->getJson('/api/v1/tasks?project=not-a-uuid', $this->auth($this->member, 'member'))
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');
    }

    public function test_task_show_out_of_scope_returns_404(): void
    {
        $foreignProject = Project::factory()->create(['owner_id' => User::factory()->create()->id]);
        $foreignTask = Task::factory()->create(['project_id' => $foreignProject->id]);

        $this->getJson('/api/v1/tasks/'.$foreignTask->uuid, $this->auth($this->member, 'member'))
            ->assertStatus(404);
    }

    public function test_task_show_returns_full_relations(): void
    {
        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->owner->id,
        ]);

        $this->getJson('/api/v1/tasks/'.$task->uuid, $this->auth($this->member, 'member'))
            ->assertOk()
            ->assertJsonPath('data.uuid', $task->uuid)
            ->assertJsonPath('data.project.uuid', $this->project->uuid)
            ->assertJsonPath('data.creator.id', $this->owner->id);
    }

    public function test_update_task_to_done_sets_completed_at(): void
    {
        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->owner->id,
            'status' => TaskStatus::InProgress,
            'completed_at' => null,
        ]);

        $response = $this->putJson('/api/v1/tasks/'.$task->uuid, ['status' => 'done'], $this->auth($this->lead, 'lead'))
            ->assertOk()
            ->assertJsonPath('data.status', 'done');

        $this->assertNotNull($response->json('data.completed_at'));
    }

    public function test_update_task_away_from_done_clears_completed_at(): void
    {
        $task = Task::factory()->done()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->owner->id,
        ]);

        $response = $this->putJson('/api/v1/tasks/'.$task->uuid, ['status' => 'todo'], $this->auth($this->lead, 'lead'))
            ->assertOk()
            ->assertJsonPath('data.status', 'todo');

        $this->assertNull($response->json('data.completed_at'));
    }

    public function test_viewer_contextual_role_cannot_update_task(): void
    {
        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->owner->id,
        ]);

        ProjectMember::where('project_id', $this->project->id)
            ->where('user_id', $this->lead->id)
            ->update(['role' => ProjectMemberRole::Viewer]);

        $this->putJson('/api/v1/tasks/'.$task->uuid, ['title' => 'Nope'], $this->auth($this->lead, 'lead'))
            ->assertStatus(403);
    }

    public function test_task_worker_can_update_own_project_task(): void
    {
        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->owner->id,
        ]);

        $this->putJson('/api/v1/tasks/'.$task->uuid, ['title' => 'Updated title'], $this->auth($this->taskWorker, 'worker'))
            ->assertOk()
            ->assertJsonPath('data.title', 'Updated title');
    }

    public function test_delete_requires_tasks_delete_permission(): void
    {
        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->owner->id,
        ]);

        $this->deleteJson('/api/v1/tasks/'.$task->uuid, [], $this->auth($this->lead, 'lead'))
            ->assertStatus(403);

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'deleted_at' => null]);
    }

    public function test_project_owner_can_delete_task(): void
    {
        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->owner->id,
        ]);

        $this->deleteJson('/api/v1/tasks/'.$task->uuid, [], $this->auth($this->owner, 'owner'))
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->assertSoftDeleted('tasks', ['id' => $task->id]);
    }

    public function test_task_list_filters_by_status_priority_and_assignee(): void
    {
        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->owner->id,
            'status' => TaskStatus::Todo,
            'priority' => TaskPriority::Urgent,
        ]);
        Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->owner->id,
            'status' => TaskStatus::Done,
            'priority' => TaskPriority::Low,
        ]);
        TaskAssignment::create([
            'task_id' => $task->id,
            'user_id' => $this->member->id,
            'assigned_by' => $this->owner->id,
            'assigned_at' => now(),
        ]);

        $this->getJson('/api/v1/tasks?status=todo&priority=urgent', $this->auth($this->member, 'member'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $task->uuid);

        $this->getJson('/api/v1/tasks?assignee='.$this->member->id, $this->auth($this->member, 'member'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $task->uuid);
    }

    public function test_unknown_task_uuid_returns_404(): void
    {
        $this->getJson('/api/v1/tasks/'.Str::uuid(), $this->auth($this->member, 'member'))
            ->assertStatus(404);
    }
}
