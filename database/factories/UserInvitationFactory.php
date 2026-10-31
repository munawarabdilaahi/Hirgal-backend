<?php

namespace Database\Factories;

use App\Enums\InvitationStatus;
use App\Models\Role;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<UserInvitation>
 */
class UserInvitationFactory extends Factory
{
    protected $model = UserInvitation::class;

    public function definition(): array
    {
        return [
            'email' => fake()->unique()->safeEmail(),
            'role_id' => Role::factory(),
            'token_hash' => hash('sha256', Str::random(40)),
            'status' => InvitationStatus::Pending,
            'invited_by' => User::factory(),
            'expires_at' => now()->addDays(7),
            'accepted_at' => null,
        ];
    }
}
