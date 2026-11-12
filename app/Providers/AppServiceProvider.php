<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
        $this->configureAuthorizationGates();
    }

    /**
     * Configure rate limiters for the API.
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('api', function (Request $request) {
            // Resolve the user through the Sanctum guard explicitly: group-level
            // throttling runs before route auth middleware, so the default guard
            // would be unresolved here. Keys are prefixed to keep user and IP
            // identities in distinct namespaces.
            $userId = $request->user('sanctum')?->id;

            return Limit::perMinute(60)->by($userId !== null ? 'user:'.$userId : 'ip:'.$request->ip());
        });

        RateLimiter::for('login', function (Request $request) {
            $email = (string) $request->input('email');

            return Limit::perMinute(5)->by($email.$request->ip());
        });

        RateLimiter::for('password-reset', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        RateLimiter::for('invitations', function (Request $request) {
            return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
        });
    }

    /**
     * Configure global authorization gate hooks.
     */
    protected function configureAuthorizationGates(): void
    {
        Gate::before(function (User $user, string $ability) {
            // Allow System Admin to bypass general capability checks,
            // but allow target-specific policy methods (like self-deactivation) to execute
            if ($user->isSystemAdmin() && ! in_array($ability, ['deactivate', 'delete'])) {
                return true;
            }

            return null;
        });

        Gate::after(function (User $user, string $ability) {
            return $user->hasPermission($ability);
        });
    }
}
