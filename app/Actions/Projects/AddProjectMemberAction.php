<?php

namespace App\Actions\Projects;

use App\Enums\ProjectMemberRole;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Policies\ProjectPolicy;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AddProjectMemberAction
{
    /**
     * Add a user to the project with a contextual project role.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws AuthorizationException
     */
    public function execute(User $actor, Project $project, array $data): ProjectMember
    {
        return DB::transaction(function () use ($actor, $project, $data): ProjectMember {
            $role = ProjectMemberRole::tryFrom((string) ($data['role'] ?? ProjectMemberRole::Member->value));

            if ($role === null || $role === ProjectMemberRole::Owner) {
                throw new AuthorizationException('The owner project role cannot be granted through membership management.');
            }

            $existing = ProjectMember::query()
                ->where('project_id', $project->id)
                ->where('user_id', (int) $data['user_id'])
                ->first();

            if ($existing !== null) {
                throw ValidationException::withMessages([
                    'user_id' => 'This user is already a member of the project.',
                ]);
            }

            $actorRole = ProjectPolicy::contextualRole($actor, $project);

            $assignable = $actorRole === ProjectMemberRole::Owner
                ? [ProjectMemberRole::Lead, ProjectMemberRole::Member, ProjectMemberRole::Viewer]
                : [ProjectMemberRole::Member, ProjectMemberRole::Viewer];

            if (! in_array($role, $assignable, true)) {
                throw new AuthorizationException('You are not authorized to grant this project role.');
            }

            return ProjectMember::firstOrCreate(
                [
                    'project_id' => $project->id,
                    'user_id' => (int) $data['user_id'],
                ],
                [
                    'role' => $role,
                    'joined_at' => now(),
                ]
            );
        });
    }
}
