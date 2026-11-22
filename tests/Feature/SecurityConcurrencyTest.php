<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\Security\TwoFactorAuthenticationService;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class SecurityConcurrencyTest extends TestCase
{
    private ?string $temporaryDatabase = null;

    private string $originalConnection;

    private string $originalTestDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->originalConnection = config('database.default');
        $this->originalTestDatabase = config('database.connections.mysql_test.database');

        try {
            DB::connection('mysql_test')->getPdo();
        } catch (\Throwable $exception) {
            $this->markTestSkipped('MySQL test database unavailable: '.$exception->getMessage());
        }

        $database = 'hirgal_security_'.bin2hex(random_bytes(8));
        DB::connection('mysql_test')->statement("CREATE DATABASE `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $this->temporaryDatabase = $database;

        try {
            config(['database.default' => 'mysql_test', 'database.connections.mysql_test.database' => $database]);
            config(['database.connections.security_monitor' => config('database.connections.mysql_test')]);
            DB::purge('mysql_test');
            Artisan::call('migrate', ['--database' => 'mysql_test', '--force' => true, '--no-interaction' => true]);
        } catch (\Throwable $exception) {
            $this->removeTemporaryDatabase();

            throw $exception;
        }
    }

    protected function tearDown(): void
    {
        $this->removeTemporaryDatabase();

        parent::tearDown();
    }

    public function test_simultaneous_self_deactivation_and_deletion_leave_one_active_system_admin(): void
    {
        $role = Role::query()->create(['name' => 'System Admin', 'slug' => UserRole::SystemAdmin->value, 'is_system' => true]);
        $first = User::factory()->create(['password' => Hash::make('Password123!')]);
        $second = User::factory()->create(['password' => Hash::make('Password123!')]);
        $first->roles()->attach($role);
        $second->roles()->attach($role);
        $requests = [
            $this->request('POST', '/api/v1/auth/me/deactivate', ['current_password' => 'Password123!'], $first),
            $this->request('DELETE', '/api/v1/auth/me', ['current_password' => 'Password123!', 'confirm' => 'DELETE'], $second),
        ];

        DB::beginTransaction();
        Role::query()->whereKey($role->id)->lockForUpdate()->firstOrFail();
        $statuses = $this->runBlockedRequests($requests);

        sort($statuses);
        $this->assertSame([200, 422], $statuses);
        $this->assertSame(1, User::query()->where('account_status', 'active')->whereHas('roles', fn ($query) => $query->where('slug', UserRole::SystemAdmin->value))->count());
    }

    public function test_simultaneous_totp_logins_accept_the_step_only_once(): void
    {
        $twoFactor = app(TwoFactorAuthenticationService::class);
        $secret = $twoFactor->generateSecret();
        $user = User::factory()->create([
            'password' => Hash::make('Password123!'),
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => now(),
        ]);
        $time = now()->startOfMinute();
        $this->travelTo($time);
        $code = $twoFactor->currentCode($secret);
        $payload = ['email' => $user->email, 'password' => 'Password123!', 'two_factor_code' => $code];

        DB::beginTransaction();
        User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
        $statuses = $this->runBlockedRequests([
            $this->request('POST', '/api/v1/auth/login', $payload),
            $this->request('POST', '/api/v1/auth/login', $payload),
        ], $time->toIso8601String());

        sort($statuses);
        $this->assertSame([200, 422], $statuses);
        $this->assertSame(intdiv($time->timestamp, 30), $user->fresh()->two_factor_last_used_step);
        $this->assertSame(1, $user->tokens()->count());
    }

    public function test_self_deactivation_and_administrative_suspension_leave_one_active_system_admin(): void
    {
        $role = Role::query()->create(['name' => 'System Admin', 'slug' => UserRole::SystemAdmin->value, 'is_system' => true]);
        $actor = User::factory()->create(['password' => Hash::make('Password123!')]);
        $target = User::factory()->create();
        $actor->roles()->attach($role);
        $target->roles()->attach($role);
        $requests = [
            $this->request('POST', '/api/v1/auth/me/deactivate', ['current_password' => 'Password123!'], $actor),
            $this->request('PUT', '/api/v1/users/'.$target->id, ['account_status' => 'suspended'], $actor),
        ];

        DB::beginTransaction();
        Role::query()->whereKey($role->id)->lockForUpdate()->firstOrFail();
        $statuses = $this->runBlockedRequests($requests);

        sort($statuses);
        $this->assertContains($statuses, [[200, 403], [200, 422]]);
        $this->assertSame(1, User::query()->where('account_status', 'active')->whereHas('roles', fn ($query) => $query->where('slug', UserRole::SystemAdmin->value))->count());
    }

    public function test_self_deletion_and_administrative_deactivation_leave_one_active_system_admin(): void
    {
        $role = Role::query()->create(['name' => 'System Admin', 'slug' => UserRole::SystemAdmin->value, 'is_system' => true]);
        $permission = Permission::query()->create(['name' => 'Delete Users', 'slug' => 'users.delete', 'module' => 'users']);
        $role->permissions()->attach($permission);
        $actor = User::factory()->create(['password' => Hash::make('Password123!')]);
        $target = User::factory()->create();
        $actor->roles()->attach($role);
        $target->roles()->attach($role);
        $requests = [
            $this->request('DELETE', '/api/v1/auth/me', ['current_password' => 'Password123!', 'confirm' => 'DELETE'], $actor),
            $this->request('POST', '/api/v1/users/'.$target->id.'/deactivate', [], $actor),
        ];

        DB::beginTransaction();
        Role::query()->whereKey($role->id)->lockForUpdate()->firstOrFail();
        $statuses = $this->runBlockedRequests($requests);

        sort($statuses);
        $this->assertContains($statuses, [[200, 403], [200, 422]]);
        $this->assertSame(1, User::query()->where('account_status', 'active')->whereHas('roles', fn ($query) => $query->where('slug', UserRole::SystemAdmin->value))->count());
    }

    public function test_simultaneous_recovery_code_login_and_regeneration_consume_the_code_only_once(): void
    {
        $twoFactor = app(TwoFactorAuthenticationService::class);
        $code = 'ABCD-EFGH';
        $user = User::factory()->create([
            'password' => Hash::make('Password123!'),
            'two_factor_secret' => $twoFactor->generateSecret(),
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => $twoFactor->hashRecoveryCodes([$code]),
        ]);
        $requests = [
            $this->request('POST', '/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!', 'two_factor_code' => $code]),
            $this->request('POST', '/api/v1/auth/me/two-factor/recovery-codes', ['current_password' => 'Password123!', 'code' => $code], $user),
        ];

        DB::beginTransaction();
        User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
        $statuses = $this->runBlockedRequests($requests);

        sort($statuses);
        $this->assertSame([200, 422], $statuses);
        $this->assertNotContains($twoFactor->hashRecoveryCode($code), $user->fresh()->two_factor_recovery_codes);
    }

    public function test_login_racing_administrative_suspension_cannot_leave_a_valid_token(): void
    {
        $role = Role::query()->create(['name' => 'System Admin', 'slug' => UserRole::SystemAdmin->value, 'is_system' => true]);
        $admin = User::factory()->create();
        $admin->roles()->attach($role);
        $user = User::factory()->create(['password' => Hash::make('Password123!')]);
        $requests = [
            $this->request('POST', '/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!']),
            $this->request('PUT', '/api/v1/users/'.$user->id, ['account_status' => 'suspended'], $admin),
        ];

        DB::beginTransaction();
        User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
        $statuses = $this->runBlockedRequests($requests);

        sort($statuses);
        $this->assertContains($statuses, [[200, 200], [200, 403]]);
        $this->assertSame('suspended', $user->fresh()->account_status->value);
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_login_racing_password_reset_cannot_leave_a_token_for_the_old_password(): void
    {
        $user = User::factory()->create(['password' => Hash::make('Password123!')]);
        $resetToken = 'concurrency-reset-token';
        DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => hash('sha256', $resetToken),
            'created_at' => now(),
        ]);
        $requests = [
            $this->request('POST', '/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!']),
            $this->request('POST', '/api/v1/auth/reset-password', [
                'email' => $user->email,
                'token' => $resetToken,
                'password' => 'NewPassword123!',
                'password_confirmation' => 'NewPassword123!',
            ]),
        ];

        DB::beginTransaction();
        User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
        $statuses = $this->runBlockedRequests($requests);

        sort($statuses);
        $this->assertContains($statuses, [[200, 200], [200, 422]]);
        $this->assertTrue(Hash::check('NewPassword123!', $user->fresh()->password));
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_separate_schedulers_share_pruning_locks_and_run_the_job_only_once(): void
    {
        config([
            'cache.default' => 'database',
            'cache.stores.database.connection' => 'mysql_test',
            'cache.stores.database.lock_connection' => 'mysql_test',
        ]);
        Cache::purge('database');
        $this->artisan('schedule:list')->assertSuccessful();
        $event = collect(app(Schedule::class)->events())
            ->first(fn ($candidate): bool => str_contains($candidate->command ?? '', 'sanctum:prune-expired'));
        $this->assertNotNull($event);

        $user = User::factory()->create();
        $expired = $user->createToken('expired')->accessToken;
        $expired->forceFill(['created_at' => now()->subDays(32)])->save();
        $runScheduler = function (): Process {
            $worker = <<<'PHP'
require getcwd().'/vendor/autoload.php';
$app = require getcwd().'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
if (Illuminate\Support\Facades\DB::connection()->getDatabaseName() !== getenv('DB_DATABASE')) { exit(42); }
Illuminate\Support\Carbon::setTestNow($argv[1]);
$status = Illuminate\Support\Facades\Artisan::call('schedule:run', ['--no-interaction' => true]);
echo Illuminate\Support\Facades\Artisan::output();
exit($status);
PHP;
            $database = config('database.connections.mysql_test');
            $process = new Process([PHP_BINARY, '-r', $worker, now()->startOfDay()->addHours(2)->toIso8601String()], base_path(), [
                'APP_ENV' => 'testing',
                'APP_KEY' => config('app.key'),
                'APP_MAINTENANCE_DRIVER' => 'file',
                'DB_CONNECTION' => 'mysql',
                'DB_URL' => '',
                'DB_HOST' => $database['host'],
                'DB_PORT' => (string) $database['port'],
                'DB_DATABASE' => $this->temporaryDatabase,
                'DB_USERNAME' => $database['username'],
                'DB_PASSWORD' => $database['password'],
                'CACHE_STORE' => 'database',
                'CACHE_PREFIX' => config('cache.prefix'),
                'DB_CACHE_CONNECTION' => 'mysql',
                'DB_CACHE_LOCK_CONNECTION' => 'mysql',
            ]);
            $process->setTimeout(60);
            $process->run();
            $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());

            return $process;
        };

        $lock = Cache::store('database')->lock($event->mutexName(), 60);
        $this->assertTrue($lock->get());
        try {
            $runScheduler();
            $this->assertNotNull($expired->fresh());
        } finally {
            $lock->release();
        }

        $runScheduler();
        $this->assertNull($expired->fresh());
        $second = $user->createToken('expired after first run')->accessToken;
        $second->forceFill(['created_at' => now()->subDays(32)])->save();
        $duplicate = $runScheduler();

        $this->assertStringContainsString('already ran on another server', $duplicate->getOutput());
        $this->assertNotNull($second->fresh());
    }

    /** @return array{method: string, path: string, body: array<string, string>, token: ?string} */
    private function request(string $method, string $path, array $body, ?User $user = null): array
    {
        return ['method' => $method, 'path' => $path, 'body' => $body, 'token' => $user?->createToken('concurrency-test')->plainTextToken];
    }

    /**
     * @param  list<array{method: string, path: string, body: array<string, string>, token: ?string}>  $requests
     * @return list<int>
     */
    private function runBlockedRequests(array $requests, ?string $time = null): array
    {
        $worker = <<<'PHP'
require getcwd().'/vendor/autoload.php';
$data = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
$app = require getcwd().'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();
config(['database.default' => 'mysql_test', 'database.connections.mysql_test.database' => $data['database'], 'app.key' => $data['key'], 'cache.default' => 'array', 'session.driver' => 'array']);
Illuminate\Support\Facades\DB::purge('mysql_test');
if ($data['time'] !== null) { Illuminate\Support\Carbon::setTestNow($data['time']); }
$id = Illuminate\Support\Facades\DB::selectOne('SELECT CONNECTION_ID() AS id')->id;
echo 'READY:'.$id."\n";
flush();
$request = Illuminate\Http\Request::create($data['request']['path'], $data['request']['method'], [], [], [], ['HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json', 'HTTP_AUTHORIZATION' => $data['request']['token'] ? 'Bearer '.$data['request']['token'] : ''], json_encode($data['request']['body'], JSON_THROW_ON_ERROR));
$response = $kernel->handle($request);
echo 'STATUS:'.$response->getStatusCode()."\n";
$kernel->terminate($request, $response);
PHP;
        $processes = [];

        try {
            foreach ($requests as $request) {
                $process = new Process([PHP_BINARY, '-r', $worker], base_path(), ['APP_ENV' => 'testing', 'BCRYPT_ROUNDS' => '4']);
                $process->setInput(json_encode(['database' => $this->temporaryDatabase, 'key' => config('app.key'), 'request' => $request, 'time' => $time], JSON_THROW_ON_ERROR));
                $process->setTimeout(30);
                $process->start();
                $processes[] = $process;
            }

            $deadline = microtime(true) + 15;
            do {
                $ids = [];
                foreach ($processes as $process) {
                    if (! $process->isRunning()) {
                        $this->fail('Request process exited before reaching the lock: '.$process->getErrorOutput().' '.$process->getOutput());
                    }
                    if (preg_match('/READY:(\d+)/', $process->getOutput(), $match)) {
                        $ids[] = (int) $match[1];
                    }
                }
                $waiting = count($ids) === count($requests)
                    ? DB::connection('security_monitor')->table('performance_schema.data_lock_waits as waits')
                        ->join('performance_schema.threads as threads', 'threads.thread_id', '=', 'waits.requesting_thread_id')
                        ->whereIn('threads.processlist_id', $ids)->distinct()->count('threads.processlist_id')
                    : 0;
                if ($waiting === count($requests)) {
                    break;
                }
                usleep(50000);
            } while (microtime(true) < $deadline);

            $this->assertSame(count($requests), $waiting, 'Both independent requests must be waiting on the held MySQL lock.');
            DB::commit();

            $statuses = [];
            foreach ($processes as $process) {
                $process->wait();
                $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());
                $this->assertMatchesRegularExpression('/STATUS:(\d+)/', $process->getOutput());
                preg_match('/STATUS:(\d+)/', $process->getOutput(), $match);
                $statuses[] = (int) $match[1];
            }

            return $statuses;
        } finally {
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            foreach ($processes as $process) {
                if ($process->isRunning()) {
                    $process->stop();
                }
            }
        }
    }

    private function removeTemporaryDatabase(): void
    {
        if ($this->temporaryDatabase === null) {
            return;
        }

        DB::purge('security_monitor');
        DB::purge('mysql_test');
        config(['database.default' => $this->originalConnection, 'database.connections.mysql_test.database' => $this->originalTestDatabase]);
        $database = $this->temporaryDatabase;
        $this->temporaryDatabase = null;
        DB::connection('mysql_test')->statement("DROP DATABASE `{$database}`");
        DB::purge('mysql_test');
    }
}
