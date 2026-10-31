<?php

namespace Database\Factories;

use App\Enums\TeamMemberRole;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Team>
 */
class TeamFactory extends Factory
{
    protected $model = Team::class;

    public function definition(): array
    {
        $name = fake()->company() . ' Team';

        return [
            'uuid' => (string) Str::uuid(),
            'name' => $name,
            'slug' => Str::slug($name) . '-' . Str::lower(Str::random(6)),
            'description' => fake()->sentence(),
            'leader_id' => User::factory(),
        ];
    }

    public function withMembers(int $count = 3): static
    {
        return $this->afterCreating(function (Team $team) use ($count): void {
            // Leader is automatically a leader member
            TeamMember::firstOrCreate([
                'team_id' => $team->id,
                'user_id' => $team->leader_id,
            ], [
                'role' => TeamMemberRole::Leader,
                'joined_at' => now(),
            ]);

            User::factory()->count($count)->create()->each(function (User $user) use ($team): void {
                TeamMember::create([
                    'team_id' => $team->id,
                    'user_id' => $user->id,
                    'role' => TeamMemberRole::Member,
                    'joined_at' => now(),
                ]);
            });
        });
    }
}
