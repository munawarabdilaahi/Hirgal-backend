<?php

namespace App\Policies;

use App\Models\ActivityLog;
use App\Models\User;

class ActivityLogPolicy
{
    /**
     * System-wide audit access is gated by the audit.view ability.
     */
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission('audit.view');
    }

    /**
     * A single record is visible to its owner or to audit.view holders.
     */
    public function view(User $actor, ActivityLog $log): bool
    {
        return $actor->id === $log->user_id || $actor->hasPermission('audit.view');
    }

    /**
     * Audit records are append-only through the ActivityLogger write path.
     */
    public function create(User $actor): bool
    {
        return false;
    }

    public function update(User $actor, ActivityLog $log): bool
    {
        return false;
    }

    public function delete(User $actor, ActivityLog $log): bool
    {
        return false;
    }
}
