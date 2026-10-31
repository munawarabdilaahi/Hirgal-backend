<?php

namespace Database\Factories;

use App\Enums\InvitationStatus;
use App\Enums\ProjectMemberRole;
use App\Models\Project;
use App\Models\ProjectInvitation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ProjectInvitation>
 */
class ProjectInvitationFactory extends Factory
{
    protected $model = ProjectInvitation::class;

    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'email' => fake()->unique()->safeEmail(),
            'role' => ProjectMemberRole::Member,
            'token_hash' => hash('sha256', Str::random(40)),
            'status' => InvitationStatus::Pending,
            'invited_by' => User::factory(),
            'expires_at' => now()->addDays(7),
            'accepted_at' => null,
        ];
    }
}
