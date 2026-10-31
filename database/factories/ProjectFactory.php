<?php

namespace Database\Factories;

use App\Enums\ProjectMemberRole;
use App\Enums\ProjectPriority;
use App\Enums\ProjectStatus;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Project>
 */
class ProjectFactory extends Factory
{
    protected $model = Project::class;

    public function definition(): array
    {
        $name = fake()->catchPhrase();

        return [
            'uuid' => (string) Str::uuid(),
            'name' => $name,
            'slug' => Str::slug($name) . '-' . Str::lower(Str::random(6)),
            'description' => fake()->paragraph(),
            'status' => fake()->randomElement(ProjectStatus::cases()),
            'priority' => fake()->randomElement(ProjectPriority::cases()),
            'owner_id' => User::factory(),
            'start_date' => now()->toDateString(),
            'due_date' => now()->addMonths(2)->toDateString(),
            'completed_at' => null,
            'settings' => [
                'enable_tasks' => true,
                'enable_appointments' => true,
            ],
        ];
    }

    public function completed(): static
    {
        return $this->state(fn () => [
            'status' => ProjectStatus::Completed,
            'completed_at' => now(),
        ]);
    }

    public function urgent(): static
    {
        return $this->state(fn () => [
            'priority' => ProjectPriority::Urgent,
        ]);
    }

    public function withMembers(int $count = 3): static
    {
        return $this->afterCreating(function (Project $project) use ($count): void {
            // Owner is automatically an owner member
            ProjectMember::firstOrCreate([
                'project_id' => $project->id,
                'user_id' => $project->owner_id,
            ], [
                'role' => ProjectMemberRole::Owner,
                'joined_at' => now(),
            ]);

            User::factory()->count($count)->create()->each(function (User $user) use ($project): void {
                ProjectMember::create([
                    'project_id' => $project->id,
                    'user_id' => $user->id,
                    'role' => fake()->randomElement([ProjectMemberRole::Lead, ProjectMemberRole::Member, ProjectMemberRole::Viewer]),
                    'joined_at' => now(),
                ]);
            });
        });
    }
}
