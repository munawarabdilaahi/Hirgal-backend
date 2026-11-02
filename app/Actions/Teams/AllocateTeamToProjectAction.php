<?php

namespace App\Actions\Teams;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectTeam;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AllocateTeamToProjectAction
{
    /**
     * Allocate a team to a project after proving the roster/project membership invariant.
     *
     * @throws ValidationException
     */
    public function execute(Project $project, Team $team): ProjectTeam
    {
        return DB::transaction(function () use ($project, $team): ProjectTeam {
            $rosterUserIds = TeamMember::query()
                ->where('team_id', $team->id)
                ->pluck('user_id')
                ->map(fn ($id): int => (int) $id)
                ->values();

            $projectMemberIds = ProjectMember::query()
                ->where('project_id', $project->id)
                ->pluck('user_id')
                ->map(fn ($id): int => (int) $id);

            $covered = $projectMemberIds->push($project->owner_id)->unique();
            $missing = $rosterUserIds->diff($covered);

            if ($missing->isNotEmpty()) {
                $missingNames = User::whereIn('id', $missing)->pluck('name')->implode(', ');

                throw ValidationException::withMessages([
                    'team_id' => "Team members must belong to the project before allocation. Missing from project: {$missingNames}.",
                ]);
            }

            return ProjectTeam::firstOrCreate([
                'project_id' => $project->id,
                'team_id' => $team->id,
            ], [
                'assigned_at' => now(),
            ]);
        });
    }
}
