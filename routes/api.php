<?php

use App\Http\Controllers\Api\V1\HealthController;
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
    | Future Domain Modules Scaffolding (Phases 5-14)
    |----------------------------------------------------------------------
    | - Auth & Users (Phase 5)
    | - Roles & Permissions (Phase 6)
    | - Projects (Phase 7)
    | - Teams (Phase 8)
    | - Tasks & Work Management (Phase 9)
    | - Appointments (Phase 10)
    | - Follow-up Inbox & Notifications (Phase 11)
    | - Habit Tracker (Phase 12)
    | - Activity Logs & Auditing (Phase 13)
    */
});
