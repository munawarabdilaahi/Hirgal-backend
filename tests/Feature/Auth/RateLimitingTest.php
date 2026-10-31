<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class RateLimitingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        RateLimiter::clear('login');
    }

    public function test_login_endpoint_enforces_rate_limiting(): void
    {
        $user = User::factory()->create(['email' => 'target@hirgal.local']);

        // First 5 attempts should return 422 (validation error due to wrong password)
        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/v1/auth/login', [
                'email' => 'target@hirgal.local',
                'password' => 'WrongPassword!',
            ]);
            $response->assertStatus(422);
        }

        // 6th attempt should be blocked by rate limiter with 429 Too Many Requests
        $throttledResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'target@hirgal.local',
            'password' => 'WrongPassword!',
        ]);

        $throttledResponse->assertStatus(429)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'RATE_LIMIT_EXCEEDED');
    }

    public function test_forgot_password_endpoint_enforces_rate_limiting(): void
    {
        RateLimiter::clear('password-reset');

        // First 5 attempts allowed
        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/v1/auth/forgot-password', [
                'email' => "user{$i}@hirgal.local",
            ]);
            $response->assertOk();
        }

        // 6th attempt blocked with 429
        $throttledResponse = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'user6@hirgal.local',
        ]);

        $throttledResponse->assertStatus(429)
            ->assertJsonPath('error_code', 'RATE_LIMIT_EXCEEDED');
    }
}
