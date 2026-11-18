<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Models\User;
use App\Services\Security\TwoFactorAuthenticationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WebSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_inertia_login_page(): void
    {
        $this->withoutVite();

        $this->get(route('dashboard'))->assertRedirectToRoute('login');
        $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->component('Login', false));
    }

    public function test_login_persists_across_dashboard_requests_and_logout_ends_the_session(): void
    {
        $this->withoutVite();
        $user = User::factory()->create();

        $login = $this->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'password',
        ])->assertRedirectToRoute('dashboard');

        $this->assertAuthenticatedAs($user, 'web');
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $sessionCookie = $login->getCookie(config('session.cookie'));

        Auth::forgetGuards();
        $this->withCookie($sessionCookie->getName(), $sessionCookie->getValue())
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page->component('Dashboard', false)
                ->where('user.id', $user->id)
                ->where('user.email', $user->email)
                ->missing('user.password'));

        $this->post(route('logout'))->assertRedirectToRoute('login');
        Auth::forgetGuards();
        $this->get(route('dashboard'))->assertRedirectToRoute('login');
    }

    public function test_invalid_credentials_return_a_browser_validation_error(): void
    {
        $user = User::factory()->create();

        $this->from(route('login'))->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'wrong-password',
        ])->assertRedirectToRoute('login')->assertSessionHasErrors(['email' => 'Invalid credentials.']);

        $this->assertGuest('web');
    }

    public function test_two_factor_challenge_returns_to_the_login_page(): void
    {
        $user = User::factory()->create([
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
        ]);

        $this->from('/')->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'password',
        ])->assertRedirectToRoute('login')->assertSessionHasErrors([
            'two_factor_code' => 'Enter the six-digit code from your authenticator app.',
        ])->assertSessionHasInput('email', $user->email);

        $this->assertGuest('web');
    }

    public function test_two_factor_code_completes_a_browser_session_login(): void
    {
        $secret = 'JBSWY3DPEHPK3PXP';
        $user = User::factory()->create([
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => now(),
        ]);

        $code = app(TwoFactorAuthenticationService::class)->currentCode($secret);

        $this->from(route('login'))->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'password',
            'two_factor_code' => $code,
        ])->assertRedirectToRoute('dashboard');

        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_a_disabled_account_cannot_start_a_session(): void
    {
        $user = User::factory()->create(['account_status' => AccountStatus::Suspended]);

        $this->from(route('login'))->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'password',
        ])->assertRedirectToRoute('login')->assertSessionHasErrors('email');

        $this->assertGuest('web');
    }

    public function test_an_account_disabled_after_login_loses_dashboard_access(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user, 'web');
        $user->update(['account_status' => AccountStatus::Suspended]);

        $this->get(route('dashboard'))->assertRedirectToRoute('login')->assertSessionHas('sessionMessage');

        $this->assertGuest('web');
    }
}
