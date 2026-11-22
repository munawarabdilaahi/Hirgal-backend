<?php

namespace App\Services\Notification;

use App\Enums\AccountStatus;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Notifications\ProjectNotification;
use App\Notifications\TaskNotification;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

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

    /**
     * Delete/dismiss a single notification belonging to the authenticated user.
     *
     * The relation scope guarantees 404 for another user's notification.
     */
    public function deleteForUser(User $user, string $id): bool
    {
        $notification = $user->notifications()->whereKey($id)->firstOrFail();

        return (bool) $notification->delete();
    }

    /**
     * Safely dispatch a TaskNotification to eligible recipients after commit.
     *
     * @param  iterable<User>  $recipients
     * @param  array<string, mixed>  $metadata
     */
    public function notifyTask(
        Task $task,
        string $event,
        ?User $actor = null,
        iterable $recipients = [],
        array $metadata = []
    ): void {
        $validRecipients = $this->filterRecipients($recipients, $actor);

        if ($validRecipients->isEmpty()) {
            return;
        }

        $notification = new TaskNotification($task, $event, $actor, $metadata);

        if (DB::transactionLevel() > 0) {
            DB::afterCommit(fn () => Notification::send($validRecipients, $notification));
        } else {
            Notification::send($validRecipients, $notification);
        }
    }

    /**
     * Safely dispatch a ProjectNotification to eligible recipients after commit.
     *
     * @param  iterable<User>  $recipients
     * @param  array<string, mixed>  $metadata
     */
    public function notifyProject(
        Project $project,
        string $event,
        ?User $actor = null,
        iterable $recipients = [],
        array $metadata = []
    ): void {
        $validRecipients = $this->filterRecipients($recipients, $actor);

        if ($validRecipients->isEmpty()) {
            return;
        }

        $notification = new ProjectNotification($project, $event, $actor, $metadata);

        if (DB::transactionLevel() > 0) {
            DB::afterCommit(fn () => Notification::send($validRecipients, $notification));
        } else {
            Notification::send($validRecipients, $notification);
        }
    }

    /**
     * Filter recipients to active, non-actor, unique users who have not disabled in-app notifications.
     *
     * @param  iterable<User>  $recipients
     * @return Collection<int, User>
     */
    private function filterRecipients(iterable $recipients, ?User $actor): Collection
    {
        return collect($recipients)
            ->unique('id')
            ->filter(function (User $recipient) use ($actor): bool {
                if ($actor !== null && $recipient->id === $actor->id) {
                    return false;
                }

                if ($recipient->account_status !== AccountStatus::Active) {
                    return false;
                }

                $preferences = $recipient->profile?->notification_preferences ?? [];

                return (bool) ($preferences['in_app_notifications'] ?? $preferences['in_app'] ?? true);
            })
            ->values();
    }
}
