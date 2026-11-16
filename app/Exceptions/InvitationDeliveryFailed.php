<?php

namespace App\Exceptions;

use App\Support\ApiResponse;
use Exception;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class InvitationDeliveryFailed extends Exception
{
    public function render(): JsonResponse
    {
        return ApiResponse::error(
            message: $this->getMessage(),
            status: Response::HTTP_SERVICE_UNAVAILABLE,
            errorCode: 'INVITATION_DELIVERY_UNAVAILABLE',
        );
    }
}
