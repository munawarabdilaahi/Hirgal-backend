<?php

namespace Database\Factories;

use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TaskAssignment>
 */
class TaskAssignmentFactory extends Factory
{
    protected $model = TaskAssignment::class;

    public function definition(): array
    {
        return [
            'task_id' => Task::factory(),
            'user_id' => function (array $attributes) {
                $task = Task::find($attributes['task_id']);
                $user = User::factory()->create();
                if ($task) {
                    ProjectMember::firstOrCreate([
                        'project_id' => $task->project_id,
                        'user_id' => $user->id,
                    ], [
                        'role' => \App\Enums\ProjectMemberRole::Member,
                        'joined_at' => now(),
                    ]);
                }

                return $user->id;
            },
            'assigned_by' => User::factory(),
            'assigned_at' => now(),
        ];
    }
}
