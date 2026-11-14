<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'workspace';

    public function urlResolver(): Closure
    {
        return fn (Request $request): string => $request->routeIs('password.reset', 'invitations.accept')
            ? $request->getBaseUrl().$request->getPathInfo()
            : $request->getRequestUri();
    }
}
