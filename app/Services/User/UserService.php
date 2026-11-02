<?php

namespace App\Services\User;

use App\Actions\User\ActivateUserAction;
use App\Actions\User\DeactivateUserAction;
use App\Actions\User\UpdateUserAction;
use App\Enums\AccountStatus;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class UserService
{
    public function __construct(
        protected UpdateUserAction $updateUserAction,
        protected ActivateUserAction $activateUserAction,
        protected DeactivateUserAction $deactivateUserAction,
    ) {}

    /**
     * List users with optional filtering, sorting, and pagination.
     *
     * @param  array<string, mixed>  $filters
     */
    public function listUsers(array $filters): LengthAwarePaginator
    {
        $query = User::with(['roles.permissions', 'profile']);

        if (! empty($filters['search'])) {
            $search = '%'.$filters['search'].'%';
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', $search)
                    ->orWhere('email', 'like', $search);
            });
        }

        if (! empty($filters['status'])) {
            $query->where('account_status', $filters['status']);
        }

        if (! empty($filters['role'])) {
            $roleSlug = $filters['role'];
            $query->whereHas('roles', fn ($q) => $q->where('slug', $roleSlug));
        }

        $sortBy = $filters['sort_by'] ?? 'created_at';
        $sortDirection = $filters['sort_direction'] ?? 'desc';
        $perPage = (int) ($filters['per_page'] ?? 15);

        return $query->orderBy($sortBy, $sortDirection)->paginate($perPage);
    }

    /**
     * List active users for the collaborative directory.
     *
     * @param  array<string, mixed>  $filters
     */
    public function listDirectory(array $filters): LengthAwarePaginator
    {
        $query = User::with('profile')
            ->where('account_status', AccountStatus::Active);

        if (! empty($filters['search'])) {
            $search = '%'.$filters['search'].'%';
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', $search)
                    ->orWhere('email', 'like', $search)
                    ->orWhereHas('profile', function ($pq) use ($search) {
                        $pq->where('job_title', 'like', $search)
                            ->orWhere('department', 'like', $search);
                    });
            });
        }

        if (! empty($filters['department'])) {
            $department = $filters['department'];
            $query->whereHas('profile', fn ($q) => $q->where('department', $department));
        }

        $perPage = (int) ($filters['per_page'] ?? 20);

        return $query->orderBy('name', 'asc')->paginate($perPage);
    }

    /**
     * Retrieve individual user by ID with relations.
     */
    public function getUser(int $id): User
    {
        return User::with(['roles.permissions', 'profile'])->findOrFail($id);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateUser(User $actor, User $targetUser, array $data): User
    {
        return $this->updateUserAction->execute($actor, $targetUser, $data);
    }

    public function activateUser(User $targetUser): User
    {
        return $this->activateUserAction->execute($targetUser);
    }

    public function deactivateUser(User $actor, User $targetUser): User
    {
        return $this->deactivateUserAction->execute($actor, $targetUser);
    }
}
