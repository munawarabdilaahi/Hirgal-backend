<?php

namespace App\Actions\Teams;

use App\Models\Project;
use App\Models\ProjectTeam;
use App\Models\Team;
use Illuminate\Support\Facades\DB;

class DeallocateTeamFromProjectAction
{
    /**
     * Remove the team allocation from the project while retaining team memberships.
     */
    public function execute(Project $project, Team $team): ProjectTeam
    {
        return DB::transaction(function () use ($project, $team): ProjectTeam {
            $allocation = ProjectTeam::query()
                ->where('project_id', $project->id)
                ->where('team_id', $team->id)
                ->firstOrFail();

            $allocation->delete();

            return $allocation;
        });
    }
}
