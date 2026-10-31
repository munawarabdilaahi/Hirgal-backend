<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\AcceptInvitationRequest;
use App\Http\Resources\Api\V1\AuthTokenResource;
use App\Http\Resources\Api\V1\UserInvitationResource;
use App\Services\Auth\InvitationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class InvitationController extends Controller
{
    public function __construct(
        protected InvitationService $invitationService,
    ) {}

    /**
     * Inspect and verify an invitation token prior to acceptance.
     */
    public function show(string $token): JsonResponse
    {
        $invitation = $this->invitationService->getInvitationByToken($token);

        return ApiResponse::success(
            data: new UserInvitationResource($invitation),
            message: 'Invitation details verified.'
        );
    }

    /**
     * Accept an invitation, set password, and create user account.
     */
    public function accept(AcceptInvitationRequest $request, string $token): JsonResponse
    {
        $result = $this->invitationService->acceptInvitation($token, $request->validated());

        return ApiResponse::success(
            data: new AuthTokenResource($result['token'], $result['user']),
            message: 'Invitation accepted and account activated successfully.',
            status: Response::HTTP_CREATED
        );
    }
}
