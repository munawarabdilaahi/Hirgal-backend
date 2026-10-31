<?php

namespace App\Http\Controllers\Api\V1\User;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\User\ListUsersRequest;
use App\Http\Requests\Api\V1\User\UpdateUserRequest;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\User;
use App\Services\User\UserService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class UserController extends Controller
{
    public function __construct(
        protected UserService $userService,
    ) {}

    /**
     * List all users with pagination and filtering.
     */
    public function index(ListUsersRequest $request): JsonResponse
    {
        $paginator = $this->userService->listUsers($request->validated());

        return ApiResponse::success(
            data: UserResource::collection($paginator->items()),
            message: 'User directory retrieved successfully.',
            meta: [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Display a specific user's details.
     */
    public function show(int $id): JsonResponse
    {
        $user = $this->userService->getUser($id);

        Gate::authorize('view', $user);

        return ApiResponse::success(
            data: new UserResource($user),
            message: 'User details retrieved.'
        );
    }

    /**
     * Update permitted user details and system role assignments.
     */
    public function update(UpdateUserRequest $request, int $id): JsonResponse
    {
        $targetUser = $this->userService->getUser($id);

        Gate::authorize('update', $targetUser);

        $updated = $this->userService->updateUser(
            actor: $request->user(),
            targetUser: $targetUser,
            data: $request->validated()
        );

        return ApiResponse::success(
            data: new UserResource($updated),
            message: 'User updated successfully.'
        );
    }

    /**
     * Activate a user account.
     */
    public function activate(Request $request, int $id): JsonResponse
    {
        $targetUser = $this->userService->getUser($id);

        Gate::authorize('activate', $targetUser);

        $activated = $this->userService->activateUser($targetUser);

        return ApiResponse::success(
            data: new UserResource($activated),
            message: 'User account activated successfully.'
        );
    }

    /**
     * Deactivate / suspend a user account.
     */
    public function deactivate(Request $request, int $id): JsonResponse
    {
        $targetUser = $this->userService->getUser($id);

        Gate::authorize('deactivate', $targetUser);

        $deactivated = $this->userService->deactivateUser($request->user(), $targetUser);

        return ApiResponse::success(
            data: new UserResource($deactivated),
            message: 'User account deactivated successfully.'
        );
    }
}
