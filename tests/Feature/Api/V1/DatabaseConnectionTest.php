<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DatabaseConnectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_is_accessible_and_migrations_can_run(): void
    {
        $user = User::factory()->create([
            'name' => 'Architecture Verification User',
            'email' => 'architect@hirgal.local',
        ]);

        $this->assertDatabaseHas('users', [
            'email' => 'architect@hirgal.local',
        ]);

        $token = $user->createToken('test-token');
        $this->assertNotEmpty($token->plainTextToken);
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'name' => 'test-token',
        ]);
    }
}
