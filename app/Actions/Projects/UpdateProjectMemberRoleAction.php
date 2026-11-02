<?php

namespace App\Actions\Projects;

use App\Enums\ProjectMemberRole;
use App\Models\ProjectMember;
use App\Models\User;
use App\Policies\ProjectPolicy;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class UpdateProjectMemberRoleAction
{
    /**
     * Change a member's contextual project role after re-validating the grant matrix.
     *
     * @throws AuthorizationException
     */
    public function execute(User $actor, ProjectMember $member, string $role): ProjectMember
    {
        return DB::transaction(function () use ($actor, $member, $role): ProjectMember {
            $project = $member->project;

            if ($member->user_id === $project->owner_id && ! $actor->isSystemAdmin()) {
                throw new AuthorizationException('The project owner membership cannot be demoted.');
            }

            $targetRole = ProjectMemberRole::tryFrom($role);

            if ($targetRole === null || $targetRole === ProjectMemberRole::Owner) {
                throw new AuthorizationException('The owner project role cannot be granted through membership management.');
            }

            $actorRole = ProjectPolicy::contextualRole($actor, $project);

            $assignable = $actorRole === ProjectMemberRole::Owner
                ? [ProjectMemberRole::Lead, ProjectMemberRole::Member, ProjectMemberRole::Viewer]
                : [ProjectMemberRole::Member, ProjectMemberRole::Viewer];

            if (! in_array($targetRole, $assignable, true)) {
                throw new AuthorizationException('You are not authorized to grant this project role.');
            }

            $member->update(['role' => $targetRole]);

            return $member->fresh();
        });
    }
}
