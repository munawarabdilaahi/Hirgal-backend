<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Appointment;
use App\Models\Habit;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WorkspaceSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_and_team_pages_require_authentication_and_render_after_login(): void
    {
        $this->withoutVite();
        $this->get('/projects')->assertRedirectToRoute('login');
        $this->get('/teams')->assertRedirectToRoute('login');

        $user = User::factory()->create();
        foreach (['/projects', '/projects/new', '/projects/example/edit', '/projects/example', '/teams', '/teams/new', '/teams/example/edit', '/teams/example'] as $path) {
            $this->actingAs($user)->get($path)->assertInertia(fn (Assert $page) => $page
                ->component('Workspace', false)
                ->where('user.id', $user->id));
        }
    }

    public function test_session_can_access_scoped_projects_and_teams_through_existing_api(): void
    {
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('slug', UserRole::ProjectManager->value)->firstOrFail());
        $project = Project::factory()->create(['owner_id' => $user->id]);
        $team = Team::factory()->create(['leader_id' => $user->id]);
        $otherProject = Project::factory()->create();

        $login = $this->post('/login', ['email' => $user->email, 'password' => 'password']);
        $login->assertRedirectToRoute('dashboard');
        $cookie = $login->getCookie(config('session.cookie'));
        Auth::forgetGuards();

        $this->withCookie($cookie->getName(), $cookie->getValue())
            ->withHeader('Referer', config('app.url').'/projects')
            ->withHeader('X-Hirgal-Session', '1')
            ->getJson('/api/v1/projects/'.$project->uuid)->assertOk()
            ->assertJsonPath('data.uuid', $project->uuid);
        Auth::forgetGuards();
        $this->getJson('/api/v1/teams/'.$team->uuid)->assertOk()
            ->assertJsonPath('data.uuid', $team->uuid);
        Auth::forgetGuards();
        $this->getJson('/api/v1/projects/'.$otherProject->uuid)->assertNotFound();
        Auth::forgetGuards();
        $this->postJson('/api/v1/projects', ['name' => 'Session project'])->assertCreated();
        Auth::forgetGuards();
        $this->postJson('/api/v1/teams', ['name' => 'Session team'])->assertCreated();
        $this->assertDatabaseHas('projects', ['name' => 'Session project', 'owner_id' => $user->id]);
        $this->assertDatabaseHas('teams', ['name' => 'Session team']);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_bearer_token_api_access_still_works(): void
    {
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('slug', UserRole::Member->value)->firstOrFail());
        $project = Project::factory()->create(['owner_id' => $user->id]);

        $this->withToken($user->createToken('api')->plainTextToken)
            ->getJson('/api/v1/projects/'.$project->uuid)
            ->assertOk()->assertJsonPath('data.uuid', $project->uuid);
    }

    public function test_task_pages_require_an_active_session_and_task_view_permission(): void
    {
        $this->withoutVite();
        foreach (['/tasks', '/my-work'] as $path) {
            $this->get($path)->assertRedirectToRoute('login');
        }

        $user = User::factory()->create();
        foreach (['/tasks', '/my-work'] as $path) {
            $this->actingAs($user)->get($path)->assertForbidden();
        }

        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        $user->roles()->attach(Role::where('slug', UserRole::Member->value)->firstOrFail());
        $user->unsetRelation('roles');
        foreach (['/tasks', '/my-work'] as $path) {
            $this->actingAs($user)->get($path)->assertInertia(fn (Assert $page) => $page
                ->component('Workspace', false)
                ->where('user.id', $user->id));
        }
    }

    public function test_session_task_requests_respect_project_scope_and_assignment_filter(): void
    {
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('slug', UserRole::ProjectManager->value)->firstOrFail());
        $project = Project::factory()->create(['owner_id' => $user->id]);
        $assignedTask = Task::factory()->create(['project_id' => $project->id, 'creator_id' => $user->id]);
        $otherTask = Task::factory()->create(['project_id' => $project->id, 'creator_id' => $user->id]);
        $foreignTask = Task::factory()->create();
        TaskAssignment::factory()->create([
            'task_id' => $assignedTask->id,
            'user_id' => $user->id,
            'assigned_by' => $user->id,
        ]);

        $login = $this->post('/login', ['email' => $user->email, 'password' => 'password']);
        $cookie = $login->getCookie(config('session.cookie'));
        Auth::forgetGuards();

        $this->withCookie($cookie->getName(), $cookie->getValue())
            ->withHeader('Referer', config('app.url').'/my-work')
            ->withHeader('X-Hirgal-Session', '1')
            ->getJson('/api/v1/tasks?assignee='.$user->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $assignedTask->uuid);

        Auth::forgetGuards();
        $this->getJson('/api/v1/tasks/'.$foreignTask->uuid)->assertNotFound();
        Auth::forgetGuards();
        $this->putJson('/api/v1/tasks/'.$otherTask->uuid, ['title' => 'Updated task'])
            ->assertOk()->assertJsonPath('data.title', 'Updated task');
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_appointment_and_habit_pages_require_an_active_session_and_permission(): void
    {
        $this->withoutVite();
        $paths = ['/appointments', '/habits', '/habits/new', '/habits/example', '/habits/example/edit'];
        foreach ($paths as $path) {
            $this->get($path)->assertRedirectToRoute('login');
        }

        $user = User::factory()->create();
        foreach ($paths as $path) {
            $this->actingAs($user)->get($path)->assertForbidden();
        }

        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        $user->roles()->attach(Role::where('slug', UserRole::Member->value)->firstOrFail());
        $user->unsetRelation('roles');
        foreach ($paths as $path) {
            $this->actingAs($user)->get($path)->assertInertia(fn (Assert $page) => $page
                ->component('Workspace', false)
                ->where('user.id', $user->id));
        }
    }

    public function test_session_appointment_and_habit_requests_respect_ownership(): void
    {
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('slug', UserRole::ProjectManager->value)->firstOrFail());
        $appointment = Appointment::factory()->create(['organizer_id' => $user->id]);
        $foreignAppointment = Appointment::factory()->create();
        $habit = Habit::factory()->create(['user_id' => $user->id]);
        $foreignHabit = Habit::factory()->create();

        $login = $this->post('/login', ['email' => $user->email, 'password' => 'password']);
        $cookie = $login->getCookie(config('session.cookie'));
        Auth::forgetGuards();

        $this->withCookie($cookie->getName(), $cookie->getValue())
            ->withHeader('Referer', config('app.url').'/appointments')
            ->withHeader('X-Hirgal-Session', '1')
            ->getJson('/api/v1/appointments/'.$appointment->uuid)->assertOk()
            ->assertJsonPath('data.uuid', $appointment->uuid);
        Auth::forgetGuards();
        $this->getJson('/api/v1/appointments/'.$foreignAppointment->uuid)->assertNotFound();
        Auth::forgetGuards();
        $this->getJson('/api/v1/habits/'.$foreignHabit->uuid)->assertNotFound();
        Auth::forgetGuards();
        $this->postJson('/api/v1/habits/'.$habit->uuid.'/logs', [
            'logged_date' => now('UTC')->toDateString(),
            'status' => 'completed',
        ])->assertOk()->assertJsonPath('data.log.status', 'completed');
        Auth::forgetGuards();
        $this->postJson('/api/v1/appointments', [
            'title' => 'Session appointment',
            'timezone' => 'UTC',
            'start_time' => now('UTC')->addDays(30)->format('Y-m-d\TH:i:s\Z'),
            'end_time' => now('UTC')->addDays(30)->addHour()->format('Y-m-d\TH:i:s\Z'),
        ])->assertCreated()->assertJsonPath('data.appointment.title', 'Session appointment');

        $this->assertDatabaseHas('habit_logs', ['habit_id' => $habit->id, 'user_id' => $user->id, 'status' => 'completed']);
        $this->assertDatabaseHas('appointments', ['title' => 'Session appointment', 'organizer_id' => $user->id]);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
