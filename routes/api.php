<?php

use App\Http\Controllers\Api\V1\Activity\ActivityLogController;
use App\Http\Controllers\Api\V1\Appointments\AppointmentController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\InvitationController;
use App\Http\Controllers\Api\V1\Auth\PasswordController;
use App\Http\Controllers\Api\V1\Habits\HabitController;
use App\Http\Controllers\Api\V1\Habits\HabitLogController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\Notifications\NotificationController;
use App\Http\Controllers\Api\V1\Projects\ProjectController;
use App\Http\Controllers\Api\V1\Projects\ProjectMemberController;
use App\Http\Controllers\Api\V1\Projects\ProjectTeamController;
use App\Http\Controllers\Api\V1\Tasks\TaskAssignmentController;
use App\Http\Controllers\Api\V1\Tasks\TaskController;
use App\Http\Controllers\Api\V1\Teams\TeamController;
use App\Http\Controllers\Api\V1\Teams\TeamMemberController;
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

        // Appointments & scheduling (Phase 7).
        Route::prefix('appointments')->group(function (): void {
            Route::get('/', [AppointmentController::class, 'index'])->name('api.v1.appointments.index');
            Route::post('/', [AppointmentController::class, 'store'])->middleware('throttle:invitations')->name('api.v1.appointments.store');
            Route::get('/calendar', [AppointmentController::class, 'calendar'])->name('api.v1.appointments.calendar');
            Route::post('/admin/{uuid}/view', [AppointmentController::class, 'adminShow'])->name('api.v1.appointments.admin.show');
            Route::get('/{appointment:uuid}', [AppointmentController::class, 'show'])->name('api.v1.appointments.show');
            Route::put('/{appointment:uuid}', [AppointmentController::class, 'update'])->name('api.v1.appointments.update');
            Route::post('/{appointment:uuid}/cancel', [AppointmentController::class, 'cancel'])->name('api.v1.appointments.cancel');
            Route::delete('/{appointment:uuid}', [AppointmentController::class, 'destroy'])->name('api.v1.appointments.destroy');
            Route::get('/{appointment:uuid}/participants', [AppointmentController::class, 'participants'])->name('api.v1.appointments.participants.index');
            Route::post('/{appointment:uuid}/participants', [AppointmentController::class, 'addParticipant'])->middleware('throttle:invitations')->name('api.v1.appointments.participants.store');
            Route::delete('/{appointment:uuid}/participants/{user}', [AppointmentController::class, 'removeParticipant'])->whereNumber('user')->name('api.v1.appointments.participants.destroy');
            Route::put('/{appointment:uuid}/rsvp', [AppointmentController::class, 'respond'])->name('api.v1.appointments.rsvp');
        });

        // Habit Tracker (Phase 8).
        Route::prefix('habits')->group(function (): void {
            Route::get('/', [HabitController::class, 'index'])->name('api.v1.habits.index');
            Route::post('/', [HabitController::class, 'store'])->name('api.v1.habits.store');
            Route::get('/daily-overview', [HabitController::class, 'dailyOverview'])->name('api.v1.habits.daily-overview');
            Route::get('/{uuid}', [HabitController::class, 'show'])->name('api.v1.habits.show');
            Route::put('/{uuid}', [HabitController::class, 'update'])->name('api.v1.habits.update');
            Route::delete('/{uuid}', [HabitController::class, 'destroy'])->name('api.v1.habits.destroy');
            Route::post('/{uuid}/archive', [HabitController::class, 'archive'])->name('api.v1.habits.archive');
            Route::post('/{uuid}/restore', [HabitController::class, 'restore'])->name('api.v1.habits.restore');
            Route::get('/{uuid}/logs', [HabitLogController::class, 'index'])->name('api.v1.habits.logs.index');
            Route::post('/{uuid}/logs', [HabitLogController::class, 'store'])->name('api.v1.habits.logs.store');
            Route::delete('/{uuid}/logs/{date}', [HabitLogController::class, 'destroy'])->name('api.v1.habits.logs.destroy');
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

        /*
        |----------------------------------------------------------------------
        | Project Management (Phase 6)
        |----------------------------------------------------------------------
        */
        Route::prefix('projects')->group(function (): void {
            Route::get('/', [ProjectController::class, 'index'])->name('api.v1.projects.index');
            Route::post('/', [ProjectController::class, 'store'])->name('api.v1.projects.store');
            Route::get('/{project}', [ProjectController::class, 'show'])->name('api.v1.projects.show');
            Route::put('/{project}', [ProjectController::class, 'update'])->name('api.v1.projects.update');
            Route::post('/{project}/archive', [ProjectController::class, 'archive'])->name('api.v1.projects.archive');
            Route::post('/{project}/restore', [ProjectController::class, 'restore'])
                ->withTrashed()
                ->name('api.v1.projects.restore');
            Route::delete('/{project}', [ProjectController::class, 'destroy'])->name('api.v1.projects.destroy');

            // Project contextual membership
            Route::get('/{project}/members', [ProjectMemberController::class, 'index'])->name('api.v1.projects.members.index');
            Route::post('/{project}/members', [ProjectMemberController::class, 'store'])->name('api.v1.projects.members.store');
            Route::put('/{project}/members/{member}', [ProjectMemberController::class, 'update'])->name('api.v1.projects.members.update');
            Route::delete('/{project}/members/{member}', [ProjectMemberController::class, 'destroy'])->name('api.v1.projects.members.destroy');

            // Team allocation
            Route::get('/{project}/teams', [ProjectTeamController::class, 'index'])->name('api.v1.projects.teams.index');
            Route::post('/{project}/teams/{team}', [ProjectTeamController::class, 'store'])->name('api.v1.projects.teams.store');
            Route::delete('/{project}/teams/{team}', [ProjectTeamController::class, 'destroy'])->name('api.v1.projects.teams.destroy');

            // Task creation nested under the project
            Route::post('/{project}/tasks', [TaskController::class, 'store'])->name('api.v1.projects.tasks.store');
        });

        /*
        |----------------------------------------------------------------------
        | Team Management (Phase 6)
        |----------------------------------------------------------------------
        */
        Route::prefix('teams')->group(function (): void {
            Route::get('/', [TeamController::class, 'index'])->name('api.v1.teams.index');
            Route::post('/', [TeamController::class, 'store'])->name('api.v1.teams.store');
            Route::get('/{team}', [TeamController::class, 'show'])->name('api.v1.teams.show');
            Route::put('/{team}', [TeamController::class, 'update'])->name('api.v1.teams.update');
            Route::delete('/{team}', [TeamController::class, 'destroy'])->name('api.v1.teams.destroy');

            // Team contextual membership
            Route::get('/{team}/members', [TeamMemberController::class, 'index'])->name('api.v1.teams.members.index');
            Route::post('/{team}/members', [TeamMemberController::class, 'store'])->name('api.v1.teams.members.store');
            Route::put('/{team}/members/{member}', [TeamMemberController::class, 'update'])->name('api.v1.teams.members.update');
            Route::delete('/{team}/members/{member}', [TeamMemberController::class, 'destroy'])->name('api.v1.teams.members.destroy');
        });

        /*
        |----------------------------------------------------------------------
        | Task Management (Phase 6)
        |----------------------------------------------------------------------
        */
        Route::prefix('tasks')->group(function (): void {
            Route::get('/', [TaskController::class, 'index'])->name('api.v1.tasks.index');
            Route::get('/{task}', [TaskController::class, 'show'])->name('api.v1.tasks.show');
            Route::put('/{task}', [TaskController::class, 'update'])->name('api.v1.tasks.update');
            Route::delete('/{task}', [TaskController::class, 'destroy'])->name('api.v1.tasks.destroy');
            Route::post('/{task}/assign', [TaskAssignmentController::class, 'store'])->name('api.v1.tasks.assign');
            Route::delete('/{task}/assignees/{user}', [TaskAssignmentController::class, 'destroy'])->name('api.v1.tasks.unassign');
        });

        // Activity Audit (Phase 9). Read-only; audit records are append-only
        // and have no create/update/delete endpoints by design.
        Route::prefix('activity-logs')->group(function (): void {
            Route::get('/', [ActivityLogController::class, 'index'])->name('api.v1.activity-logs.index');
            Route::get('/my', [ActivityLogController::class, 'my'])->name('api.v1.activity-logs.my');
        });

        // Notifications Inbox (Phase 9 Module B). Recipient ownership is
        // enforced in SQL; static paths are registered before {id} routes.
        Route::prefix('notifications')->group(function (): void {
            Route::get('/', [NotificationController::class, 'index'])->name('api.v1.notifications.index');
            Route::get('/unread-count', [NotificationController::class, 'unreadCount'])->name('api.v1.notifications.unread-count');
            Route::patch('/read-all', [NotificationController::class, 'readAll'])->name('api.v1.notifications.read-all');
            Route::patch('/{id}/read', [NotificationController::class, 'markRead'])->name('api.v1.notifications.read');
        });
    });
});
