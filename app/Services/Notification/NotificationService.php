<?php

namespace App\Services\Notification;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Notifications\DatabaseNotification;

class NotificationService
{
    /**
     * List the authenticated user's notifications, newest first.
     *
     * Ownership is enforced through the morphMany relation (notifiable_type +
     * notifiable_id), which cannot be widened by the global Gate::before
     * System Admin bypass because no Gate check is consulted here.
     *
     * @param  array<string, mixed>  $filters
     */
    public function listForUser(User $user, array $filters): LengthAwarePaginator
    {
        $query = $user->notifications()->reorder();

        if (($filters['status'] ?? null) === 'unread') {
            $query->whereNull('read_at');
        } elseif (($filters['status'] ?? null) === 'read') {
            $query->whereNotNull('read_at');
        }

        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        return $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();
    }

    /**
     * Count only the authenticated user's unread notifications (DB aggregate).
     */
    public function unreadCountForUser(User $user): int
    {
        return $user->notifications()->whereNull('read_at')->count();
    }

    /**
     * Mark one of the authenticated user's notifications as read.
     *
     * The relation scope guarantees 404 for another user's notification or an
     * unknown id, without revealing whether the record exists elsewhere.
     */
    public function markAsReadForUser(User $user, string $id): DatabaseNotification
    {
        $notification = $user->notifications()->whereKey($id)->firstOrFail();

        $notification->markAsRead();

        return $notification;
    }

    /**
     * Mark all of the authenticated user's unread notifications as read via a
     * single relation-scoped UPDATE; returns the affected row count.
     */
    public function markAllAsReadForUser(User $user): int
    {
        return $user->notifications()->whereNull('read_at')->update(['read_at' => now()]);
    }
}
