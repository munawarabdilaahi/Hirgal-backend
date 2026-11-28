<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    public function test_health_check_returns_only_public_status(): void
    {
        $this->getJson(route('api.v1.health'))
            ->assertOk()
            ->assertExactJson(['success' => true, 'message' => 'Service is healthy', 'data' => ['status' => 'healthy']]);
    }

    public function test_database_failure_does_not_disclose_exception_details(): void
    {
        DB::partialMock()->shouldReceive('connection')->once()->andThrow(new RuntimeException('sensitive database host'));

        $this->getJson(route('api.v1.health'))
            ->assertStatus(503)
            ->assertExactJson(['success' => true, 'message' => 'Service is degraded', 'data' => ['status' => 'degraded']]);
    }
}
