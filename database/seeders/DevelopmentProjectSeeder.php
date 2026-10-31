<?php

namespace Database\Seeders;

use App\Enums\AppointmentLocationType;
use App\Enums\AppointmentStatus;
use App\Enums\HabitFrequency;
use App\Enums\HabitLogStatus;
use App\Enums\ParticipantStatus;
use App\Enums\ProjectMemberRole;
use App\Enums\ProjectPriority;
use App\Enums\ProjectStatus;
use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Enums\TeamMemberRole;
use App\Models\Appointment;
use App\Models\AppointmentParticipant;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectTeam;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Models\TaskComment;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DevelopmentProjectSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->warn('DevelopmentProjectSeeder execution blocked: Cannot seed demo projects in production environment.');

            return;
        }

        $pm = User::where('email', 'pm@hirgal.local')->first();
        $lead = User::where('email', 'lead@hirgal.local')->first();
        $member = User::where('email', 'member@hirgal.local')->first();

        if (! $pm || ! $lead || ! $member) {
            return;
        }

        // 1. Create a Reusable Team
        $team = Team::firstOrCreate(
            ['slug' => 'core-platform-engineers'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Core Platform Engineers',
                'description' => 'Cross-functional engineering squad dedicated to platform architecture and reliability.',
                'leader_id' => $lead->id,
            ]
        );

        TeamMember::firstOrCreate([
            'team_id' => $team->id,
            'user_id' => $lead->id,
        ], [
            'role' => TeamMemberRole::Leader,
            'joined_at' => now(),
        ]);

        TeamMember::firstOrCreate([
            'team_id' => $team->id,
            'user_id' => $member->id,
        ], [
            'role' => TeamMemberRole::Member,
            'joined_at' => now(),
        ]);

        // 2. Create Sample Project: Hirgal v1 Core Platform
        $project = Project::firstOrCreate(
            ['slug' => 'hirgal-core-platform'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Hirgal Core Platform Engine',
                'description' => 'Foundational backend architecture, modular monolith domain services, and RESTful API suite.',
                'status' => ProjectStatus::Active,
                'priority' => ProjectPriority::High,
                'owner_id' => $pm->id,
                'start_date' => now()->subWeeks(2)->toDateString(),
                'due_date' => now()->addMonths(2)->toDateString(),
                'settings' => ['kanban_enabled' => true, 'notifications_enabled' => true],
            ]
        );

        // Project Memberships
        ProjectMember::firstOrCreate([
            'project_id' => $project->id,
            'user_id' => $pm->id,
        ], ['role' => ProjectMemberRole::Owner, 'joined_at' => now()]);

        ProjectMember::firstOrCreate([
            'project_id' => $project->id,
            'user_id' => $lead->id,
        ], ['role' => ProjectMemberRole::Lead, 'joined_at' => now()]);

        ProjectMember::firstOrCreate([
            'project_id' => $project->id,
            'user_id' => $member->id,
        ], ['role' => ProjectMemberRole::Member, 'joined_at' => now()]);

        // Allocate Team to Project
        ProjectTeam::firstOrCreate([
            'project_id' => $project->id,
            'team_id' => $team->id,
        ], ['assigned_at' => now()]);

        // 3. Create Sample Tasks
        $task1 = Task::firstOrCreate(
            ['project_id' => $project->id, 'title' => 'Design & Implement Database Schema'],
            [
                'uuid' => (string) Str::uuid(),
                'description' => 'Architect all 27 normalized relational domain tables with composite foreign keys and indexes.',
                'status' => TaskStatus::Done,
                'priority' => TaskPriority::Urgent,
                'creator_id' => $pm->id,
                'due_date' => now()->addDays(2),
                'estimated_hours' => 16.00,
                'actual_hours' => 14.50,
                'order_column' => 1,
                'completed_at' => now(),
            ]
        );

        TaskAssignment::firstOrCreate([
            'task_id' => $task1->id,
            'user_id' => $lead->id,
        ], ['assigned_by' => $pm->id, 'assigned_at' => now()]);

        $task2 = Task::firstOrCreate(
            ['project_id' => $project->id, 'title' => 'Build Eloquent Models, Factories & Seeders'],
            [
                'uuid' => (string) Str::uuid(),
                'description' => 'Implement typed Eloquent models with attribute casting, factories, and comprehensive seeders.',
                'status' => TaskStatus::InProgress,
                'priority' => TaskPriority::High,
                'creator_id' => $lead->id,
                'due_date' => now()->addDays(5),
                'estimated_hours' => 20.00,
                'actual_hours' => 8.00,
                'order_column' => 2,
            ]
        );

        TaskAssignment::firstOrCreate([
            'task_id' => $task2->id,
            'user_id' => $member->id,
        ], ['assigned_by' => $lead->id, 'assigned_at' => now()]);

        TaskComment::firstOrCreate([
            'task_id' => $task2->id,
            'user_id' => $lead->id,
        ], [
            'body' => 'Make sure the composite foreign key for habit logs is covered with automated tests.',
        ]);

        // 4. Create Sample Appointment
        $appointment = Appointment::firstOrCreate(
            ['organizer_id' => $lead->id, 'title' => 'Sprint Architecture Review'],
            [
                'uuid' => (string) Str::uuid(),
                'description' => 'Weekly technical synchronization on database integrity and API endpoint design.',
                'start_time' => now()->addDays(1)->setHour(14)->setMinute(0)->setSecond(0),
                'end_time' => now()->addDays(1)->setHour(15)->setMinute(0)->setSecond(0),
                'location_type' => AppointmentLocationType::Virtual,
                'meeting_link' => 'https://meet.google.com/hir-gal-sync',
                'status' => AppointmentStatus::Confirmed,
            ]
        );

        AppointmentParticipant::firstOrCreate([
            'appointment_id' => $appointment->id,
            'user_id' => $pm->id,
        ], ['status' => ParticipantStatus::Accepted, 'responded_at' => now()]);

        AppointmentParticipant::firstOrCreate([
            'appointment_id' => $appointment->id,
            'user_id' => $member->id,
        ], ['status' => ParticipantStatus::Accepted, 'responded_at' => now()]);

        // 5. Create Sample Habits & Logs
        $habit = Habit::firstOrCreate(
            ['user_id' => $member->id, 'title' => 'Daily Architecture Code Review'],
            [
                'uuid' => (string) Str::uuid(),
                'description' => 'Review at least two pull requests and verify database queries daily.',
                'frequency' => HabitFrequency::Daily,
                'target_days' => ['mon', 'tue', 'wed', 'thu', 'fri'],
                'color' => '#10B981',
                'is_archived' => false,
            ]
        );

        for ($i = 0; $i < 3; $i++) {
            $date = now()->subDays($i)->toDateString();
            if (! HabitLog::where('habit_id', $habit->id)->whereDate('logged_date', $date)->exists()) {
                HabitLog::create([
                    'habit_id' => $habit->id,
                    'user_id' => $habit->user_id,
                    'logged_date' => $date,
                    'status' => HabitLogStatus::Completed,
                    'notes' => 'Reviewed PRs and checked index utilization.',
                ]);
            }
        }
    }
}
