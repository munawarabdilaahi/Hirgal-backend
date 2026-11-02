<?php

namespace App\Actions\Teams;

use App\Models\Team;
use Illuminate\Support\Facades\DB;

class DeleteTeamAction
{
    /**
     * Soft-delete the team so it can be retained for historical reference.
     */
    public function execute(Team $team): Team
    {
        return DB::transaction(function () use ($team): Team {
            $team->delete();

            return $team;
        });
    }
}
