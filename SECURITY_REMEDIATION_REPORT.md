# Security remediation report

Date: 2026-11-21 (Africa/Nairobi)

## Scope and status

This report continues the security remediation described in the preceding conversation. The requested COMPLETE PROJECT AUDIT REPORT was not found in this repository, so this is not a complete assessment of every audit finding or a production security certification. The existing security changes and dependency lockfile were preserved. No changes were committed or deployed.

The MySQL concurrency tests below now provide evidence for the tested last-administrator and one-time 2FA scenarios. They do not establish correctness for every possible operation or infrastructure configuration.

## Production dependency advisories

The initial production audit reported seven advisories. The existing lockfile changes upgrade Laravel 13.39.0 to 13.43.0 and Symfony HTTP Foundation, HTTP Kernel, and Routing 8.1.10 to 8.1.11, within existing constraints and without major-version upgrades. The current `composer audit --no-dev` reports no advisories.

| Advisory | Affected installed package | First patched version on installed branch |
| --- | --- | --- |
| CVE-2026-128083, task output injection | laravel/framework 13.39.0 | 13.40.0 |
| CVE-2026-121619, trusted proxy handling | symfony/http-foundation 8.1.10 | 8.1.11 |
| CVE-2026-118514, HEAD access-control handling | symfony/http-foundation 8.1.10 | 8.1.11 |
| Script-name path bypass | symfony/http-foundation 8.1.10 | 8.1.11 |
| Client-controlled generated URL host | symfony/http-foundation 8.1.10 | 8.1.11 |
| CVE-2026-123339, forwarded headers in inline fragments | symfony/http-kernel 8.1.10 | 8.1.11 |
| CVE-2026-118516, compiled route host matching | symfony/routing 8.1.10 | 8.1.11 |

The full Composer audit also identified the development-only Symfony YAML advisory CVE-2026-123792 (excessive parsing time). `symfony/yaml` was updated from 8.1.10 to 8.1.11, the first patched release on that branch. The package is required by `laravel/roster` under `^7.2|^8.0`; Composer resolved the patch without updating another package or changing the manifest. Both the full and production-only Composer audits now report no advisories. Dependency resolution and passing tests are compatibility evidence, not proof that every upstream behavior change is harmless in every deployment.

## Administrator and 2FA concurrency

The existing remediation serializes self-service deactivation and deletion using the System Admin role row, which is also used by the administrative actions, and uses locking reads when counting active administrators. The login challenge and account-settings 2FA operations serialize their verification and writes using the user row. The existing encrypted casts for 2FA secrets and recovery-code hashes are retained.

`tests/Feature/SecurityConcurrencyTest.php` exercises real API requests in independent PHP processes against MySQL 8. Each test creates a uniquely named database, runs the application migrations, and removes only its own database afterward; it does not migrate or clear the existing `hirgal_backend_test` database. A separate connection observes MySQL `performance_schema.data_lock_waits` and confirms that both requests are waiting on the held coordination row before the test releases it. The cases cover:

- Self-deactivation racing self-deletion, with exactly one active System Admin remaining.
- Self-deactivation racing an administrative status update, with exactly one active System Admin remaining.
- Self-deletion racing the administrative deactivation action, with exactly one active System Admin remaining.
- Two login requests using the same TOTP step, with one success and one rejection.
- Login racing recovery-code regeneration using the same recovery code, with one success and one rejection.
- Login racing an administrative suspension, with no bearer tokens left for the suspended user.
- Login racing a password reset, with no token left for the old password.

These tests require MySQL credentials able to create and drop a temporary database, run migrations, and inspect lock waits. They skip if the configured MySQL connection is unavailable; inability to create the temporary database or inspect lock waits is a failure, not a passing concurrency check. They do not cover every ordering or every combination of administrative and 2FA operations.

## Token policy

Sanctum now enforces a **30-day absolute lifetime** from token creation. The limit applies to login, invitation, registration and existing bearer tokens, including tokens with a later or unset `expires_at`; an earlier per-token expiry still applies. Usage does not extend the lifetime. Thirty days limits exposure without imposing a short timeout on existing API clients, but it is a policy tradeoff rather than a guarantee of safety. No refresh-token flow exists: clients must sign in again after a 401. The standalone frontend already clears the current in-memory bearer token on a 401; the Inertia workspace uses a separate browser session governed by session configuration.

**Deployment impact:** this is effective immediately for already-issued tokens. Tokens created 30 or more days before deployment will stop authenticating on the first request after the change. Coordinate reauthentication with API consumers before deployment; tokens that have expired cannot be restored merely by continuing to use them. API responses do not currently include an expiration timestamp.

Logout revokes the current token; logout-all and password reset revoke all bearer tokens; password change can optionally revoke other tokens; account deactivation and deletion revoke tokens. Administrative status updates to a non-active state now also delete the target user's tokens, so reactivation does not restore them. Token issuance and suspension are serialized on the user row, and login rechecks credentials and account status under that lock. These statements concern bearer tokens: browser sessions have separate lifetime and revocation behavior, and administrator suspension does not proactively delete every browser session.

Expired token rows are pruned by the scheduled `sanctum:prune-expired --hours=24` command at 02:00 daily in the application timezone (currently UTC). Sanctum removes rows more than 24 hours past either their individual expiry or the configured global lifetime. Under normal daily operation, rows are retained for roughly 24–48 hours after expiry; expiration is enforced independently of pruning. The job uses Laravel's `onOneServer` mutex to prevent duplicate runs in the same scheduled minute and a 60-minute overlap lock to prevent overlapping execution.

The application schedule alone does not start the scheduler: the deployment must invoke `php artisan schedule:run` every minute, or use an equivalent supported scheduler service. `php artisan schedule:list` confirms the job is registered locally. The local configuration uses the database cache, with its connection and lock connection falling back to the default database connection. An isolated MySQL test runs separate scheduler processes against a shared database cache: a held overlap lock prevents cleanup, a subsequent run removes an expired token, and a later scheduler process skips the same minute even after the first completes. This verifies the application behavior with a shared MySQL cache, not production infrastructure.

Production hosts must use the same supported shared atomic cache and lock backend, cache prefix, application schedule and timezone, and must have working scheduler invocation and synchronized clocks. In particular, process-local `array` and host-local file caches do not coordinate separate servers; a failover to process-local cache also cannot guarantee cross-host exclusion. No production host configuration was available to verify those conditions. No Windows scheduled task with `Hirgal` or `Laravel` in its name was found locally; that name-based check does not rule out differently named or external scheduler services. The cleanup affects bearer-token rows, not browser sessions.

On 2026-11-21, a further production-access discovery found one DigitalOcean droplet with a Laravel Forge tag, but neither its metadata nor the repository establishes that it hosts Hirgal. The available remote-desktop device was offline, and no Hirgal production SSH alias or deployment destination was identified in the workspace. The local scheduler remains registered at 02:00 UTC and the local default cache is database-backed. These observations do not verify a production scheduler, deployment version, shared cache, or scheduler execution; identification and access to the actual production environment are still required. No production changes were made.

## Verification

- MySQL security-race tests: 7 cases, 52 assertions, against MySQL 8.0.46, as part of the full suite.
- Focused authentication and user-management suite: 74 passed, 579 assertions.
- Frontend API client tests: 7 passed, including clearing the current token on a 401.
- Expired-token pruning tests: 2 passed, 14 assertions, covering global and individual expiration, retention boundaries, an active bearer token, schedule registration/due time, and single-server configuration.
- Isolated MySQL scheduler integration test: 1 passed, 10 assertions; separate scheduler processes exercised the overlap lock, actual pruning, and single-server mutex.
- `composer test` after scheduler coordination changes: 473 passed, 2,694 assertions.
- `composer audit --no-dev`: no security advisories found.
- `composer audit` (including development dependencies): no security advisories found after the Symfony YAML update.
- `composer validate --no-check-publish`: passed after the Symfony YAML update.
- Laravel Pint on dirty PHP files and the new test: passed.
- Previous remediation: root and frontend builds passed, and Composer manifest validation passed.

The complete audit report remains unavailable, and production deployment configuration and broader threat coverage have not been independently verified. Do not treat the results as an unconditional production security approval.
