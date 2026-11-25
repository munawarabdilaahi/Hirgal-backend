<?php

namespace App\Http\Controllers\Web;

use App\Actions\Auth\AcceptInvitationAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\AcceptInvitationRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class InvitationController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('AcceptInvitation');
    }

    public function store(AcceptInvitationRequest $request, AcceptInvitationAction $accept): RedirectResponse
    {
        Auth::guard('web')->login($accept->accept($request->validated('token'), $request->validated()));

        return to_route('dashboard');
    }
}
