<?php

namespace App\Services\Project;

use App\Actions\Projects\AddProjectMemberAction;
use App\Actions\Projects\ArchiveProjectAction;
use App\Actions\Projects\CreateProjectAction;
use App\Actions\Projects\DeleteProjectAction;
use App\Actions\Projects\RemoveProjectMemberAction;
use App\Actions\Projects\RestoreProjectAction;
use App\Actions\Projects\UpdateProjectAction;
use App\Actions\Projects\UpdateProjectMemberRoleAction;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Policies\ProjectPolicy;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class ProjectService
{
    public function __construct(
        protected CreateProjectAction $createProjectAction,
        protected UpdateProjectAction $updateProjectAction,
        protected ArchiveProjectAction $archiveProjectAction,
        protected RestoreProjectAction $restoreProjectAction,
        protected DeleteProjectAction $deleteProjectAction,
        protected AddProjectMemberAction $addProjectMemberAction,
        protected UpdateProjectMemberRoleAction $updateProjectMemberRoleAction,
        protected RemoveProjectMemberAction $removeProjectMemberAction,
    ) {}

    /**
     * List the projects the actor is allowed to access, with filtering and pagination.
     *
     * @param  array<string, mixed>  $filters
     */
    public function listProjects(User $actor, array $filters): LengthAwarePaginator
    {
        $query = Project::query()
            ->with([
                'owner:id,name,email,avatar_url,timezone',
                'owner.profile:id,user_id,job_title,department',
            ])
            ->withCount(['projectMembers as members_count']);

        if (! $actor->isSystemAdmin()) {
            $query->where(function ($projectQuery) use ($actor): void {
                $projectQuery->where('owner_id', $actor->id)
                    ->orWhereHas('projectMembers', fn ($memberQuery) => $memberQuery->where('user_id', $actor->id));
            });
        }

        if (! empty($filters['search'])) {
            $search = '%'.$filters['search'].'%';
            $query->where(function ($searchQuery) use ($search): void {
                $searchQuery->where('name', 'like', $search)
                    ->orWhere('slug', 'like', $search);
            });
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['priority'])) {
            $query->where('priority', $filters['priority']);
        }

        $sortBy = $filters['sort_by'] ?? 'created_at';
        $sortDirection = $filters['sort_direction'] ?? 'desc';
        $perPage = (int) ($filters['per_page'] ?? 15);

        return $query->orderBy($sortBy, $sortDirection)->paginate($perPage);
    }

    /**
     * Resolve a project by UUID, enforcing the tenant boundary with a 404 response.
     */
    public function resolveScopedProject(string $uuid, User $actor): Project
    {
        $project = Project::query()->where('uuid', $uuid)->firstOrFail();

        abort_unless(ProjectPolicy::isWithinScope($actor, $project), 404);

        return $project;
    }

    /**
     * List a project's contextual membership roster.
     *
     * @param  array<string, mixed>  $filters
     */
    public function listMembers(Project $project, array $filters): LengthAwarePaginator
    {
        $perPage = (int) ($filters['per_page'] ?? 15);

        return ProjectMember::query()
            ->with(['user:id,name,email,avatar_url,timezone', 'user.profile:id,user_id,job_title,department'])
            ->where('project_id', $project->id)
            ->orderBy('joined_at', 'asc')
            ->paginate($perPage);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createProject(User $actor, array $data): Project
    {
        return $this->createProjectAction->execute($actor, $data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateProject(Project $project, array $data): Project
    {
        return $this->updateProjectAction->execute($project, $data);
    }

    public function archiveProject(Project $project): Project
    {
        return $this->archiveProjectAction->execute($project);
    }

    public function restoreProject(Project $project): Project
    {
        return $this->restoreProjectAction->execute($project);
    }

    public function deleteProject(Project $project): Project
    {
        return $this->deleteProjectAction->execute($project);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function addMember(User $actor, Project $project, array $data): ProjectMember
    {
        return $this->addProjectMemberAction->execute($actor, $project, $data);
    }

    public function updateMemberRole(User $actor, ProjectMember $member, string $role): ProjectMember
    {
        return $this->updateProjectMemberRoleAction->execute($actor, $member, $role);
    }

    /**
     * @return array{member: ProjectMember, removed_teams: array<int, string>}
     */
    public function removeMember(User $actor, ProjectMember $member): array
    {
        return $this->removeProjectMemberAction->execute($actor, $member);
    }
}
