<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserInvitation;
use App\Notifications\ResetPasswordNotification;
use App\Notifications\UserInvitationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class InertiaAccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_requires_a_session_and_updates_the_signed_in_user(): void
    {
        $this->withoutVite();
        $this->get('/profile')->assertRedirectToRoute('login');
        $user = User::factory()->create();

        $this->actingAs($user)->put('/profile', ['name' => 'Updated Name', 'department' => 'Operations'])
            ->assertRedirectToRoute('profile.edit');
        $this->get('/profile')->assertInertia(fn (Assert $page) => $page->component('AccountSettings', false)
            ->where('user.name', 'Updated Name')
            ->where('user.profile.department', 'Operations'));
        $this->assertSame('Updated Name', $user->fresh()->name);
    }

    public function test_reset_requests_send_links_to_the_laravel_web_route(): void
    {
        Notification::fake();
        $user = User::factory()->create();

        $this->post('/forgot-password', ['email' => $user->email])->assertRedirectToRoute('password.request');

        Notification::assertSentTo($user, ResetPasswordNotification::class, function (ResetPasswordNotification $notification) use ($user): bool {
            $url = $notification->toMail($user)->actionUrl;
            parse_str(parse_url($url, PHP_URL_QUERY), $query);

            return str_starts_with($url, route('password.reset').'?')
                && $query['email'] === $user->email
                && DB::table('password_reset_tokens')->where('email', $user->email)
                    ->where('token', hash('sha256', $query['token']))->exists();
        });
    }

    public function test_a_legacy_reset_link_can_reset_the_password_and_end_the_web_session(): void
    {
        $this->withoutVite();
        $user = User::factory()->create();
        $token = Str::random(64);
        DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => hash('sha256', $token),
            'created_at' => now(),
        ]);

        $this->actingAs($user)->get('/reset-password?'.http_build_query(['token' => $token, 'email' => $user->email]))
            ->assertInertia(fn (Assert $page) => $page->component('ResetPassword', false)->missing('token'));
        $this->post('/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])->assertRedirectToRoute('login')->assertSessionHas('sessionMessage');

        $this->assertGuest();
        $this->assertTrue(Hash::check('new-password', $user->fresh()->password));
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
    }

    public function test_invalid_password_reset_redirects_to_a_clean_url(): void
    {
        $this->from('/reset-password?token=invalid')->post('/reset-password', [
            'email' => 'member@example.test',
            'token' => 'invalid',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])->assertRedirectToRoute('password.reset')->assertSessionHasErrors('token')
            ->assertSessionMissing('_old_input.token');
    }

    public function test_invitation_acceptance_creates_a_web_session_without_issuing_an_api_token(): void
    {
        $this->withoutVite();
        $token = Str::random(64);
        $invitation = UserInvitation::factory()->create(['token_hash' => hash('sha256', $token)]);
        $notification = new UserInvitationNotification($invitation, $token);
        $this->assertSame(route('invitations.accept').'#token='.$token, $notification->toMail($invitation->inviter)->actionUrl);

        $this->get('/invitations/accept?token='.$token)
            ->assertInertia(fn (Assert $page) => $page->component('AcceptInvitation', false)->missing('token'));
        $this->post('/invitations/accept', [
            'token' => $token,
            'name' => 'Invited Member',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])->assertRedirectToRoute('dashboard');

        $user = User::where('email', $invitation->email)->firstOrFail();
        $this->assertAuthenticatedAs($user, 'web');
        $this->assertTrue($user->roles()->whereKey($invitation->role_id)->exists());
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
