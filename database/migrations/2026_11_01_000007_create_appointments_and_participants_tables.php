<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->char('uuid', 36)->unique('appointments_uuid_unique');
            $table->foreignId('organizer_id')->constrained('users')->restrictOnDelete();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->dateTime('start_time')->index('appointments_start_idx');
            $table->dateTime('end_time')->index('appointments_end_idx');
            $table->string('location_type', 50)->default('virtual');
            $table->string('meeting_link', 1024)->nullable();
            $table->string('location_address', 255)->nullable();
            $table->string('status', 50)->default('scheduled')->index('appointments_status_idx');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['organizer_id', 'status', 'start_time', 'end_time'], 'appt_organizer_overlap_idx');
            $table->index(['start_time', 'end_time', 'status'], 'appt_timeline_idx');
        });

        Schema::create('appointment_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appointment_id')->constrained('appointments')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 50)->default('pending')->index('appt_part_status_idx');
            $table->text('response_notes')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->unique(['appointment_id', 'user_id'], 'appt_user_unique');
            $table->index(['user_id', 'status', 'appointment_id'], 'appt_part_user_status_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('appointment_participants');
        Schema::dropIfExists('appointments');
    }
};
