<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\Role;
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
}
