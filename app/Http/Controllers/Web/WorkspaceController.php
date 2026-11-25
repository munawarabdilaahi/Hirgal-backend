<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\UserResource;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceController extends Controller
{
    public function __invoke(Request $request): Response
    {
        Inertia::encryptHistory();

        return Inertia::render('Workspace', [
            'user' => (new UserResource($request->user()->load(['roles.permissions', 'profile'])))
                ->response($request)->getData(true)['data'],
            'frontendUrl' => rtrim(config('app.frontend_url'), '/'),
        ]);
    }
}
