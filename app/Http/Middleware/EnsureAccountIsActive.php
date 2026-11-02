<?php

namespace App\Http\Middleware;

use App\Enums\AccountStatus;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
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
