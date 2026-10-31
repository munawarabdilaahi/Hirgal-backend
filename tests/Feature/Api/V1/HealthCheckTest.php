<?php

namespace Tests\Feature\Api\V1;

use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    public function test_health_check_returns_successful_standardized_json(): void
    {
        $response = $this->getJson(route('api.v1.health'));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'status',
                    'service',
                    'version',
                    'framework',
                    'php',
                    'environment',
                    'timestamp',
                    'checks' => [
                        'database' => [
                            'status',
                            'connection',
                            'latency_ms',
                        ],
                    ],
                ],
            ])
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'healthy',
                ],
            ]);
    }
}
