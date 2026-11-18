<?php

namespace App\Http\Controllers\Web;

use App\Actions\Auth\UpdateUserProfileAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\UpdateProfileRequest;
use App\Http\Resources\Api\V1\UserResource;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        Inertia::encryptHistory();

        return Inertia::render('AccountSettings', [
            'user' => (new UserResource($request->user()->load(['roles.permissions', 'profile'])))
                ->response($request)->getData(true)['data'],
            'frontendUrl' => rtrim(config('app.frontend_url'), '/'),
        ]);
    }

    public function update(UpdateProfileRequest $request, UpdateUserProfileAction $update): RedirectResponse
    {
        $update->execute($request->user(), $request->validated());

        return to_route('profile.edit');
    }
}
