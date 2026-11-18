<?php

namespace App\Http\Controllers\Web;

use App\Actions\Auth\LoginUserAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\LoginRequest;
use App\Http\Resources\Api\V1\UserResource;
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

    public function store(LoginRequest $request, LoginUserAction $login): RedirectResponse
    {
        try {
            $user = $login->authenticate(
                $request->validated('email'),
                $request->validated('password'),
                $request->validated('two_factor_code')
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

        Auth::guard('web')->login($user);

        return to_route('dashboard');
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
