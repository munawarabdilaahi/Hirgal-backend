<?php

namespace App\Http\Controllers\Api\V1\User;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\User\CreateInvitationRequest;
use App\Http\Resources\Api\V1\UserInvitationResource;
use App\Models\UserInvitation;
use App\Services\User\UserInvitationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class UserInvitationController extends Controller
{
    public function __construct(
        protected UserInvitationService $invitationService,
    ) {}

    /**
     * List dispatched invitations with status filtering.
     */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', UserInvitation::class);

        $paginator = $this->invitationService->listInvitations($request->all());

        return ApiResponse::success(
            data: UserInvitationResource::collection($paginator->items()),
            message: 'Invitations list retrieved successfully.',
            meta: [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Dispatch an invitation to onboard a new user.
     */
    public function store(CreateInvitationRequest $request): JsonResponse
    {
        $result = $this->invitationService->createInvitation(
            actor: $request->user(),
            data: $request->validated()
        );

        $meta = [];
        if (! app()->isProduction()) {
            $meta['invitation_token'] = $result['raw_token'];
        }

        return ApiResponse::success(
            data: new UserInvitationResource($result['invitation']),
            message: 'Invitation dispatched successfully.',
            status: Response::HTTP_CREATED,
            meta: $meta
        );
    }

    /**
     * Resend an outstanding invitation with a fresh token.
     */
    public function resend(Request $request, int $id): JsonResponse
    {
        $invitation = UserInvitation::findOrFail($id);

        Gate::authorize('resend', $invitation);

        $result = $this->invitationService->resendInvitation($invitation);

        $meta = [];
        if (! app()->isProduction()) {
            $meta['invitation_token'] = $result['raw_token'];
        }

        return ApiResponse::success(
            data: new UserInvitationResource($result['invitation']),
            message: 'Invitation resent successfully.',
            meta: $meta
        );
    }

    /**
     * Revoke a pending invitation.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $invitation = UserInvitation::findOrFail($id);

        Gate::authorize('delete', $invitation);

        $revoked = $this->invitationService->revokeInvitation($invitation);

        return ApiResponse::success(
            data: new UserInvitationResource($revoked),
            message: 'Invitation revoked successfully.'
        );
    }
}
