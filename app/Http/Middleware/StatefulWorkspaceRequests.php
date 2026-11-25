<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Symfony\Component\HttpFoundation\Response;

class StatefulWorkspaceRequests extends EnsureFrontendRequestsAreStateful
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle($request, $next): Response
    {
        if ($request->header('X-Hirgal-Session') !== '1') {
            return $next($request);
        }

        return parent::handle($request, $next);
    }
}
