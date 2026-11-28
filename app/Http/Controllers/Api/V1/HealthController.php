<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            DB::connection()->getPdo();
        } catch (Throwable $exception) {
            report($exception);

            return ApiResponse::success(
                data: ['status' => 'degraded'],
                message: 'Service is degraded',
                status: 503,
            );
        }

        return ApiResponse::success(data: ['status' => 'healthy'], message: 'Service is healthy');
    }
}
