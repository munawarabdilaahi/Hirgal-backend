<?php

namespace Tests\Feature\Database;

use Illuminate\Database\Connection;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class MySQLCompositeConstraintTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        try {
            DB::connection('mysql_test')->getPdo();
        } catch (\Throwable $exception) {
            $this->markTestSkipped('MySQL test database unavailable: '.$exception->getMessage());
        }
    }

    public function test_mysql8_enforces_composite_foreign_key_on_habit_logs(): void
    {
        $conn = DB::connection('mysql_test');
        $userIds = [];
        $habitId = null;

        try {
            $userIds[] = $this->createUser($conn, 'alice');
            $userIds[] = $this->createUser($conn, 'bob');
            $habitId = $conn->table('habits')->insertGetId([
                'uuid' => (string) Str::uuid(), 'user_id' => $userIds[0], 'title' => 'Constraint test habit',
                'frequency' => 'daily', 'created_at' => now(), 'updated_at' => now(),
            ]);
            $logId = $conn->table('habit_logs')->insertGetId([
                'habit_id' => $habitId, 'user_id' => $userIds[0], 'logged_date' => now()->toDateString(),
                'status' => 'completed', 'created_at' => now(), 'updated_at' => now(),
            ]);
            $this->assertNotNull($logId);

            try {
                $conn->table('habit_logs')->insert([
                    'habit_id' => $habitId, 'user_id' => $userIds[1], 'logged_date' => now()->subDay()->toDateString(),
                    'status' => 'completed', 'created_at' => now(), 'updated_at' => now(),
                ]);
                $this->fail('The composite habit/user foreign key should reject a cross-user log.');
            } catch (QueryException) {
                $this->assertTrue(true);
            }
        } finally {
            if ($habitId !== null) {
                $conn->table('habits')->where('id', $habitId)->delete();
            }
            if ($userIds !== []) {
                $conn->table('users')->whereIn('id', $userIds)->delete();
            }
        }
    }

    public function test_mysql8_composite_foreign_key_cascades_on_habit_delete(): void
    {
        $conn = DB::connection('mysql_test');
        $userId = $this->createUser($conn, 'cascade');
        $habitId = null;

        try {
            $habitId = $conn->table('habits')->insertGetId([
                'uuid' => (string) Str::uuid(), 'user_id' => $userId, 'title' => 'Cascade test habit',
                'frequency' => 'daily', 'created_at' => now(), 'updated_at' => now(),
            ]);
            $conn->table('habit_logs')->insert([
                'habit_id' => $habitId, 'user_id' => $userId, 'logged_date' => now()->toDateString(),
                'status' => 'completed', 'created_at' => now(), 'updated_at' => now(),
            ]);
            $this->assertSame(1, $conn->table('habit_logs')->where('habit_id', $habitId)->count());

            $conn->table('habits')->where('id', $habitId)->delete();
            $this->assertSame(0, $conn->table('habit_logs')->where('habit_id', $habitId)->count());
        } finally {
            if ($habitId !== null) {
                $conn->table('habits')->where('id', $habitId)->delete();
            }
            $conn->table('users')->where('id', $userId)->delete();
        }
    }

    public function test_mysql8_enforces_the_single_appointment_context_check(): void
    {
        $conn = DB::connection('mysql_test');
        $userId = $this->createUser($conn, 'context');
        $projectId = null;
        $teamId = null;

        try {
            $projectId = $conn->table('projects')->insertGetId([
                'uuid' => (string) Str::uuid(), 'name' => 'Appointment context project', 'slug' => Str::uuid(),
                'owner_id' => $userId, 'created_at' => now(), 'updated_at' => now(),
            ]);
            $teamId = $conn->table('teams')->insertGetId([
                'uuid' => (string) Str::uuid(), 'name' => 'Appointment context team', 'slug' => Str::uuid(),
                'leader_id' => $userId, 'created_at' => now(), 'updated_at' => now(),
            ]);

            try {
                $conn->table('appointments')->insert([
                    'uuid' => (string) Str::uuid(), 'organizer_id' => $userId, 'project_id' => $projectId, 'team_id' => $teamId,
                    'title' => 'Invalid multi-context appointment', 'start_time' => now(), 'end_time' => now()->addHour(),
                    'status' => 'scheduled', 'timezone' => 'UTC', 'created_at' => now(), 'updated_at' => now(),
                ]);
                $this->fail('The appointment context check should reject project and team context together.');
            } catch (QueryException) {
                $this->assertTrue(true);
            }
        } finally {
            if ($teamId !== null) {
                $conn->table('teams')->where('id', $teamId)->delete();
            }
            if ($projectId !== null) {
                $conn->table('projects')->where('id', $projectId)->delete();
            }
            $conn->table('users')->where('id', $userId)->delete();
        }
    }

    private function createUser(Connection $connection, string $suffix): int
    {
        return (int) $connection->table('users')->insertGetId([
            'name' => 'Constraint '.$suffix,
            'email' => $suffix.'-'.Str::uuid().'@hirgal-test.local',
            'password' => bcrypt('temporary-test-password'),
            'account_status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
