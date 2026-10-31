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
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->char('uuid', 36)->unique('tasks_uuid_unique');
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('tasks')->cascadeOnDelete();
            $table->string('title', 255);
            $table->longText('description')->nullable();
            $table->string('status', 50)->default('todo')->index('tasks_status_idx');
            $table->string('priority', 50)->default('medium')->index('tasks_priority_idx');
            $table->foreignId('creator_id')->constrained('users')->restrictOnDelete();
            $table->dateTime('due_date')->nullable()->index('tasks_due_date_idx');
            $table->decimal('estimated_hours', 5, 2)->nullable();
            $table->decimal('actual_hours', 5, 2)->nullable();
            $table->unsignedInteger('order_column')->default(0)->index('tasks_order_idx');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->softDeletes()->index('tasks_deleted_at_idx');

            $table->index(['project_id', 'status', 'order_column'], 'tasks_proj_status_idx');
            $table->index(['project_id', 'due_date'], 'tasks_proj_due_idx');
        });

        Schema::create('task_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('assigned_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamps();

            $table->unique(['task_id', 'user_id'], 'task_assign_unique');
        });

        Schema::create('task_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('task_comments')->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['task_id', 'created_at'], 'comments_task_time_idx');
        });

        Schema::create('task_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('file_name', 255);
            $table->string('file_path', 1024);
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('file_size');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('task_attachments');
        Schema::dropIfExists('task_comments');
        Schema::dropIfExists('task_assignments');
        Schema::dropIfExists('tasks');
    }
};
