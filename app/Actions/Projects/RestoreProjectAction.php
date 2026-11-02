<?php

namespace App\Actions\Projects;

use App\Models\Project;
use Illuminate\Support\Facades\DB;

class RestoreProjectAction
{
    /**
     * Restore a soft-deleted project so it becomes addressable again.
     */
    public function execute(Project $project): Project
    {
        return DB::transaction(function () use ($project): Project {
            $project->restore();

            return $project->fresh();
        });
    }
}
