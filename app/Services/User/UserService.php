<?php

namespace App\Services\User;

use App\Actions\User\ActivateUserAction;
use App\Actions\User\DeactivateUserAction;
use App\Actions\User\UpdateUserAction;
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
     * @return LengthAwarePaginator
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
     * Retrieve individual user by ID with relations.
     *
     * @param  int  $id
     * @return User
     */
    public function getUser(int $id): User
    {
        return User::with(['roles.permissions', 'profile'])->findOrFail($id);
    }

    /**
     * @param  User  $actor
     * @param  User  $targetUser
     * @param  array<string, mixed>  $data
     * @return User
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
