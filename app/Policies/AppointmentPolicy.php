<?php

namespace App\Policies;

use App\Enums\ProjectMemberRole;
use App\Enums\TeamMemberRole;
use App\Models\Appointment;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;

class AppointmentPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission('appointments.view');
    }

    public function view(User $actor, Appointment $appointment): bool
    {
        return $actor->hasPermission('appointments.view') && $this->isVisibleTo($actor, $appointment);
    }

    public function create(User $actor): bool
    {
        return $actor->hasPermission('appointments.create');
    }

    public function update(User $actor, Appointment $appointment): bool
    {
        if (! $actor->hasPermission('appointments.update')) {
            return false;
        }

        if (! $this->isVisibleTo($actor, $appointment)) {
            return false;
        }

        return $appointment->organizer_id === $actor->id || $this->hasContextManagementAuthority($actor, $appointment);
    }

    public function delete(User $actor, Appointment $appointment): bool
    {
        return $actor->hasPermission('appointments.delete')
            && $this->isVisibleTo($actor, $appointment)
            && ($appointment->organizer_id === $actor->id || $this->hasContextManagementAuthority($actor, $appointment));
    }

    public function canRespond(User $actor, Appointment $appointment): bool
    {
        if (! $actor->hasPermission('appointments.view') || ! $this->isVisibleTo($actor, $appointment)) {
            return false;
        }

        return $appointment->participantRecords()->where('user_id', $actor->id)->whereNull('removed_at')->exists();
    }

    public function isVisibleTo(User $actor, Appointment $appointment): bool
    {
        if ($appointment->project_id !== null) {
            if ($appointment->project === null) {
                return false;
            }

            return ProjectMember::query()
                ->where('project_id', $appointment->project_id)
                ->where('user_id', $actor->id)
                ->exists()
                || $appointment->project?->owner_id === $actor->id;
        }

        if ($appointment->team_id !== null) {
            if ($appointment->team === null) {
                return false;
            }

            return TeamMember::query()->where('team_id', $appointment->team_id)->where('user_id', $actor->id)->exists()
                || $appointment->team?->leader_id === $actor->id;
        }

        return $appointment->organizer_id === $actor->id
            || $appointment->participantRecords()->where('user_id', $actor->id)->whereNull('removed_at')->exists();
    }

    /**
     * Determine whether the actor owns or leads the project.
     *
     * Eloquent's value() applies the model cast, so the role is a ProjectMemberRole enum.
     */
    public function canCreateInProject(User $actor, int $projectId): bool
    {
        $role = ProjectMember::query()->where('project_id', $projectId)->where('user_id', $actor->id)->value('role');
        $project = Project::query()->find($projectId);

        return $project?->owner_id === $actor->id
            || in_array($role, [ProjectMemberRole::Owner, ProjectMemberRole::Lead], true);
    }

    /**
     * Determine whether the actor leads the team.
     *
     * Eloquent's value() applies the model cast, so the role is a TeamMemberRole enum.
     */
    public function canCreateInTeam(User $actor, int $teamId): bool
    {
        $team = Team::query()->find($teamId);
        $role = TeamMember::query()->where('team_id', $teamId)->where('user_id', $actor->id)->value('role');

        return $team?->leader_id === $actor->id || $role === TeamMemberRole::Leader;
    }

    public function hasContextManagementAuthority(User $actor, Appointment $appointment): bool
    {
        if ($appointment->project_id !== null) {
            return $this->canCreateInProject($actor, $appointment->project_id);
        }

        if ($appointment->team_id !== null) {
            return $this->canCreateInTeam($actor, $appointment->team_id);
        }

        return false;
    }

    public function canAdminView(User $actor): bool
    {
        return $actor->isSystemAdmin()
            && $actor->allPermissions()->contains('slug', 'appointments.admin.view');
    }
}
