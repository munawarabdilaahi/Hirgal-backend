<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LogoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
    }

    public function test_user_can_logout_and_revoke_current_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-device')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/auth/logout');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Successfully logged out.');

        // Verify the revoked token can no longer authenticate
        $this->app['auth']->forgetGuards();

        $followUpResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/auth/me');

        $followUpResponse->assertStatus(401);
    }

    public function test_user_can_logout_from_all_devices(): void
    {
        $user = User::factory()->create();
        $token1 = $user->createToken('phone')->plainTextToken;
        $token2 = $user->createToken('laptop')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token1)
            ->postJson('/api/v1/auth/logout-all');

        $response->assertOk()
            ->assertJsonPath('success', true);

        // Verify both tokens are revoked
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$token1)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$token2)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }

    public function test_unauthenticated_request_to_logout_is_rejected(): void
    {
        $response = $this->postJson('/api/v1/auth/logout');

        $response->assertStatus(401);
    }
}
