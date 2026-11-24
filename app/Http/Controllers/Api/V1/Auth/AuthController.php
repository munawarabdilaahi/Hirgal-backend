<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\LoginRequest;
use App\Http\Requests\Api\V1\Auth\RegisterRequest;
use App\Http\Requests\Api\V1\Auth\UpdateProfileRequest;
use App\Http\Resources\Api\V1\AuthTokenResource;
use App\Http\Resources\Api\V1\UserResource;
use App\Services\Auth\AuthenticationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class AuthController extends Controller
{
    public function __construct(
        protected AuthenticationService $authService,
    ) {}

    /**
     * Register a new user when public registration is enabled.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->authService->register($request->validated());

        return ApiResponse::success(
            data: new AuthTokenResource($result['token'], $result['user']),
            message: 'User registered successfully.',
            status: Response::HTTP_CREATED
        );
    }

    /**
     * Authenticate user credentials and return an access token or 2FA challenge.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login(
            email: $request->validated('email'),
            password: $request->validated('password'),
            deviceName: $request->validated('device_name'),
            twoFactorCode: $request->validated('two_factor_code')
        );

        if (! empty($result['two_factor_required'])) {
            return ApiResponse::success(
                data: [
                    'two_factor_required' => true,
                    'challenge_token' => $result['challenge_token'],
                    'expires_at' => $result['expires_at'],
                ],
                message: 'Two-factor authentication challenge required.'
            );
        }

        return ApiResponse::success(
            data: new AuthTokenResource($result['token'], $result['user']),
            message: 'Authenticated successfully.'
        );
    }

    /**
     * Verify a two-factor authentication challenge code.
     */
    public function verifyTwoFactor(Request $request): JsonResponse
    {
        $input = $request->validate([
            'challenge_token' => ['required', 'string'],
            'code' => ['nullable', 'string', 'max:32'],
            'recovery_code' => ['nullable', 'string', 'max:32'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $code = $input['code'] ?? $input['recovery_code'] ?? null;
        if ($code === null || trim($code) === '') {
            throw ValidationException::withMessages([
                'code' => ['The authentication code is required.'],
            ]);
        }

        $result = $this->authService->verifyTwoFactorChallenge(
            challengeToken: $input['challenge_token'],
            code: trim($code),
            isRecovery: ! empty($input['recovery_code']),
            deviceName: $input['device_name'] ?? null
        );

        return ApiResponse::success(
            data: new AuthTokenResource($result['token'], $result['user']),
            message: 'Authenticated successfully.'
        );
    }

    /**
     * Verify a two-factor recovery code directly.
     */
    public function verifyRecoveryCode(Request $request): JsonResponse
    {
        $input = $request->validate([
            'challenge_token' => ['required', 'string'],
            'recovery_code' => ['required', 'string', 'max:32'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $result = $this->authService->verifyTwoFactorChallenge(
            challengeToken: $input['challenge_token'],
            code: trim($input['recovery_code']),
            isRecovery: true,
            deviceName: $input['device_name'] ?? null
        );

        return ApiResponse::success(
            data: new AuthTokenResource($result['token'], $result['user']),
            message: 'Authenticated successfully.'
        );
    }

    /**
     * Cancel an active two-factor challenge.
     */
    public function cancelTwoFactor(Request $request): JsonResponse
    {
        $input = $request->validate([
            'challenge_token' => ['required', 'string'],
        ]);

        $this->authService->cancelTwoFactorChallenge($input['challenge_token']);

        return ApiResponse::success(
            message: 'Two-factor challenge cancelled.'
        );
    }

    /**
     * Log out the current user session/token.
     */
    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout($request->user());

        return ApiResponse::success(
            data: null,
            message: 'Successfully logged out.'
        );
    }

    /**
     * Invalidate all access tokens across all devices for this user.
     */
    public function logoutAll(Request $request): JsonResponse
    {
        $this->authService->logout($request->user(), allDevices: true);

        return ApiResponse::success(
            data: null,
            message: 'Successfully logged out from all devices.'
        );
    }

    /**
     * Get the authenticated user's profile and permissions.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['roles.permissions', 'profile']);

        return ApiResponse::success(
            data: new UserResource($user),
            message: 'Authenticated user profile retrieved.'
        );
    }

    /**
     * Update permitted profile fields for the authenticated user.
     */
    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $this->authService->updateProfile($request->user(), $request->validated());

        return ApiResponse::success(
            data: new UserResource($user),
            message: 'Profile updated successfully.'
        );
    }
}
