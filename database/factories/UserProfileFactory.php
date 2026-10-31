<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserProfile>
 */
class UserProfileFactory extends Factory
{
    protected $model = UserProfile::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'phone' => fake()->phoneNumber(),
            'job_title' => fake()->jobTitle(),
            'department' => fake()->randomElement(['Engineering', 'Product', 'Design', 'Operations']),
            'bio' => fake()->paragraph(),
            'notification_preferences' => [
                'email' => true,
                'in_app' => true,
                'mentions' => true,
            ],
            'theme_preference' => fake()->randomElement(['system', 'light', 'dark']),
        ];
    }
}
