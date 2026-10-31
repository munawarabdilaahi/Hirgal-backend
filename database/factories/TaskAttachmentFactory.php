<?php

namespace Database\Factories;

use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TaskAttachment>
 */
class TaskAttachmentFactory extends Factory
{
    protected $model = TaskAttachment::class;

    public function definition(): array
    {
        return [
            'task_id' => Task::factory(),
            'user_id' => User::factory(),
            'file_name' => fake()->word() . '.pdf',
            'file_path' => 'attachments/' . fake()->uuid() . '.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => rand(10000, 5000000),
        ];
    }
}
