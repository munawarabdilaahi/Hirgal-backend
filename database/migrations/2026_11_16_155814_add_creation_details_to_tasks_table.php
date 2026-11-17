<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table): void {
            $table->string('context')->default('project');
            $table->string('department', 100)->nullable();
            $table->boolean('description_is_rich_text')->default(false);
            $table->date('start_date')->nullable();
            $table->date('remind_on')->nullable();
            $table->timestamp('reminder_due_at')->nullable()->index();
            $table->json('tags')->nullable();
        });

        Schema::create('task_followers', function (Blueprint $table): void {
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['task_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_followers');

        Schema::table('tasks', function (Blueprint $table): void {
            $table->dropIndex(['reminder_due_at']);
            $table->dropColumn(['context', 'department', 'description_is_rich_text', 'start_date', 'remind_on', 'reminder_due_at', 'tags']);
        });
    }
};
