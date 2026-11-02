<?php

namespace Tests\Feature\Api\V1;

use App\Enums\AccountStatus;
use App\Enums\ProjectMemberRole;
use App\Enums\TeamMemberRole;
use App\Enums\UserRole;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectTeam;
use App\Models\Role;
use App\Models\Task;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class Phase6AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $outsider;

    protected Project $project;

    protected Team $team;

    protected Task $task;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);

        $pmRole = Role::where('slug', UserRole::ProjectManager->value)->first();

        $this->admin = User::factory()->create(['name' => 'Admin User']);
        $this->admin->roles()->attach(Role::where('slug', UserRole::SystemAdmin->value)->first()->id);

        $this->outsider = User::factory()->create(['name' => 'Outsider PM']);
        $this->outsider->roles()->attach($pmRole->id);

        $owner = User::factory()->create(['name' => 'Resource Owner']);
        $owner->roles()->attach($pmRole->id);

        $this->project = Project::factory()->create(['owner_id' => $owner->id]);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $owner->id,
            'role' => ProjectMemberRole::Owner,
            'joined_at' => now(),
        ]);

        $leader = User::factory()->create(['name' => 'Resource Leader']);
        $leader->roles()->attach(Role::where('slug', UserRole::TeamLeader->value)->first()->id);
        ProjectMember::create([
            'project_id' => $this->project->id,
            'user_id' => $leader->id,
            'role' => ProjectMemberRole::Lead,
            'joined_at' => now(),
        ]);

        $this->team = Team::factory()->create(['leader_id' => $leader->id]);
        TeamMember::create([
            'team_id' => $this->team->id,
            'user_id' => $leader->id,
            'role' => TeamMemberRole::Leader,
            'joined_at' => now(),
        ]);
        ProjectTeam::create([
            'project_id' => $this->project->id,
            'team_id' => $this->team->id,
            'assigned_at' => now(),
        ]);

        $this->task = Task::factory()->create([
            'project_id' => $this->project->id,
            'creator_id' => $owner->id,
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

    /**
     * @return array<int, array{0: string, 1: string}>
     */
    public static function phase6EndpointProvider(): array
    {
        return [
            ['GET', '/api/v1/projects'],
            ['POST', '/api/v1/projects'],
            ['GET', '/api/v1/projects/00000000-0000-4000-8000-000000000001'],
            ['PUT', '/api/v1/projects/00000000-0000-4000-8000-000000000001'],
            ['DELETE', '/api/v1/projects/00000000-0000-4000-8000-000000000001'],
            ['GET', '/api/v1/projects/00000000-0000-4000-8000-000000000001/members'],
            ['POST', '/api/v1/projects/00000000-0000-4000-8000-000000000001/members'],
            ['GET', '/api/v1/projects/00000000-0000-4000-8000-000000000001/teams'],
            ['POST', '/api/v1/projects/00000000-0000-4000-8000-000000000001/teams/00000000-0000-4000-8000-000000000002'],
            ['POST', '/api/v1/projects/00000000-0000-4000-8000-000000000001/tasks'],
            ['GET', '/api/v1/teams'],
            ['POST', '/api/v1/teams'],
            ['GET', '/api/v1/teams/00000000-0000-4000-8000-000000000002'],
            ['PUT', '/api/v1/teams/00000000-0000-4000-8000-000000000002'],
            ['DELETE', '/api/v1/teams/00000000-0000-4000-8000-000000000002'],
            ['GET', '/api/v1/teams/00000000-0000-4000-8000-000000000002/members'],
            ['POST', '/api/v1/teams/00000000-0000-4000-8000-000000000002/members'],
            ['GET', '/api/v1/tasks'],
            ['GET', '/api/v1/tasks/00000000-0000-4000-8000-000000000003'],
            ['PUT', '/api/v1/tasks/00000000-0000-4000-8000-000000000003'],
            ['DELETE', '/api/v1/tasks/00000000-0000-4000-8000-000000000003'],
            ['POST', '/api/v1/tasks/00000000-0000-4000-8000-000000000003/assign'],
        ];
    }

    #[DataProvider('phase6EndpointProvider')]
    public function test_phase6_endpoints_require_authentication(string $method, string $uri): void
    {
        $this->json($method, $uri)
            ->assertStatus(401)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'UNAUTHENTICATED');
    }

    public function test_suspended_account_is_blocked_across_phase6_families(): void
    {
        $suspended = User::factory()->create(['account_status' => AccountStatus::Suspended]);
        $suspended->roles()->attach(Role::where('slug', UserRole::Member->value)->first()->id);
        $headers = $this->auth($suspended, 'suspended');

        foreach (['/api/v1/projects', '/api/v1/teams', '/api/v1/tasks'] as $uri) {
            $this->getJson($uri, $headers)
                ->assertStatus(403)
                ->assertJsonPath('success', false)
                ->assertJsonPath('error_code', 'ACCOUNT_NOT_ACTIVE');
        }
    }

    /**
     * @return array<int, array{0: string, 1: string, 2: array<string, mixed>}>
     */
    public static function crossScopeEndpointProvider(): array
    {
        return [
            ['GET', '/api/v1/projects/{project}', []],
            ['PUT', '/api/v1/projects/{project}', ['name' => 'Hijack']],
            ['DELETE', '/api/v1/projects/{project}', []],
            ['GET', '/api/v1/projects/{project}/members', []],
            ['POST', '/api/v1/projects/{project}/members', ['user_id' => 999999]],
            ['GET', '/api/v1/projects/{project}/teams', []],
            ['POST', '/api/v1/projects/{project}/teams/{team}', []],
            ['DELETE', '/api/v1/projects/{project}/teams/{team}', []],
            ['GET', '/api/v1/tasks?project={project}', []],
            ['POST', '/api/v1/projects/{project}/tasks', ['title' => 'Cross']],
            ['GET', '/api/v1/teams/{team}', []],
            ['PUT', '/api/v1/teams/{team}', ['name' => 'Hijack']],
            ['DELETE', '/api/v1/teams/{team}', []],
            ['GET', '/api/v1/teams/{team}/members', []],
            ['POST', '/api/v1/teams/{team}/members', ['user_id' => 999999]],
            ['GET', '/api/v1/tasks/{task}', []],
            ['PUT', '/api/v1/tasks/{task}', ['title' => 'Hijack']],
            ['DELETE', '/api/v1/tasks/{task}', []],
            ['POST', '/api/v1/tasks/{task}/assign', ['user_ids' => [999999]]],
        ];
    }

    #[DataProvider('crossScopeEndpointProvider')]
    public function test_cross_scope_access_returns_404(string $method, string $uri, array $body): void
    {
        $uri = strtr($uri, [
            '{project}' => $this->project->uuid,
            '{team}' => $this->team->uuid,
            '{task}' => $this->task->uuid,
        ]);

        $this->json($method, $uri, $body, $this->auth($this->outsider, 'outsider'))
            ->assertStatus(404)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
    }

    /**
     * @return array<int, array{0: string, 1: int}>
     */
    public static function uuidBoundRouteProvider(): array
    {
        return [
            ['GET', 1],
            ['PUT', 2],
            ['DELETE', 3],
        ];
    }

    #[DataProvider('uuidBoundRouteProvider')]
    public function test_uuid_bound_routes_reject_numeric_ids(string $method, int $id): void
    {
        $headers = $this->auth($this->admin, 'admin');
        $body = $method === 'PUT' ? ['name' => 'Numeric'] : [];

        foreach (["/api/v1/projects/{$id}", "/api/v1/teams/{$id}", "/api/v1/tasks/{$id}"] as $uri) {
            $this->json($method, $uri, $body, $headers)
                ->assertStatus(404)
                ->assertJsonPath('error_code', 'RESOURCE_NOT_FOUND');
        }
    }

    public function test_permission_failure_uses_403_error_envelope(): void
    {
        $member = User::factory()->create();
        $member->roles()->attach(Role::where('slug', UserRole::Member->value)->first()->id);

        $this->postJson('/api/v1/projects', ['name' => 'Nope'], $this->auth($member, 'member'))
            ->assertStatus(403)
            ->assertJsonStructure(['success', 'message', 'errors', 'error_code'])
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_validation_failure_uses_422_error_envelope(): void
    {
        $pm = User::factory()->create();
        $pm->roles()->attach(Role::where('slug', UserRole::ProjectManager->value)->first()->id);

        $this->postJson('/api/v1/projects', [], $this->auth($pm, 'pm'))
            ->assertStatus(422)
            ->assertJsonStructure(['success', 'message', 'errors', 'error_code'])
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'VALIDATION_ERROR');
    }

    public function test_phase6_list_endpoints_return_success_envelope_with_meta(): void
    {
        $headers = $this->auth($this->admin, 'admin');

        foreach (['/api/v1/projects', '/api/v1/teams', '/api/v1/tasks'] as $uri) {
            $this->getJson($uri, $headers)
                ->assertOk()
                ->assertJsonPath('success', true)
                ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
        }
    }
}
