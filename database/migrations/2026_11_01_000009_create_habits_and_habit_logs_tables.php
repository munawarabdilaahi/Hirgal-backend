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
        Schema::create('habits', function (Blueprint $table) {
            $table->id();
            $table->char('uuid', 36)->unique('habits_uuid_unique');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->string('frequency', 50)->default('daily')->index('habits_freq_idx');
            $table->json('target_days')->nullable();
            $table->string('color', 20)->default('#3B82F6');
            $table->boolean('is_archived')->default(false)->index('habits_archived_idx');
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['id', 'user_id'], 'habits_id_user_id');
            $table->index(['user_id', 'is_archived'], 'habits_user_archived_idx');
        });

        Schema::create('habit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('habit_id');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('logged_date')->index('habit_logs_date_idx');
            $table->string('status', 50)->default('completed')->index('habit_logs_status_idx');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign(['habit_id', 'user_id'], 'habit_logs_user_habit_fk')
                ->references(['id', 'user_id'])
                ->on('habits')
                ->cascadeOnDelete();

            $table->unique(['habit_id', 'logged_date'], 'habit_date_unique');
            $table->index(['user_id', 'logged_date'], 'habit_logs_user_date_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('habit_logs');
        Schema::dropIfExists('habits');
    }
};
