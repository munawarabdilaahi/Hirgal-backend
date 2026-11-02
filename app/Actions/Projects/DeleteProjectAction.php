<?php

namespace App\Actions\Projects;

use App\Models\Project;
use Illuminate\Support\Facades\DB;

class DeleteProjectAction
{
    /**
     * Soft-delete the project so it can be restored later.
     */
    public function execute(Project $project): Project
    {
        return DB::transaction(function () use ($project): Project {
            $project->delete();

            return $project;
        });
    }
}
