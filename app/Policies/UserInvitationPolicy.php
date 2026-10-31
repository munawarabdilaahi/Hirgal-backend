<?php

namespace App\Policies;

use App\Models\User;
use App\Models\UserInvitation;

class UserInvitationPolicy
{
    /**
     * Determine whether the user can view invitation lists.
     */
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission('users.invite') || $actor->hasPermission('users.view');
    }

    /**
     * Determine whether the user can dispatch onboarding invitations.
     */
    public function create(User $actor): bool
    {
        return $actor->hasPermission('users.invite');
    }

    /**
     * Determine whether the user can resend a specific invitation.
     */
    public function resend(User $actor, UserInvitation $invitation): bool
    {
        return $actor->hasPermission('users.invite');
    }

    /**
     * Determine whether the user can revoke an invitation.
     */
    public function delete(User $actor, UserInvitation $invitation): bool
    {
        return $actor->hasPermission('users.invite');
    }
}
