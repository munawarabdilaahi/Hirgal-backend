<?php

namespace Tests\Feature\Api\V1;

use Tests\TestCase;

class JsonResponseStructureTest extends TestCase
{
    public function test_api_not_found_returns_standardized_json_error_format(): void
    {
        $response = $this->get('/api/v1/non-existent-endpoint');

        $response->assertStatus(404)
            ->assertHeader('Content-Type', 'application/json')
            ->assertJson([
                'success' => false,
                'error_code' => 'RESOURCE_NOT_FOUND',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'errors',
                'error_code',
            ]);
    }

    public function test_api_method_not_allowed_returns_standardized_json_error(): void
    {
        $response = $this->post('/api/v1/health');

        $response->assertStatus(405)
            ->assertHeader('Content-Type', 'application/json')
            ->assertJson([
                'success' => false,
                'error_code' => 'METHOD_NOT_ALLOWED',
            ]);
    }
}
