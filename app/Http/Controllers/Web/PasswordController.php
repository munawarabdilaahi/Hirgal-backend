<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\ForgotPasswordRequest;
use App\Http\Requests\Api\V1\Auth\ResetPasswordRequest;
use App\Services\Auth\AuthenticationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class PasswordController extends Controller
{
    public function requestLink(): Response
    {
        return Inertia::render('ForgotPassword');
    }

    public function sendLink(ForgotPasswordRequest $request, AuthenticationService $auth): RedirectResponse
    {
        $auth->sendPasswordResetLink($request->validated('email'));

        return to_route('password.request');
    }

    public function edit(): Response
    {
        return Inertia::render('ResetPassword');
    }

    public function update(ResetPasswordRequest $request, AuthenticationService $auth): RedirectResponse
    {
        $email = $request->validated('email');
        $auth->resetPassword($email, $request->validated('token'), $request->validated('password'));

        if ($request->user()?->email === $email) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            Inertia::clearHistory();
        }

        return to_route('login')->with('sessionMessage', 'Your password has been reset. Sign in with your new password.');
    }
}
