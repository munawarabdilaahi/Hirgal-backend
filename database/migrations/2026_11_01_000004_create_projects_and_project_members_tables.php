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
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->char('uuid', 36)->unique('projects_uuid_unique');
            $table->string('name', 255);
            $table->string('slug', 255)->unique('projects_slug_unique');
            $table->text('description')->nullable();
            $table->string('status', 50)->default('planning')->index('projects_status_idx');
            $table->string('priority', 50)->default('medium')->index('projects_priority_idx');
            $table->foreignId('owner_id')->constrained('users')->restrictOnDelete();
            $table->date('start_date')->nullable();
            $table->date('due_date')->nullable()->index('projects_due_date_idx');
            $table->timestamp('completed_at')->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();
            $table->softDeletes()->index('projects_deleted_at_idx');
        });

        Schema::create('project_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 50)->default('member')->index('project_members_role_idx');
            $table->timestamp('joined_at')->useCurrent();
            $table->timestamps();

            $table->unique(['project_id', 'user_id'], 'proj_mem_unique');
        });

        Schema::create('project_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('email', 255)->index('proj_inv_email_idx');
            $table->string('role', 50)->default('member');
            $table->char('token_hash', 64)->unique('proj_inv_token_unique');
            $table->string('status', 50)->default('pending')->index('proj_inv_status_idx');
            $table->foreignId('invited_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('expires_at')->index('proj_inv_expires_at_idx');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'email', 'status'], 'proj_inv_active_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_invitations');
        Schema::dropIfExists('project_members');
        Schema::dropIfExists('projects');
    }
};
