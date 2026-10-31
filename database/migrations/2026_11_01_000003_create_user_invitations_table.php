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
        Schema::create('user_invitations', function (Blueprint $table) {
            $table->id();
            $table->string('email', 255)->index('user_invitations_email_idx');
            $table->foreignId('role_id')->constrained('roles')->restrictOnDelete();
            $table->char('token_hash', 64)->unique('user_invitations_token_hash_unique');
            $table->string('status', 50)->default('pending')->index('user_invitations_status_idx');
            $table->foreignId('invited_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('expires_at')->index('user_invitations_expires_at_idx');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_invitations');
    }
};
