<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Services\Security\TwoFactorAuthenticationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TwoFactorAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_with_valid_credentials_and_2fa_disabled_issues_token_directly(): void
    {
        $user = User::factory()->create([
            'email' => 'regular@example.test',
            'password' => 'Password123!',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'regular@example.test',
            'password' => 'Password123!',
        ])->assertOk();

        $response->assertJsonStructure([
            'success',
            'data' => [
                'access_token',
                'token_type',
                'user' => ['id', 'email'],
            ],
        ]);

        $this->assertFalse($response->json('data.two_factor_required', false));
        $this->assertNotEmpty($response->json('data.access_token'));
    }

    public function test_login_with_valid_credentials_and_2fa_enabled_returns_pending_challenge_without_token(): void
    {
        $user = User::factory()->create([
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
        ])->assertOk();

        $response->assertJsonPath('data.two_factor_required', true);
        $this->assertNotEmpty($response->json('data.challenge_token'));
        $this->assertNull($response->json('data.access_token'));
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertGuest('web');
    }

    public function test_login_with_invalid_credentials_returns_validation_error(): void
    {
        $user = User::factory()->create([
            'email' => 'user@example.test',
            'password' => 'Password123!',
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'user@example.test',
            'password' => 'WrongPassword!',
        ])->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    public function test_missing_authentication_challenge_returns_validation_error(): void
    {
        $this->postJson('/api/v1/auth/two-factor/verify', [
            'challenge_token' => '',
            'code' => '123456',
        ])->assertStatus(422)->assertJsonValidationErrors(['challenge_token']);

        $this->postJson('/api/v1/auth/two-factor/verify', [
            'code' => '123456',
        ])->assertStatus(422)->assertJsonValidationErrors(['challenge_token']);
    }

    public function test_invalid_totp_code_rejects_verification(): void
    {
        $user = User::factory()->create([
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
        ])->assertOk();

        $challengeToken = $login->json('data.challenge_token');

        $this->postJson('/api/v1/auth/two-factor/verify', [
            'challenge_token' => $challengeToken,
            'code' => '000000',
        ])->assertStatus(422)->assertJsonValidationErrors(['code']);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_valid_totp_code_completes_authentication_and_issues_token(): void
    {
        $service = app(TwoFactorAuthenticationService::class);
        $secret = $service->generateSecret();

        $user = User::factory()->create([
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => now(),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
        ])->assertOk();

        $challengeToken = $login->json('data.challenge_token');
        $code = $service->currentCode($secret);

        $verify = $this->postJson('/api/v1/auth/two-factor/verify', [
            'challenge_token' => $challengeToken,
            'code' => $code,
        ])->assertOk();

        $verify->assertJsonStructure([
            'data' => [
                'access_token',
                'token_type',
                'user' => ['id', 'email'],
            ],
        ]);

        $token = $verify->json('data.access_token');
        $this->assertNotEmpty($token);

        // Access protected endpoint with the issued token
        $this->withToken($token)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.email', 'twofa@example.test');
    }

    public function test_expired_challenge_is_rejected(): void
    {
        $service = app(TwoFactorAuthenticationService::class);
        $secret = $service->generateSecret();

        $user = User::factory()->create([
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => now(),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
        ])->assertOk();

        $challengeToken = $login->json('data.challenge_token');

        // Travel beyond the 5-minute TTL (301 seconds)
        $this->travel(301)->seconds();

        $code = $service->currentCode($secret);

        $this->postJson('/api/v1/auth/two-factor/verify', [
            'challenge_token' => $challengeToken,
            'code' => $code,
        ])->assertStatus(422)->assertJsonValidationErrors(['challenge']);
    }

    public function test_reused_challenge_is_rejected(): void
    {
        $service = app(TwoFactorAuthenticationService::class);
        $secret = $service->generateSecret();

        $user = User::factory()->create([
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => now(),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
        ])->assertOk();

        $challengeToken = $login->json('data.challenge_token');
        $code = $service->currentCode($secret);

        // First verification succeeds
        $this->postJson('/api/v1/auth/two-factor/verify', [
            'challenge_token' => $challengeToken,
            'code' => $code,
        ])->assertOk();

        // Attempting to reuse the same challenge must fail
        $this->postJson('/api/v1/auth/two-factor/verify', [
            'challenge_token' => $challengeToken,
            'code' => $code,
        ])->assertStatus(422)->assertJsonValidationErrors(['challenge']);
    }

    public function test_recovery_code_authenticates_and_consumes_the_code(): void
    {
        $service = app(TwoFactorAuthenticationService::class);
        $recoveryCodes = ['ABCD-1234', 'EFGH-5678'];

        $user = User::factory()->create([
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
            'two_factor_secret' => $service->generateSecret(),
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => $service->hashRecoveryCodes($recoveryCodes),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
        ])->assertOk();

        $challengeToken = $login->json('data.challenge_token');

        $this->postJson('/api/v1/auth/two-factor/recovery', [
            'challenge_token' => $challengeToken,
            'recovery_code' => 'ABCD-1234',
        ])->assertOk()->assertJsonStructure(['data' => ['access_token']]);

        // Code was consumed; only 1 code remains
        $this->assertCount(1, $user->fresh()->two_factor_recovery_codes);
    }

    public function test_reused_recovery_code_is_rejected(): void
    {
        $service = app(TwoFactorAuthenticationService::class);
        $recoveryCodes = ['ABCD-1234'];

        $user = User::factory()->create([
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
            'two_factor_secret' => $service->generateSecret(),
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => $service->hashRecoveryCodes($recoveryCodes),
        ]);

        // Login challenge 1
        $login1 = $this->postJson('/api/v1/auth/login', [
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
        ])->assertOk();

        $this->postJson('/api/v1/auth/two-factor/recovery', [
            'challenge_token' => $login1->json('data.challenge_token'),
            'recovery_code' => 'ABCD-1234',
        ])->assertOk();

        // Login challenge 2
        $login2 = $this->postJson('/api/v1/auth/login', [
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
        ])->assertOk();

        // Attempting to reuse the consumed recovery code must fail
        $this->postJson('/api/v1/auth/two-factor/recovery', [
            'challenge_token' => $login2->json('data.challenge_token'),
            'recovery_code' => 'ABCD-1234',
        ])->assertStatus(422)->assertJsonValidationErrors(['recovery_code']);
    }

    public function test_excessive_verification_attempts_invalidates_challenge(): void
    {
        $service = app(TwoFactorAuthenticationService::class);
        $user = User::factory()->create([
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
            'two_factor_secret' => $service->generateSecret(),
            'two_factor_confirmed_at' => now(),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
        ])->assertOk();

        $challengeToken = $login->json('data.challenge_token');

        // Make 4 failed attempts
        for ($i = 0; $i < 4; $i++) {
            $this->postJson('/api/v1/auth/two-factor/verify', [
                'challenge_token' => $challengeToken,
                'code' => '000000',
            ])->assertStatus(422)->assertJsonValidationErrors(['code']);
        }

        // 5th attempt triggers excessive attempts invalidation
        $this->postJson('/api/v1/auth/two-factor/verify', [
            'challenge_token' => $challengeToken,
            'code' => '000000',
        ])->assertStatus(422)->assertJsonValidationErrors(['challenge']);

        // Challenge is now permanently invalidated even if correct code is provided
        $this->postJson('/api/v1/auth/two-factor/verify', [
            'challenge_token' => $challengeToken,
            'code' => $service->currentCode($user->two_factor_secret),
        ])->assertStatus(422)->assertJsonValidationErrors(['challenge']);
    }

    public function test_attempt_to_access_protected_endpoints_before_completing_2fa_is_blocked(): void
    {
        $user = User::factory()->create([
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
        ])->assertOk();

        $challengeToken = $login->json('data.challenge_token');

        // Attempting to use the challenge token as a Bearer token must fail
        $this->withToken($challengeToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        // No token provided must also fail
        $this->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    public function test_no_fully_authenticated_session_issued_before_successful_2fa(): void
    {
        $user = User::factory()->create([
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'twofa@example.test',
            'password' => 'Password123!',
        ])->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertGuest('web');
        $this->assertGuest('sanctum');
    }
}
