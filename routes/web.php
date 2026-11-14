<?php

use App\Http\Controllers\Web\InvitationController;
use App\Http\Controllers\Web\PasswordController;
use App\Http\Controllers\Web\ProfileController;
use App\Http\Controllers\Web\SessionController;
use App\Http\Controllers\Web\WorkspaceController;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::middleware(HandleInertiaRequests::class)->group(function (): void {
    Route::middleware('guest')->group(function (): void {
        Route::get('/login', [SessionController::class, 'create'])->name('login');
        Route::post('/login', [SessionController::class, 'store'])->middleware('throttle:login')->name('login.store');
        Route::get('/invitations/accept', [InvitationController::class, 'create'])->name('invitations.accept');
        Route::post('/invitations/accept', [InvitationController::class, 'store'])->middleware('throttle:10,1')->name('invitations.store');
    });

    Route::get('/forgot-password', [PasswordController::class, 'requestLink'])->name('password.request');
    Route::post('/forgot-password', [PasswordController::class, 'sendLink'])->middleware('throttle:password-reset')->name('password.email');
    Route::get('/reset-password', [PasswordController::class, 'edit'])->name('password.reset');
    Route::post('/reset-password', [PasswordController::class, 'update'])->middleware('throttle:password-reset')->name('password.update');

    Route::middleware(['auth', 'auth.session', 'account.active'])->group(function (): void {
        Route::get('/dashboard', [SessionController::class, 'dashboard'])->name('dashboard');
        Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
        Route::put('/profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::get('/projects', WorkspaceController::class)->name('projects.index');
        Route::get('/projects/new', WorkspaceController::class)->name('projects.create');
        Route::get('/projects/{project}/edit', WorkspaceController::class)->name('projects.edit');
        Route::get('/projects/{project}', WorkspaceController::class)->name('projects.show');
        Route::get('/teams', WorkspaceController::class)->name('teams.index');
        Route::get('/teams/new', WorkspaceController::class)->name('teams.create');
        Route::get('/teams/{team}/edit', WorkspaceController::class)->name('teams.edit');
        Route::get('/teams/{team}', WorkspaceController::class)->name('teams.show');
    });

    Route::middleware('auth')->group(function (): void {
        Route::post('/logout', [SessionController::class, 'destroy'])->name('logout');
    });
});
