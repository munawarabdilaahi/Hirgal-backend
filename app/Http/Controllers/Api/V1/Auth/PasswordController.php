<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\ChangePasswordRequest;
use App\Http\Requests\Api\V1\Auth\ForgotPasswordRequest;
use App\Http\Requests\Api\V1\Auth\ResetPasswordRequest;
use App\Services\Auth\AuthenticationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class PasswordController extends Controller
{
    public function __construct(
        protected AuthenticationService $authService,
    ) {}

    /**
     * Dispatch a password reset link to the given email address.
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $this->authService->sendPasswordResetLink($request->validated('email'));

        return ApiResponse::success(
            data: null,
            message: 'If an account matches that email address, a password reset link has been dispatched.'
        );
    }

    /**
     * Reset the user password using a verified reset token.
     */
    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $this->authService->resetPassword(
            email: $request->validated('email'),
            token: $request->validated('token'),
            password: $request->validated('password')
        );

        return ApiResponse::success(
            data: null,
            message: 'Password has been successfully reset. Please log in with your new password.'
        );
    }

    /**
     * Change password for the currently authenticated user.
     */
    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $this->authService->changePassword(
            user: $request->user(),
            newPassword: $request->validated('password'),
            logoutOtherDevices: (bool) $request->validated('logout_other_devices', false)
        );

        return ApiResponse::success(
            data: null,
            message: 'Password successfully updated.'
        );
    }
}
