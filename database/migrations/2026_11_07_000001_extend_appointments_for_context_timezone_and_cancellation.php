<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table): void {
            $table->foreignId('project_id')->nullable()->after('organizer_id')->constrained('projects')->restrictOnDelete();
            $table->foreignId('team_id')->nullable()->after('project_id')->constrained('teams')->restrictOnDelete();
            $table->string('timezone', 64)->default('UTC')->after('description');
            $table->timestamp('cancelled_at')->nullable()->after('status');
            $table->foreignId('cancelled_by')->nullable()->after('cancelled_at')->constrained('users')->nullOnDelete();
            $table->index(['project_id', 'status', 'start_time', 'end_time'], 'appt_project_time_idx');
            $table->index(['team_id', 'status', 'start_time', 'end_time'], 'appt_team_time_idx');
        });

        // Existing naive DATETIME values were written by this UTC-configured application.
        DB::table('appointments')->whereNull('timezone')->update(['timezone' => 'UTC']);

        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE appointments ADD CONSTRAINT appointments_single_context_check CHECK (project_id IS NULL OR team_id IS NULL)');
        }

        Schema::table('appointment_participants', function (Blueprint $table): void {
            $table->timestamp('removed_at')->nullable();
            $table->foreignId('removed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('response_history')->nullable();
            $table->index(['appointment_id', 'removed_at'], 'appt_part_active_idx');
        });
    }

    public function down(): void
    {
        if (DB::table('appointments')
            ->whereNotNull('project_id')
            ->orWhereNotNull('team_id')
            ->orWhereNotNull('cancelled_at')
            ->orWhereNotNull('cancelled_by')
            ->orWhere('timezone', '<>', 'UTC')
            ->exists()) {
            throw new RuntimeException('Cannot roll back appointment context, timezone, or cancellation metadata after it has been used.');
        }
        if (DB::table('appointment_participants')->whereNotNull('removed_at')->orWhereNotNull('response_history')->exists()) {
            throw new RuntimeException('Cannot roll back appointment participant history after it has been recorded.');
        }

        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE appointments DROP CHECK appointments_single_context_check');
        }

        Schema::table('appointments', function (Blueprint $table): void {
            $table->dropIndex('appt_project_time_idx');
            $table->dropIndex('appt_team_time_idx');
            $table->dropConstrainedForeignId('cancelled_by');
            $table->dropConstrainedForeignId('team_id');
            $table->dropConstrainedForeignId('project_id');
            $table->dropColumn(['timezone', 'cancelled_at']);
        });

        Schema::table('appointment_participants', function (Blueprint $table): void {
            $table->dropIndex('appt_part_active_idx');
            $table->dropConstrainedForeignId('removed_by');
            $table->dropColumn(['removed_at', 'response_history']);
        });
    }
};
