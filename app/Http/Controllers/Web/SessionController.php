<?php

namespace App\Http\Controllers\Web;

use App\Actions\Auth\LoginUserAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\LoginRequest;
use App\Http\Resources\Api\V1\UserResource;
use App\Services\Security\TwoFactorChallengeService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SessionController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Login', [
            'sessionMessage' => session('sessionMessage'),
        ]);
    }

    public function store(LoginRequest $request, LoginUserAction $login, TwoFactorChallengeService $challengeService): RedirectResponse
    {
        try {
            $user = $login->validateCredentials(
                $request->validated('email'),
                $request->validated('password')
            );
        } catch (AuthorizationException) {
            throw ValidationException::withMessages([
                'email' => 'Unable to sign in. Please contact an administrator.',
            ]);
        } catch (ValidationException $exception) {
            return redirect()
                ->route('login')
                ->withErrors($exception->errors())
                ->withInput($request->only('email'));
        }

        if ($user->hasTwoFactorAuthentication()) {
            $challenge = $challengeService->createChallenge(
                $user,
                $request->userAgent(),
                $request->boolean('remember')
            );

            session([
                'login.2fa' => [
                    'challenge_token' => $challenge['challenge_token'],
                    'user_id' => $user->id,
                    'remember' => $request->boolean('remember'),
                ],
            ]);

            return redirect()->route('two-factor.challenge');
        }

        Auth::guard('web')->login($user, $request->boolean('remember'));
        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        return redirect()->intended(route('dashboard'));
    }

    public function createTwoFactor(Request $request, TwoFactorChallengeService $challengeService): Response|RedirectResponse
    {
        $challengeSession = session('login.2fa');
        if (! $challengeSession || ! isset($challengeSession['challenge_token'])) {
            return redirect()->route('login');
        }

        $challenge = $challengeService->getChallenge($challengeSession['challenge_token']);
        if (! $challenge) {
            session()->forget('login.2fa');

            return redirect()->route('login')->with('sessionMessage', 'Your authentication session has expired. Please sign in again.');
        }

        return Inertia::render('TwoFactorChallenge', [
            'challenge_token' => $challengeSession['challenge_token'],
            'sessionMessage' => session('sessionMessage'),
        ]);
    }

    public function storeTwoFactor(Request $request, TwoFactorChallengeService $challengeService): RedirectResponse
    {
        $challengeSession = session('login.2fa');
        $challengeToken = $request->input('challenge_token') ?: ($challengeSession['challenge_token'] ?? null);

        if (! $challengeToken) {
            return redirect()->route('login')->with('sessionMessage', 'Your authentication session has expired. Please sign in again.');
        }

        $code = $request->input('code') ?: $request->input('recovery_code');

        if (! $code || trim($code) === '') {
            $key = $request->has('recovery_code') ? 'recovery_code' : 'code';

            return redirect()
                ->route('two-factor.challenge')
                ->withErrors([$key => 'The authentication code is required.']);
        }

        try {
            $result = $challengeService->verifyChallenge(
                challengeToken: $challengeToken,
                code: trim($code),
                isRecovery: (bool) $request->input('recovery_code')
            );
        } catch (ValidationException $exception) {
            $errors = $exception->errors();

            if (isset($errors['challenge'])) {
                session()->forget('login.2fa');

                return redirect()->route('login')->withErrors(['email' => $errors['challenge'][0]]);
            }

            return redirect()
                ->route('two-factor.challenge')
                ->withErrors($errors);
        }

        session()->forget('login.2fa');
        $remember = (bool) ($challengeSession['remember'] ?? false);
        Auth::guard('web')->login($result['user'], $remember);

        return redirect()->intended(route('dashboard'));
    }

    public function cancelTwoFactor(Request $request, TwoFactorChallengeService $challengeService): RedirectResponse
    {
        $challengeSession = session('login.2fa');
        if ($challengeSession && isset($challengeSession['challenge_token'])) {
            $challengeService->invalidateChallenge($challengeSession['challenge_token']);
        }

        session()->forget('login.2fa');

        return redirect()->route('login');
    }

    public function dashboard(Request $request): Response
    {
        $user = $request->user();

        Inertia::encryptHistory();

        return Inertia::render('Dashboard', [
            'user' => (new UserResource($user->load(['roles.permissions', 'profile'])))
                ->response($request)->getData(true)['data'],
            'frontendUrl' => rtrim(config('app.frontend_url'), '/'),
        ]);
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        Inertia::clearHistory();

        return to_route('login');
    }
}
