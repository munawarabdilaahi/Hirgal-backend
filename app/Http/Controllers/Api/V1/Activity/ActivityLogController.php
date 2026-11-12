<?php

namespace App\Http\Controllers\Api\V1\Activity;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Activity\ListActivityLogsRequest;
use App\Http\Requests\Api\V1\Activity\ListMyActivityRequest;
use App\Http\Resources\Api\V1\ActivityLogResource;
use App\Services\Audit\ActivityLogService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class ActivityLogController extends Controller
{
    public function __construct(
        protected ActivityLogService $activityLogs,
    ) {}

    /**
     * List the system-wide audit trail (requires audit.view).
     */
    public function index(ListActivityLogsRequest $request): JsonResponse
    {
        $paginator = $this->activityLogs->systemList($request->validated());

        return ApiResponse::success(
            data: ActivityLogResource::collection($paginator->items()),
            message: 'Activity logs retrieved successfully.',
            meta: [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * List the caller's own audit records (strictly ownership-scoped).
     */
    public function my(ListMyActivityRequest $request): JsonResponse
    {
        $paginator = $this->activityLogs->ownTimeline($request->user(), $request->validated());

        return ApiResponse::success(
            data: ActivityLogResource::collection($paginator->items()),
            message: 'Personal activity timeline retrieved successfully.',
            meta: [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }
}
