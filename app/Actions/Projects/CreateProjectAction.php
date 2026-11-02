<?php

namespace App\Actions\Projects;

use App\Enums\ProjectMemberRole;
use App\Enums\ProjectPriority;
use App\Enums\ProjectStatus;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CreateProjectAction
{
    /**
     * Create a project owned by the actor together with its owner membership row.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(User $actor, array $data): Project
    {
        return DB::transaction(function () use ($actor, $data): Project {
            $project = Project::create([
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'status' => $data['status'] ?? ProjectStatus::Planning->value,
                'priority' => $data['priority'] ?? ProjectPriority::Medium->value,
                'owner_id' => $actor->id,
                'start_date' => $data['start_date'] ?? null,
                'due_date' => $data['due_date'] ?? null,
                'settings' => $data['settings'] ?? null,
            ]);

            ProjectMember::create([
                'project_id' => $project->id,
                'user_id' => $actor->id,
                'role' => ProjectMemberRole::Owner,
                'joined_at' => now(),
            ]);

            return $project;
        });
    }
}
