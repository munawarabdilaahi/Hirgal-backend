<?php

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Notifications\ListNotificationsRequest;
use App\Http\Resources\Api\V1\NotificationResource;
use App\Services\Notification\NotificationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct(
        protected NotificationService $notifications,
    ) {}

    /**
     * List the authenticated user's own notifications.
     */
    public function index(ListNotificationsRequest $request): JsonResponse
    {
        $paginator = $this->notifications->listForUser($request->user(), $request->validated());

        return ApiResponse::success(
            data: NotificationResource::collection($paginator->items()),
            message: 'Notifications retrieved successfully.',
            meta: [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Return the authenticated user's unread notification count.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        return ApiResponse::success(
            data: ['unread_count' => $this->notifications->unreadCountForUser($request->user())],
            message: 'Unread notification count retrieved successfully.'
        );
    }

    /**
     * Mark one of the authenticated user's notifications as read (404 otherwise).
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $this->notifications->markAsReadForUser($request->user(), $id);

        return ApiResponse::success(
            data: new NotificationResource($notification),
            message: 'Notification marked as read.'
        );
    }

    /**
     * Mark all of the authenticated user's unread notifications as read.
     */
    public function readAll(Request $request): JsonResponse
    {
        $updated = $this->notifications->markAllAsReadForUser($request->user());

        return ApiResponse::success(
            data: ['updated' => $updated],
            message: 'All notifications marked as read.'
        );
    }
}
