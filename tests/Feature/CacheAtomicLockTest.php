<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class CacheAtomicLockTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_cache_lock_can_be_acquired_and_blocks_concurrent_acquisition(): void
    {
        $lockKey = 'test-atomic-lock';
        $lock1 = Cache::store('database')->lock($lockKey, 10);
        $lock2 = Cache::store('database')->lock($lockKey, 10);

        $this->assertTrue($lock1->get());
        $this->assertFalse($lock2->get());

        $this->assertDatabaseHas('cache_locks', [
            'key' => config('cache.prefix').$lockKey,
        ]);

        $this->assertTrue($lock1->release());
        $this->assertTrue($lock2->get());

        $lock2->release();
    }

    public function test_database_cache_lock_expires_after_ttl(): void
    {
        $this->travelTo(now()->startOfSecond());
        $lockKey = 'test-expiring-lock';
        $lock1 = Cache::store('database')->lock($lockKey, 5);
        $lock2 = Cache::store('database')->lock($lockKey, 5);

        $this->assertTrue($lock1->get());
        $this->assertFalse($lock2->get());

        $this->travel(6)->seconds();

        $this->assertTrue($lock2->get());
        $lock2->release();
    }

    public function test_database_cache_lock_blocks_during_block_callback(): void
    {
        $lockKey = 'test-callback-lock';
        $executed = false;

        Cache::store('database')->lock($lockKey, 10)->get(function () use (&$executed, $lockKey) {
            $executed = true;
            $conflictingLock = Cache::store('database')->lock($lockKey, 10);
            $this->assertFalse($conflictingLock->get());
        });

        $this->assertTrue($executed);

        // After block, lock should be released
        $newLock = Cache::store('database')->lock($lockKey, 10);
        $this->assertTrue($newLock->get());
        $newLock->release();
    }
}
