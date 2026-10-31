<?php

namespace Database\Factories;

use App\Models\Task;
use App\Models\User;
use App\Models\UserMention;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserMention>
 */
class UserMentionFactory extends Factory
{
    protected $model = UserMention::class;

    public function definition(): array
    {
        return [
            'mentionable_type' => Task::class,
            'mentionable_id' => Task::factory(),
            'mentioned_user_id' => User::factory(),
            'author_id' => User::factory(),
            'context_excerpt' => fake()->sentence(),
            'read_at' => null,
        ];
    }
}
