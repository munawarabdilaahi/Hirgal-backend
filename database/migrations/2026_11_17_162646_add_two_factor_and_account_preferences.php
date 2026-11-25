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
        Schema::table('users', function (Blueprint $table): void {
            $table->text('two_factor_secret')->nullable();
            $table->text('two_factor_recovery_codes')->nullable();
            $table->timestamp('two_factor_confirmed_at')->nullable();
            $table->unsignedBigInteger('two_factor_last_used_step')->nullable();
        });

        Schema::table('user_profiles', function (Blueprint $table): void {
            $table->string('locale', 10)->default('en');
            $table->string('date_format', 20)->default('Y-m-d');
            $table->string('time_format', 5)->default('24h');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_profiles', function (Blueprint $table): void {
            $table->dropColumn(['locale', 'date_format', 'time_format']);
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn([
                'two_factor_secret',
                'two_factor_recovery_codes',
                'two_factor_confirmed_at',
                'two_factor_last_used_step',
            ]);
        });
    }
};
