<?php

namespace Tests\Feature\Database;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class MySQLCompositeConstraintTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Ensure we test against the real MySQL 8 test database
        $this->skipIfMySQLUnavailable();
    }

    protected function skipIfMySQLUnavailable(): void
    {
        try {
            DB::connection('mysql_test')->getPdo();
        } catch (\Throwable $e) {
            $this->markTestSkipped('MySQL test database unavailable: '.$e->getMessage());
        }
    }

    public function test_mysql8_enforces_composite_foreign_key_on_habit_logs(): void
    {
        $conn = DB::connection('mysql_test');

        // Disable and re-enable FK checks to ensure clean testing state in dedicated test DB
        $conn->table('habit_logs')->delete();
        $conn->table('habits')->delete();
        $conn->table('users')->delete();

        // Create User A and User B in MySQL
        $userAId = $conn->table('users')->insertGetId([
            'name' => 'User Alice',
            'email' => 'alice@hirgal-test.local',
            'password' => bcrypt('password'),
            'account_status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $userBId = $conn->table('users')->insertGetId([
            'name' => 'User Bob',
            'email' => 'bob@hirgal-test.local',
            'password' => bcrypt('password'),
            'account_status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Alice creates Habit #1
        $habitId = $conn->table('habits')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'user_id' => $userAId,
            'title' => "Alice's Private Habit",
            'frequency' => 'daily',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Alice logs her own habit -> MUST SUCCEED
        $logId = $conn->table('habit_logs')->insertGetId([
            'habit_id' => $habitId,
            'user_id' => $userAId,
            'logged_date' => now()->toDateString(),
            'status' => 'completed',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertNotNull($logId);

        // Bob attempts to log against Alice's Habit using his own user_id -> MUST FAIL with MySQL Foreign Key Constraint Violation
        $this->expectException(QueryException::class);

        $conn->table('habit_logs')->insert([
            'habit_id' => $habitId,
            'user_id' => $userBId, // Cross-user tampering!
            'logged_date' => now()->subDay()->toDateString(),
            'status' => 'completed',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_mysql8_composite_foreign_key_cascades_on_habit_delete(): void
    {
        $conn = DB::connection('mysql_test');

        $userId = $conn->table('users')->insertGetId([
            'name' => 'Cascade User',
            'email' => 'cascade@hirgal-test.local',
            'password' => bcrypt('password'),
            'account_status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $habitId = $conn->table('habits')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'user_id' => $userId,
            'title' => 'Temporary Habit',
            'frequency' => 'daily',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $conn->table('habit_logs')->insert([
            'habit_id' => $habitId,
            'user_id' => $userId,
            'logged_date' => now()->toDateString(),
            'status' => 'completed',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertEquals(1, $conn->table('habit_logs')->where('habit_id', $habitId)->count());

        // Delete parent habit
        $conn->table('habits')->where('id', $habitId)->delete();

        // MySQL composite foreign key MUST cascade and delete the child logs
        $this->assertEquals(0, $conn->table('habit_logs')->where('habit_id', $habitId)->count());
    }
}
