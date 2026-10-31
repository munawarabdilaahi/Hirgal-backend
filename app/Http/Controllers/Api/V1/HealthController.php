<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    /**
     * System health check endpoint.
     */
    public function __invoke(): JsonResponse
    {
        $dbStatus = 'disconnected';
        $dbLatencyMs = null;

        try {
            $startTime = microtime(true);
            DB::connection()->getPdo();
            $dbLatencyMs = round((microtime(true) - $startTime) * 1000, 2);
            $dbStatus = 'connected';
        } catch (Throwable $e) {
            $dbStatus = 'unreachable: ' . $e->getMessage();
        }

        $healthy = ($dbStatus === 'connected');

        return ApiResponse::success(
            data: [
                'status' => $healthy ? 'healthy' : 'degraded',
                'service' => config('app.name', 'Hirgal API'),
                'version' => '1.0.0',
                'framework' => 'Laravel ' . app()->version(),
                'php' => PHP_VERSION,
                'environment' => config('app.env'),
                'timestamp' => now()->toIso8601String(),
                'checks' => [
                    'database' => [
                        'status' => $dbStatus,
                        'connection' => config('database.default'),
                        'latency_ms' => $dbLatencyMs,
                    ],
                ],
            ],
            message: $healthy ? 'System is healthy and fully operational' : 'System is degraded',
            status: $healthy ? 200 : 503
        );
    }
}
