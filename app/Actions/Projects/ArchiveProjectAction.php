<?php

namespace App\Actions\Projects;

use App\Enums\ProjectStatus;
use App\Models\Project;
use Illuminate\Support\Facades\DB;

class ArchiveProjectAction
{
    /**
     * Transition the project into the archived status.
     */
    public function execute(Project $project): Project
    {
        return DB::transaction(function () use ($project): Project {
            $project->update(['status' => ProjectStatus::Archived]);

            return $project->fresh();
        });
    }
}
