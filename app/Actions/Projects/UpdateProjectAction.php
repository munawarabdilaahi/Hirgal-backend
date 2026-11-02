<?php

namespace App\Actions\Projects;

use App\Enums\ProjectStatus;
use App\Models\Project;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class UpdateProjectAction
{
    /**
     * Update project metadata inside a database transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(Project $project, array $data): Project
    {
        return DB::transaction(function () use ($project, $data): Project {
            $updates = Arr::only($data, [
                'name',
                'description',
                'status',
                'priority',
                'start_date',
                'due_date',
                'settings',
            ]);

            if (array_key_exists('status', $updates)) {
                $updates['completed_at'] = $updates['status'] === ProjectStatus::Completed->value
                    ? ($project->completed_at ?? now())
                    : null;
            }

            $project->update($updates);

            return $project->fresh();
        });
    }
}
