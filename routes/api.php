<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\InvitationController;
use App\Http\Controllers\Api\V1\Auth\PasswordController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\User\UserController;
use App\Http\Controllers\Api\V1\User\UserInvitationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — Hirgal Backend
|--------------------------------------------------------------------------
|
| Version 1.0 (v1) API Routes
|
*/

Route::prefix('v1')->group(function (): void {
    // Health Check
    Route::get('/health', HealthController::class)->name('api.v1.health');

    /*
    |----------------------------------------------------------------------
    | Public Authentication & Onboarding Routes
    |----------------------------------------------------------------------
    */
    Route::prefix('auth')->group(function (): void {
        Route::post('/register', [AuthController::class, 'register'])
            ->middleware('throttle:10,1')
            ->name('api.v1.auth.register');

        Route::post('/login', [AuthController::class, 'login'])
            ->middleware('throttle:login')
            ->name('api.v1.auth.login');

        Route::post('/forgot-password', [PasswordController::class, 'forgotPassword'])
            ->middleware('throttle:password-reset')
            ->name('api.v1.auth.forgot-password');

        Route::post('/reset-password', [PasswordController::class, 'resetPassword'])
            ->middleware('throttle:password-reset')
            ->name('api.v1.auth.reset-password');
    });

    // Public invitation inspection & acceptance
    Route::prefix('invitations')->group(function (): void {
        Route::post('/inspect', [InvitationController::class, 'inspect'])
            ->middleware('throttle:30,1')
            ->name('api.v1.invitations.inspect');

        Route::get('/{token}', [InvitationController::class, 'show'])
            ->middleware('throttle:30,1')
            ->name('api.v1.invitations.show');

        Route::post('/{token}/accept', [InvitationController::class, 'accept'])
            ->middleware('throttle:10,1')
            ->name('api.v1.invitations.accept');
    });

    /*
    |----------------------------------------------------------------------
    | Protected Routes (Authenticated & Active Account)
    |----------------------------------------------------------------------
    */
    Route::middleware(['auth:sanctum', 'account.active'])->group(function (): void {
        // Authenticated Session & Profile
        Route::prefix('auth')->group(function (): void {
            Route::post('/logout', [AuthController::class, 'logout'])->name('api.v1.auth.logout');
            Route::post('/logout-all', [AuthController::class, 'logoutAll'])->name('api.v1.auth.logout-all');
            Route::get('/me', [AuthController::class, 'me'])->name('api.v1.auth.me');
            Route::put('/me/profile', [AuthController::class, 'updateProfile'])->name('api.v1.auth.update-profile');
            Route::post('/change-password', [PasswordController::class, 'changePassword'])->name('api.v1.auth.change-password');
        });

        // User Management
        Route::prefix('users')->group(function (): void {
            Route::get('/', [UserController::class, 'index'])->name('api.v1.users.index');
            Route::get('/directory', [UserController::class, 'directory'])->name('api.v1.users.directory');
            Route::get('/{id}', [UserController::class, 'show'])->name('api.v1.users.show');
            Route::put('/{id}', [UserController::class, 'update'])->name('api.v1.users.update');
            Route::post('/{id}/activate', [UserController::class, 'activate'])->name('api.v1.users.activate');
            Route::post('/{id}/deactivate', [UserController::class, 'deactivate'])->name('api.v1.users.deactivate');
        });

        // User Invitation Management
        Route::prefix('invitations')->group(function (): void {
            Route::get('/', [UserInvitationController::class, 'index'])->name('api.v1.invitations.index');
            Route::post('/', [UserInvitationController::class, 'store'])
                ->middleware('throttle:invitations')
                ->name('api.v1.invitations.store');
            Route::post('/{id}/resend', [UserInvitationController::class, 'resend'])
                ->middleware('throttle:invitations')
                ->name('api.v1.invitations.resend');
            Route::delete('/{id}', [UserInvitationController::class, 'destroy'])->name('api.v1.invitations.destroy');
        });
    });
});
