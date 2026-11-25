<?php

namespace Tests\Feature\Notifications;

use App\Enums\AccountStatus;
use App\Enums\ProjectMemberRole;
use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Enums\UserRole;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use App\Models\UserProfile;
use App\Notifications\ProjectNotification;
use App\Notifications\TaskNotification;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationEventsTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected User $other;

    protected Project $project;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);

        $pmRole = Role::where('slug', UserRole::ProjectManager->value)->first();
        $memberRole = Role::where('slug', UserRole::Member->value)->first();

        $this->user = User::factory()->create(['name' => 'Lead User']);
        $this->user->roles()->attach($pmRole->id);

        $this->other = User::factory()->create(['name' => 'Collaborator']);
        $this->other->roles()->attach($memberRole->id);

        $this->project = Project::factory()->create(['owner_id' => $this->user->id]);

        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->user->id,
            'role' => ProjectMemberRole::Owner,
            'joined_at' => now(),
        ]);

        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $this->other->id,
            'role' => ProjectMemberRole::Member,
            'joined_at' => now(),
        ]);
    }

    public function test_authenticated_user_can_delete_own_notification(): void
    {
        $notification = $this->user->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => TaskNotification::class,
            'data' => [
                'event' => 'task_assigned',
                'title' => 'Task assigned to you',
                'task_uuid' => (string) Str::uuid(),
            ],
            'read_at' => null,
            'created_at' => now(),
        ]);

        $this->actingAs($this->user, 'sanctum')
            ->deleteJson("/api/v1/notifications/{$notification->id}")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Notification deleted successfully.');

        $this->assertDatabaseMissing('notifications', ['id' => $notification->id]);
    }

    public function test_user_cannot_delete_another_users_notification(): void
    {
        $notification = $this->other->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => TaskNotification::class,
            'data' => [
                'event' => 'task_assigned',
                'title' => 'Task assigned to you',
                'task_uuid' => (string) Str::uuid(),
            ],
            'read_at' => null,
            'created_at' => now(),
        ]);

        $this->actingAs($this->user, 'sanctum')
            ->deleteJson("/api/v1/notifications/{$notification->id}")
            ->assertNotFound();

        $this->assertDatabaseHas('notifications', ['id' => $notification->id]);
    }

    public function test_task_assignment_notifies_assignee_but_not_actor(): void
    {
        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->user->id,
            'status' => TaskStatus::Todo,
            'priority' => TaskPriority::Medium,
        ]);

        $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/tasks/{$task->uuid}/assign", [
                'user_ids' => [$this->other->id, $this->user->id],
            ])
            ->assertOk();

        // Assignee (other) received notification
        $otherNotification = $this->other->notifications()->where('type', TaskNotification::class)->first();
        $this->assertNotNull($otherNotification);
        $this->assertSame('task_assigned', $otherNotification->data['event']);
        $this->assertSame($task->uuid, $otherNotification->data['task_uuid']);
        $this->assertSame($this->user->name, $otherNotification->data['actor_name']);
        $this->assertSame('/tasks?task='.$task->uuid, $otherNotification->data['action_url']);

        // Actor (user) did not receive self-notification
        $actorNotification = $this->user->notifications()->where('type', TaskNotification::class)->first();
        $this->assertNull($actorNotification);
    }

    public function test_task_unassignment_notifies_removed_user(): void
    {
        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->user->id,
        ]);

        $task->assignments()->create([
            'user_id' => $this->other->id,
            'assigned_by' => $this->user->id,
            'assigned_at' => now(),
        ]);

        $this->actingAs($this->user, 'sanctum')
            ->deleteJson("/api/v1/tasks/{$task->uuid}/assignees/{$this->other->id}")
            ->assertOk();

        $notification = $this->other->notifications()->where('type', TaskNotification::class)->first();
        $this->assertNotNull($notification);
        $this->assertSame('task_unassigned', $notification->data['event']);
        $this->assertSame($task->uuid, $notification->data['task_uuid']);
    }

    public function test_task_status_completed_notifies_assignees_and_creator(): void
    {
        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->user->id,
            'status' => TaskStatus::InProgress,
        ]);

        $task->assignments()->create([
            'user_id' => $this->other->id,
            'assigned_by' => $this->user->id,
            'assigned_at' => now(),
        ]);

        // Actor is $this->user (creator), marking completed
        $this->actingAs($this->user, 'sanctum')
            ->putJson("/api/v1/tasks/{$task->uuid}", [
                'status' => TaskStatus::Done->value,
            ])
            ->assertOk();

        $otherNotification = $this->other->notifications()->where('type', TaskNotification::class)->first();
        $this->assertNotNull($otherNotification);
        $this->assertSame('task_completed', $otherNotification->data['event']);
        $this->assertSame($task->uuid, $otherNotification->data['task_uuid']);

        // Creator was actor, so no self-notification
        $userNotification = $this->user->notifications()->where('type', TaskNotification::class)->first();
        $this->assertNull($userNotification);
    }

    public function test_task_deadline_change_notifies_assignees(): void
    {
        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->user->id,
            'due_date' => now()->addDays(2),
        ]);

        $task->assignments()->create([
            'user_id' => $this->other->id,
            'assigned_by' => $this->user->id,
            'assigned_at' => now(),
        ]);

        $newDueDate = now()->addDays(5)->startOfMinute();

        $this->actingAs($this->user, 'sanctum')
            ->putJson("/api/v1/tasks/{$task->uuid}", [
                'due_date' => $newDueDate->toISOString(),
            ])
            ->assertOk();

        $notification = $this->other->notifications()->where('type', TaskNotification::class)->first();
        $this->assertNotNull($notification);
        $this->assertSame('task_due_date_changed', $notification->data['event']);
    }

    public function test_project_member_added_and_removed_notifies_member(): void
    {
        $newUser = User::factory()->create(['name' => 'New Joiner']);
        $newUser->roles()->attach(Role::where('slug', UserRole::Member->value)->first()->id);

        // Add member
        $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/projects/{$this->project->uuid}/members", [
                'user_id' => $newUser->id,
                'role' => ProjectMemberRole::Member->value,
            ])
            ->assertCreated();

        $addedNotification = $newUser->notifications()->where('type', ProjectNotification::class)->first();
        $this->assertNotNull($addedNotification);
        $this->assertSame('project_member_added', $addedNotification->data['event']);
        $this->assertSame($this->project->uuid, $addedNotification->data['project_uuid']);
        $this->assertSame('/projects/'.$this->project->uuid, $addedNotification->data['action_url']);

        // Remove member
        $this->actingAs($this->user, 'sanctum')
            ->deleteJson("/api/v1/projects/{$this->project->uuid}/members/{$newUser->id}")
            ->assertOk();

        $removedNotification = $newUser->notifications()->where('type', ProjectNotification::class)
            ->where('data->event', 'project_member_removed')
            ->first();
        $this->assertNotNull($removedNotification);
        $this->assertSame('project_member_removed', $removedNotification->data['event']);
    }

    public function test_inactive_and_opted_out_users_do_not_receive_notifications(): void
    {
        $inactiveUser = User::factory()->create([
            'account_status' => AccountStatus::Suspended,
        ]);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $inactiveUser->id,
            'role' => ProjectMemberRole::Member,
            'joined_at' => now(),
        ]);

        $optedOutUser = User::factory()->create();
        UserProfile::factory()->create([
            'user_id' => $optedOutUser->id,
            'notification_preferences' => ['in_app' => false],
        ]);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $optedOutUser->id,
            'role' => ProjectMemberRole::Member,
            'joined_at' => now(),
        ]);

        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->user->id,
        ]);

        $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/tasks/{$task->uuid}/assign", [
                'user_ids' => [$inactiveUser->id, $optedOutUser->id],
            ])
            ->assertOk();

        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $inactiveUser->id]);
        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $optedOutUser->id]);
    }

    public function test_task_assignment_payload_includes_all_required_fields(): void
    {
        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->user->id,
            'title' => 'Design System Audit',
        ]);

        $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/tasks/{$task->uuid}/assign", [
                'user_ids' => [$this->other->id],
            ])
            ->assertOk();

        $response = $this->actingAs($this->other, 'sanctum')
            ->getJson('/api/v1/notifications')
            ->assertOk();

        $notification = $response->json('data.0');
        $this->assertNotNull($notification);
        $this->assertNotEmpty($notification['id']);
        $this->assertNotEmpty($notification['created_at']);
        $this->assertSame('task_assigned', $notification['data']['event']);
        $this->assertSame('Task assigned to you', $notification['data']['title']);
        $this->assertSame('Design System Audit', $notification['data']['task_title']);
        $this->assertSame($task->uuid, $notification['data']['task_uuid']);
        $this->assertSame($this->user->name, $notification['data']['actor_name']);
        $this->assertSame($this->user->id, $notification['data']['actor_id']);
        $this->assertSame("{$this->user->name} assigned you to \"Design System Audit\"", $notification['data']['message']);
        $this->assertSame('/tasks?task='.$task->uuid, $notification['data']['action_url']);
    }

    public function test_task_reassignment_notifies_new_assignee_and_unassigns_previous(): void
    {
        $thirdUser = User::factory()->create(['name' => 'Third Engineer']);
        $thirdUser->roles()->attach(Role::where('slug', UserRole::Member->value)->first()->id);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $thirdUser->id,
            'role' => ProjectMemberRole::Member,
            'joined_at' => now(),
        ]);

        $task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $this->user->id,
            'title' => 'Database Optimization',
        ]);

        // Initially assigned to $this->other
        $task->assignments()->create([
            'user_id' => $this->other->id,
            'assigned_by' => $this->user->id,
            'assigned_at' => now(),
        ]);

        // Reassign to $thirdUser
        $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/tasks/{$task->uuid}/assign", [
                'user_ids' => [$thirdUser->id],
                'reassign' => true,
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Task reassigned successfully.');

        // Old assignee was unassigned and notified
        $this->assertDatabaseMissing('task_assignments', [
            'task_id' => $task->id,
            'user_id' => $this->other->id,
        ]);
        $unassignedNotification = $this->other->notifications()->where('type', TaskNotification::class)->latest('id')->first();
        $this->assertNotNull($unassignedNotification);
        $this->assertSame('task_unassigned', $unassignedNotification->data['event']);
        $this->assertSame('You were removed from task "Database Optimization"', $unassignedNotification->data['message']);

        // New assignee was assigned and notified of reassignment
        $this->assertDatabaseHas('task_assignments', [
            'task_id' => $task->id,
            'user_id' => $thirdUser->id,
        ]);
        $reassignedNotification = $thirdUser->notifications()->where('type', TaskNotification::class)->latest('id')->first();
        $this->assertNotNull($reassignedNotification);
        $this->assertSame('task_reassigned', $reassignedNotification->data['event']);
        $this->assertSame('Task reassigned to you', $reassignedNotification->data['title']);
        $this->assertSame("{$this->user->name} reassigned \"Database Optimization\" to you", $reassignedNotification->data['message']);
    }

    public function test_task_creation_with_assignees_notifies_assigned_user(): void
    {
        $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/projects/{$this->project->uuid}/tasks", [
                'title' => 'Brand New Feature Task',
                'status' => TaskStatus::Todo->value,
                'priority' => TaskPriority::High->value,
                'assignees' => [$this->other->id],
            ])
            ->assertCreated();

        $notification = $this->other->notifications()->where('type', TaskNotification::class)->first();
        $this->assertNotNull($notification);
        $this->assertSame('task_assigned', $notification->data['event']);
        $this->assertSame('Brand New Feature Task', $notification->data['task_title']);
        $this->assertSame("{$this->user->name} assigned you to \"Brand New Feature Task\"", $notification->data['message']);

        // Actor does not receive notification
        $this->assertNull($this->user->notifications()->where('type', TaskNotification::class)->first());
    }
}
