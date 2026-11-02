<?php

namespace Tests\Feature\Database;

use App\Enums\AccountStatus;
use App\Enums\AppointmentStatus;
use App\Enums\HabitFrequency;
use App\Enums\ProjectMemberRole;
use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Enums\UserRole as UserRoleEnum;
use App\Models\Appointment;
use App\Models\Habit;
use App\Models\Permission;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Role;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\Team;
use App\Models\User;
use App\Models\UserMention;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ModelRelationshipsTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_and_profile_relationship(): void
    {
        $user = User::factory()->create();
        $profile = UserProfile::factory()->create(['user_id' => $user->id]);

        $this->assertInstanceOf(UserProfile::class, $user->profile);
        $this->assertEquals($user->id, $profile->user->id);
    }

    public function test_user_roles_and_permissions_relationship(): void
    {
        $user = User::factory()->create();
        $role = Role::factory()->create(['slug' => UserRoleEnum::ProjectManager->value]);
        $permission = Permission::factory()->create(['slug' => 'projects.create']);

        $role->permissions()->attach($permission);
        $user->roles()->attach($role);

        $this->assertTrue($user->roles->contains($role));
        $this->assertTrue($role->permissions->contains($permission));
        $this->assertTrue($user->hasRole(UserRoleEnum::ProjectManager->value));
    }

    public function test_project_members_and_tasks_relationship(): void
    {
        $owner = User::factory()->create();
        $project = Project::factory()->create(['owner_id' => $owner->id]);

        $member = User::factory()->create();
        ProjectMember::factory()->create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => ProjectMemberRole::Member,
        ]);

        $task = Task::factory()->create([
            'project_id' => $project->id,
            'creator_id' => $owner->id,
        ]);

        $this->assertEquals($owner->id, $project->owner->id);
        $this->assertTrue($project->members->contains($member));
        $this->assertTrue($project->tasks->contains($task));
        $this->assertEquals($project->id, $task->project->id);
    }

    public function test_task_assignments_and_comments_relationship(): void
    {
        $task = Task::factory()->withAssignees(2)->create();
        $comment = TaskComment::factory()->create([
            'task_id' => $task->id,
            'user_id' => $task->creator_id,
        ]);

        $this->assertCount(2, $task->assignees);
        $this->assertTrue($task->comments->contains($comment));
        $this->assertEquals($task->id, $comment->task->id);
    }

    public function test_appointment_and_participants_relationship(): void
    {
        $appointment = Appointment::factory()->withParticipants(3)->create();

        $this->assertCount(3, $appointment->participants);
        $this->assertInstanceOf(User::class, $appointment->organizer);
    }

    public function test_habit_and_logs_relationship(): void
    {
        $habit = Habit::factory()->withLogs(3)->create();

        $this->assertCount(3, $habit->logs);
        $this->assertEquals($habit->user_id, $habit->logs->first()->user_id);
    }

    public function test_user_mentions_polymorphic_relationship(): void
    {
        $task = Task::factory()->create();
        $author = User::factory()->create();
        $targetUser = User::factory()->create();

        $mention = UserMention::factory()->create([
            'mentionable_type' => Task::class,
            'mentionable_id' => $task->id,
            'author_id' => $author->id,
            'mentioned_user_id' => $targetUser->id,
        ]);

        $this->assertInstanceOf(Task::class, $mention->mentionable);
        $this->assertEquals($task->id, $mention->mentionable->id);
        $this->assertEquals($targetUser->id, $mention->mentionedUser->id);
    }

    public function test_uuid_auto_generation_on_entities(): void
    {
        $project = Project::factory()->create(['uuid' => null]);
        $task = Task::factory()->create(['uuid' => null]);
        $team = Team::factory()->create(['uuid' => null]);
        $appointment = Appointment::factory()->create(['uuid' => null]);
        $habit = Habit::factory()->create(['uuid' => null]);

        $this->assertTrue(Str::isUuid($project->uuid));
        $this->assertTrue(Str::isUuid($task->uuid));
        $this->assertTrue(Str::isUuid($team->uuid));
        $this->assertTrue(Str::isUuid($appointment->uuid));
        $this->assertTrue(Str::isUuid($habit->uuid));
    }

    public function test_enum_attribute_casting(): void
    {
        $user = User::factory()->create(['account_status' => AccountStatus::Active]);
        $this->assertInstanceOf(AccountStatus::class, $user->account_status);
        $this->assertEquals(AccountStatus::Active, $user->account_status);

        $project = Project::factory()->create(['status' => ProjectStatus::Active]);
        $this->assertInstanceOf(ProjectStatus::class, $project->status);

        $task = Task::factory()->create(['status' => TaskStatus::InProgress]);
        $this->assertInstanceOf(TaskStatus::class, $task->status);

        $appointment = Appointment::factory()->create(['status' => AppointmentStatus::Scheduled]);
        $this->assertInstanceOf(AppointmentStatus::class, $appointment->status);

        $habit = Habit::factory()->create(['frequency' => HabitFrequency::Daily]);
        $this->assertInstanceOf(HabitFrequency::class, $habit->frequency);
    }

    public function test_soft_deletes_behavior(): void
    {
        $project = Project::factory()->create();
        $projectId = $project->id;

        $project->delete();

        $this->assertSoftDeleted('projects', ['id' => $projectId]);
        $this->assertNull(Project::find($projectId));
        $this->assertNotNull(Project::withTrashed()->find($projectId));
    }

    public function test_sensitive_attributes_are_hidden(): void
    {
        $user = User::factory()->create([
            'password' => 'secret',
            'remember_token' => 'token123',
        ]);

        $array = $user->toArray();

        $this->assertArrayNotHasKey('password', $array);
        $this->assertArrayNotHasKey('remember_token', $array);
    }
}
