<?php

namespace Tests\Feature\Tasks;

use App\Enums\ProjectMemberRole;
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

class TaskAssignmentTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $owner;

    protected User $lead;

    protected User $member;

    protected User $worker;

    protected Project $project;

    protected Task $task;

    protected User $assignable;

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

        $this->worker = User::factory()->create(['name' => 'Task Worker']);
        $this->worker->roles()->attach($leadRole->id);

        $this->project = Project::factory()->create(['owner_id' => $this->owner->id]);

        foreach ([
            [$this->owner, ProjectMemberRole::Owner],
            [$this->lead, ProjectMemberRole::Lead],
            [$this->member, ProjectMemberRole::Member],
            [$this->worker, ProjectMemberRole::Member],
        ] as [$user, $role]) {
            ProjectMember::create([
                'project_id' => $this->project->id,
                'user_id' => $user->id,
                'role' => $role,
                'joined_at' => now(),
            ]);
        }

        $this->assignable = User::factory()->create(['name' => 'Assignable Member']);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->assignable->id,
            'role' => ProjectMemberRole::Member,
            'joined_at' => now(),
        ]);

        $this->task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->worker->id,
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

    public function test_task_creator_member_can_assign(): void
    {
        $this->postJson('/api/v1/tasks/'.$this->task->uuid.'/assign', [
            'user_ids' => [$this->assignable->id],
        ], $this->auth($this->worker, 'worker'))
            ->assertOk()
            ->assertJsonPath('data.uuid', $this->task->uuid);

        $this->assertDatabaseHas('task_assignments', [
            'task_id' => $this->task->id,
            'user_id' => $this->assignable->id,
            'assigned_by' => $this->worker->id,
        ]);
    }

    public function test_member_without_tasks_assign_cannot_assign(): void
    {
        $this->postJson('/api/v1/tasks/'.$this->task->uuid.'/assign', [
            'user_ids' => [$this->assignable->id],
        ], $this->auth($this->member, 'member'))
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'FORBIDDEN');

        $this->assertDatabaseMissing('task_assignments', [
            'task_id' => $this->task->id,
            'user_id' => $this->assignable->id,
        ]);
    }

    public function test_contextual_lead_can_assign(): void
    {
        $this->postJson('/api/v1/tasks/'.$this->task->uuid.'/assign', [
            'user_ids' => [$this->assignable->id],
        ], $this->auth($this->lead, 'lead'))
            ->assertOk();

        $this->assertDatabaseHas('task_assignments', [
            'task_id' => $this->task->id,
            'user_id' => $this->assignable->id,
        ]);
    }

    public function test_viewer_contextual_role_cannot_assign(): void
    {
        ProjectMember::where('project_id', $this->project->id)
            ->where('user_id', $this->lead->id)
            ->update(['role' => ProjectMemberRole::Viewer]);

        $this->postJson('/api/v1/tasks/'.$this->task->uuid.'/assign', [
            'user_ids' => [$this->assignable->id],
        ], $this->auth($this->lead, 'lead'))
            ->assertStatus(403);
    }

    public function test_assignee_must_be_project_member(): void
    {
        $stranger = User::factory()->create();

        $this->postJson('/api/v1/tasks/'.$this->task->uuid.'/assign', [
            'user_ids' => [$stranger->id],
        ], $this->auth($this->owner, 'owner'))
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');

        $this->assertDatabaseMissing('task_assignments', [
            'task_id' => $this->task->id,
            'user_id' => $stranger->id,
        ]);
    }

    public function test_duplicate_assignment_is_idempotent(): void
    {
        TaskAssignment::create([
            'task_id' => $this->task->id,
            'user_id' => $this->assignable->id,
            'assigned_by' => $this->owner->id,
            'assigned_at' => now(),
        ]);

        $this->postJson('/api/v1/tasks/'.$this->task->uuid.'/assign', [
            'user_ids' => [$this->assignable->id],
        ], $this->auth($this->owner, 'owner'))
            ->assertOk();

        $this->assertSame(1, TaskAssignment::where('task_id', $this->task->id)
            ->where('user_id', $this->assignable->id)
            ->count());
    }

    public function test_multiple_assignees_in_single_request(): void
    {
        $this->postJson('/api/v1/tasks/'.$this->task->uuid.'/assign', [
            'user_ids' => [$this->assignable->id, $this->member->id],
        ], $this->auth($this->owner, 'owner'))
            ->assertOk();

        $this->assertSame(2, TaskAssignment::where('task_id', $this->task->id)->count());
    }

    public function test_system_admin_can_assign(): void
    {
        $this->postJson('/api/v1/tasks/'.$this->task->uuid.'/assign', [
            'user_ids' => [$this->assignable->id],
        ], $this->auth($this->admin, 'admin'))
            ->assertOk();

        $this->assertDatabaseHas('task_assignments', [
            'task_id' => $this->task->id,
            'user_id' => $this->assignable->id,
            'assigned_by' => $this->admin->id,
        ]);
    }

    public function test_unassign_success(): void
    {
        TaskAssignment::create([
            'task_id' => $this->task->id,
            'user_id' => $this->assignable->id,
            'assigned_by' => $this->owner->id,
            'assigned_at' => now(),
        ]);

        $this->deleteJson(
            '/api/v1/tasks/'.$this->task->uuid.'/assignees/'.$this->assignable->id,
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertOk()
            ->assertJsonPath('data.uuid', $this->task->uuid)
            ->assertJsonPath('data.assignees', []);

        $this->assertDatabaseMissing('task_assignments', [
            'task_id' => $this->task->id,
            'user_id' => $this->assignable->id,
        ]);
    }

    public function test_unassign_unknown_assignment_returns_404(): void
    {
        $this->deleteJson(
            '/api/v1/tasks/'.$this->task->uuid.'/assignees/'.$this->assignable->id,
            [],
            $this->auth($this->owner, 'owner')
        )
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_out_of_scope_task_assign_returns_404(): void
    {
        $foreignProject = Project::factory()->create(['owner_id' => User::factory()->create()->id]);
        $foreignTask = Task::factory()->create(['project_id' => $foreignProject->id]);

        $this->postJson('/api/v1/tasks/'.$foreignTask->uuid.'/assign', [
            'user_ids' => [$this->assignable->id],
        ], $this->auth($this->member, 'member'))
            ->assertStatus(404)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    public function test_assign_requires_at_least_one_user(): void
    {
        $this->postJson('/api/v1/tasks/'.$this->task->uuid.'/assign', [
            'user_ids' => [],
        ], $this->auth($this->owner, 'owner'))
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');
    }

    public function test_unknown_task_uuid_assign_returns_404(): void
    {
        $this->postJson('/api/v1/tasks/'.Str::uuid().'/assign', [
            'user_ids' => [$this->assignable->id],
        ], $this->auth($this->owner, 'owner'))
            ->assertStatus(404);
    }
}
