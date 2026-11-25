<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExpiredTokenPruningTest extends TestCase
{
    use RefreshDatabase;

    public function test_pruning_removes_only_tokens_expired_for_more_than_twenty_four_hours(): void
    {
        $this->travelTo(now()->startOfSecond());
        $user = User::factory()->create();
        $old = $user->createToken('old')->accessToken;
        $old->forceFill(['created_at' => now()->subDays(31)->subSecond(), 'expires_at' => now()->addDays(10)])->save();
        $expired = $user->createToken('expired', ['*'], now()->subDay()->subSecond())->accessToken;
        $globalBoundary = $user->createToken('global boundary')->accessToken;
        $globalBoundary->forceFill(['created_at' => now()->subDays(31)])->save();
        $expiryBoundary = $user->createToken('expiry boundary', ['*'], now()->subDay())->accessToken;
        $recentlyExpired = $user->createToken('recently expired', ['*'], now()->subHour())->accessToken;
        $active = $user->createToken('active');

        $this->artisan('sanctum:prune-expired', ['--hours' => 24])->assertSuccessful();

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $old->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $expired->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $globalBoundary->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $expiryBoundary->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $recentlyExpired->id]);
        $this->withToken($active->plainTextToken)->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_expired_token_pruning_is_scheduled_daily_with_a_retention_window(): void
    {
        $this->artisan('schedule:list')->assertSuccessful();
        $events = collect(app(Schedule::class)->events())
            ->filter(fn ($event): bool => str_contains($event->command ?? '', 'sanctum:prune-expired'));

        $this->assertCount(1, $events);
        $event = $events->first();
        $this->assertStringContainsString('--hours=24', $event->command);
        $this->assertTrue($event->withoutOverlapping);
        $this->assertTrue($event->onOneServer);
        $this->travelTo(now()->startOfDay()->addHours(2));
        $this->assertTrue($event->isDue($this->app));
        $this->travel(1)->minutes();
        $this->assertFalse($event->isDue($this->app));
    }
}
