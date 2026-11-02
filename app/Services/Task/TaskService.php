<?php

namespace App\Services\Task;

use App\Actions\Tasks\AssignTaskAction;
use App\Actions\Tasks\CreateTaskAction;
use App\Actions\Tasks\DeleteTaskAction;
use App\Actions\Tasks\UnassignTaskAction;
use App\Actions\Tasks\UpdateTaskAction;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\User;
use App\Policies\ProjectPolicy;
use App\Services\Project\ProjectService;
use App\Services\Team\TeamService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class TaskService
{
    /**
     * Relations always serialized with a task so responses stay consistent and N+1 free.
     *
     * @var array<int, string>
     */
    public const EAGER = [
        'project:id,uuid,name',
        'creator',
        'creator.profile:id,user_id,job_title,department',
        'assignees',
        'assignees.profile:id,user_id,job_title,department',
        'parent:id,uuid,title',
    ];

    public function __construct(
        protected CreateTaskAction $createTaskAction,
        protected UpdateTaskAction $updateTaskAction,
        protected DeleteTaskAction $deleteTaskAction,
        protected AssignTaskAction $assignTaskAction,
        protected UnassignTaskAction $unassignTaskAction,
        protected ProjectService $projectService,
        protected TeamService $teamService,
    ) {}

    /**
     * List tasks the actor may access, filtered, sorted, and paginated.
     *
     * @param  array<string, mixed>  $filters
     */
    public function listTasks(User $actor, array $filters): LengthAwarePaginator
    {
        $query = Task::query()->with(self::EAGER);

        if (! $actor->isSystemAdmin()) {
            $query->whereIn('project_id', $this->accessibleProjectIds($actor));
        }

        if (! empty($filters['project'])) {
            $project = $this->projectService->resolveScopedProject((string) $filters['project'], $actor);
            $query->where('project_id', $project->id);
        }

        if (! empty($filters['team'])) {
            $team = $this->teamService->resolveScopedTeam((string) $filters['team'], $actor);
            $teamProjectIds = $team->projects()->pluck('projects.id')->map(fn ($id): int => (int) $id);
            $query->whereIn('project_id', $teamProjectIds);
        }

        if (! empty($filters['assignee'])) {
            $query->whereHas('assignees', fn ($assigneeQuery) => $assigneeQuery->where('users.id', (int) $filters['assignee']));
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
     * Resolve a task by UUID, enforcing the tenant boundary with a 404 response.
     */
    public function resolveScopedTask(string $uuid, User $actor): Task
    {
        $task = Task::query()->with('project:id,uuid,name')->where('uuid', $uuid)->firstOrFail();

        abort_unless(ProjectPolicy::isWithinScope($actor, $task->project), 404);

        return $task;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createTask(User $actor, Project $project, array $data): Task
    {
        return $this->createTaskAction->execute($actor, $project, $data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateTask(Task $task, array $data): Task
    {
        return $this->updateTaskAction->execute($task, $data);
    }

    public function deleteTask(Task $task): Task
    {
        return $this->deleteTaskAction->execute($task);
    }

    /**
     * @param  array<int, int>  $userIds
     */
    public function assignTask(User $actor, Task $task, array $userIds): Task
    {
        return $this->assignTaskAction->execute($actor, $task, $userIds);
    }

    public function unassignTask(Task $task, TaskAssignment $assignment): Task
    {
        return $this->unassignTaskAction->execute($task, $assignment);
    }

    /**
     * @return array<int, int>
     */
    private function accessibleProjectIds(User $actor): array
    {
        $memberProjectIds = ProjectMember::query()
            ->where('user_id', $actor->id)
            ->pluck('project_id');

        $ownedProjectIds = Project::query()
            ->where('owner_id', $actor->id)
            ->pluck('id');

        return $memberProjectIds
            ->merge($ownedProjectIds)
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();
    }
}
