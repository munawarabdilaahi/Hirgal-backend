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
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type', 255);
            $table->string('notifiable_type', 255);
            $table->unsignedBigInteger('notifiable_id');
            $table->json('data');
            $table->timestamp('read_at')->nullable()->index('notif_read_at_idx');
            $table->timestamps();

            $table->index(['notifiable_type', 'notifiable_id'], 'notifiable_idx');
        });

        Schema::create('user_mentions', function (Blueprint $table) {
            $table->id();
            $table->string('mentionable_type', 255);
            $table->unsignedBigInteger('mentionable_id');
            $table->foreignId('mentioned_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->string('context_excerpt', 500)->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['mentionable_type', 'mentionable_id'], 'mentionable_idx');
            $table->index(['mentioned_user_id', 'read_at', 'created_at'], 'mentions_inbox_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_mentions');
        Schema::dropIfExists('notifications');
    }
};
