<?php

namespace App\Services\User;

use App\Actions\User\CreateUserInvitationAction;
use App\Actions\User\ResendUserInvitationAction;
use App\Actions\User\RevokeUserInvitationAction;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class UserInvitationService
{
    public function __construct(
        protected CreateUserInvitationAction $createUserInvitationAction,
        protected ResendUserInvitationAction $resendUserInvitationAction,
        protected RevokeUserInvitationAction $revokeUserInvitationAction,
    ) {}

    /**
     * List user invitations with filtering and pagination.
     *
     * @param  array<string, mixed>  $filters
     */
    public function listInvitations(array $filters): LengthAwarePaginator
    {
        $query = UserInvitation::with(['role', 'inviter']);

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['search'])) {
            $query->where('email', 'like', '%'.$filters['search'].'%');
        }

        $perPage = (int) ($filters['per_page'] ?? 15);

        return $query->latest()->paginate($perPage);
    }

    /**
     * @param  array{email: string, role_id: int}  $data
     * @return array{invitation: UserInvitation, raw_token: string}
     */
    public function createInvitation(User $actor, array $data): array
    {
        return $this->createUserInvitationAction->execute($actor, $data);
    }

    /**
     * @return array{invitation: UserInvitation, raw_token: string}
     */
    public function resendInvitation(UserInvitation $invitation): array
    {
        return $this->resendUserInvitationAction->execute($invitation);
    }

    public function revokeInvitation(UserInvitation $invitation): UserInvitation
    {
        return $this->revokeUserInvitationAction->execute($invitation);
    }
}
