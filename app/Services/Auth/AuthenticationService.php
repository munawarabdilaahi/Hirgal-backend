<?php

namespace App\Services\Auth;

use App\Actions\Auth\ChangePasswordAction;
use App\Actions\Auth\LoginUserAction;
use App\Actions\Auth\LogoutUserAction;
use App\Actions\Auth\RegisterUserAction;
use App\Actions\Auth\ResetPasswordAction;
use App\Actions\Auth\SendPasswordResetLinkAction;
use App\Actions\Auth\UpdateUserProfileAction;
use App\Models\User;
use App\Services\Security\TwoFactorChallengeService;

class AuthenticationService
{
    public function __construct(
        protected RegisterUserAction $registerUserAction,
        protected LoginUserAction $loginUserAction,
        protected LogoutUserAction $logoutUserAction,
        protected SendPasswordResetLinkAction $sendPasswordResetLinkAction,
        protected ResetPasswordAction $resetPasswordAction,
        protected ChangePasswordAction $changePasswordAction,
        protected UpdateUserProfileAction $updateUserProfileAction,
        protected TwoFactorChallengeService $challengeService,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array{user: User, token: string}
     */
    public function register(array $data): array
    {
        return $this->registerUserAction->execute($data);
    }

    /**
     * @return array{user: ?User, token: ?string, two_factor_required: bool, challenge_token?: string, expires_at?: string}
     */
    public function login(string $email, string $password, ?string $deviceName = null, ?string $twoFactorCode = null): array
    {
        return $this->loginUserAction->execute($email, $password, $deviceName, $twoFactorCode);
    }

    /**
     * @return array{user: User, token: string}
     */
    public function verifyTwoFactorChallenge(
        string $challengeToken,
        string $code,
        bool $isRecovery = false,
        ?string $deviceName = null
    ): array {
        return $this->challengeService->verifyChallenge($challengeToken, $code, $isRecovery, $deviceName);
    }

    public function cancelTwoFactorChallenge(string $challengeToken): void
    {
        $this->challengeService->invalidateChallenge($challengeToken);
    }

    public function logout(User $user, bool $allDevices = false): void
    {
        $this->logoutUserAction->execute($user, $allDevices);
    }

    public function sendPasswordResetLink(string $email): void
    {
        $this->sendPasswordResetLinkAction->execute($email);
    }

    public function resetPassword(string $email, string $token, string $password): void
    {
        $this->resetPasswordAction->execute($email, $token, $password);
    }

    public function changePassword(User $user, string $newPassword, bool $logoutOtherDevices = false): void
    {
        $this->changePasswordAction->execute($user, $newPassword, $logoutOtherDevices);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateProfile(User $user, array $data): User
    {
        return $this->updateUserProfileAction->execute($user, $data);
    }
}
