<?php

namespace App\Http\Middleware;

use App\Enums\AccountStatus;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountIsActive
{
    /**
     * Handle an incoming request and ensure user account is active.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->account_status !== AccountStatus::Active) {
            if (! $request->is('api/*')) {
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();
                Inertia::clearHistory();

                return to_route('login')->with('sessionMessage', 'Your account is not active. Please contact an administrator.');
            }

            $status = $user->account_status?->value ?? 'inactive';

            return ApiResponse::error(
                message: "Your account is {$status}. Please contact an administrator.",
                status: Response::HTTP_FORBIDDEN,
                errorCode: 'ACCOUNT_NOT_ACTIVE'
            );
        }

        return $next($request);
    }
}
