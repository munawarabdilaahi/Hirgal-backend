<?php

namespace Database\Factories;

use App\Enums\ProjectMemberRole;
use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Task>
 */
class TaskFactory extends Factory
{
    protected $model = Task::class;

    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'project_id' => Project::factory(),
            'parent_id' => null,
            'title' => fake()->sentence(4),
            'description' => fake()->paragraphs(2, true),
            'status' => fake()->randomElement(TaskStatus::cases()),
            'priority' => fake()->randomElement(TaskPriority::cases()),
            'creator_id' => User::factory(),
            'due_date' => now()->addDays(rand(1, 30)),
            'estimated_hours' => fake()->randomFloat(2, 1, 40),
            'actual_hours' => null,
            'order_column' => rand(0, 100),
            'completed_at' => null,
        ];
    }

    public function done(): static
    {
        return $this->state(fn () => [
            'status' => TaskStatus::Done,
            'completed_at' => now(),
        ]);
    }

    public function inProgress(): static
    {
        return $this->state(fn () => [
            'status' => TaskStatus::InProgress,
        ]);
    }

    public function withAssignees(int $count = 2): static
    {
        return $this->afterCreating(function (Task $task) use ($count): void {
            // First ensure creator is an eligible member of the project
            ProjectMember::firstOrCreate([
                'project_id' => $task->project_id,
                'user_id' => $task->creator_id,
            ], [
                'role' => ProjectMemberRole::Lead,
                'joined_at' => now(),
            ]);

            // Create project members and assign them to the task
            User::factory()->count($count)->create()->each(function (User $user) use ($task): void {
                ProjectMember::create([
                    'project_id' => $task->project_id,
                    'user_id' => $user->id,
                    'role' => ProjectMemberRole::Member,
                    'joined_at' => now(),
                ]);

                TaskAssignment::create([
                    'task_id' => $task->id,
                    'user_id' => $user->id,
                    'assigned_by' => $task->creator_id,
                    'assigned_at' => now(),
                ]);
            });
        });
    }
}
