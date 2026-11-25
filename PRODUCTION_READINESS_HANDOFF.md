# Hirgal production readiness — developer handoff

**Review date:** 25 November 2026  
**Scope:** Current local source and checkout; performance, security, code quality, and release verification.  
**Status:** Assessment only. No application fixes or deployment were performed.

## Assessment

- **Overall: 6/10.** Hold a public production release until the release checks pass and the security findings are addressed.
- **Performance: 6/10.** Pagination, eager loading, indexes, queued notifications, and chunked reminder processing provide a useful foundation. Habit history processing and repeated aggregate queries need attention.
- **Security: 6/10.** Policies, scoped queries, request validation, rate limiting, invitation-controlled registration, token expiration, and two-factor authentication are positive. Public health diagnostics and challenge concurrency need remediation or verification.
- **Code quality: 7/10.** Clear controller/request/service/action/policy/resource separation, versioned APIs, strict TypeScript configuration, factories, and substantial test coverage in source. Release reproducibility remains unproven in this checkout.

These are engineering judgments, not benchmark results or a penetration-test certification. No live infrastructure, load test, backup restoration, or deployed configuration was inspected. Existing reports in the repository describe earlier runs and other paths/revisions; their passing results were not independently reproduced during this review.

## P1 — Restore reproducible release verification

### Observed results

- `composer validate --no-check-publish`: passed.
- `php artisan route:list --path=api --except-vendor`: passed.
- `npm run build` from the repository root: failed resolving `qrcode` imported by `frontend/src/features/account/TwoFactorSettings.tsx`.
- `npm run typecheck --prefix frontend`: failed with seven errors in `TwoFactorSettings.tsx` and `services/realtime/echo.ts`. Missing modules/types included `qrcode`, `laravel-echo`, and `pusher-js`; remaining errors included implicit-any callback parameters.
- `php artisan test --compact`: PHPUnit could not open `C:\Users\munii\Herd\Hirgal-backend\vendor/autoload.php`. No passing backend test result was obtained.
- `npm run test --prefix frontend`: Vitest started but did not complete successfully. The stalled run was stopped; no passing suite result was obtained.
- Frontend lint emitted warnings, including synchronous state updates in effects, component export boundaries, and an impure render expression. Capture a fresh complete lint result before signing off.
- `composer audit --locked --no-interaction`: blocked by DNS resolution failure for `repo.packagist.org`. Dependency vulnerability status remains unknown.

The missing JS modules are declared in `frontend/package.json`. These failures may be installation/environment issues rather than defects in a clean installation. Artisan could boot while the PHPUnit subprocess failed to resolve its bootstrap; investigate that discrepancy rather than assuming all backend dependencies are absent. `composer show --direct` also did not list Reverb or Resend despite their declarations and lockfile entries, so verify installed-package consistency.

### Developer actions

1. Record the branch, commit, PHP/Node/npm/Composer versions, and working-tree status.
2. Reproduce setup in an isolated clean checkout using the committed lockfiles. Inspect Composer scripts before running them: `composer run setup` includes migrations, so do not run it against a production or shared database.
3. Restore existing declared dependencies without changing version requirements or lockfiles unnecessarily. Obtain approval before changing dependencies, per `AGENTS.md`.
4. Investigate PHPUnit bootstrap/subprocess path resolution and the stalled Vitest run.
5. Rerun the commands above, plus the appropriate frontend build and tests. Rerun dependency audits when network access is available.

### Acceptance criteria

- A clean checkout can install dependencies, build production assets, typecheck, and run backend/frontend tests successfully.
- No unresolved modules remain. Record any intentional skips and their reasons.
- The dependency audits complete, and any actionable advisories are addressed or explicitly accepted.
- Record exact commands, environment, commit, and results; do not reuse historical passing counts as current evidence.

## P1 — Remove public health diagnostic disclosure

**Confidence:** Confirmed by source inspection.

**Files:**

- `app/Http/Controllers/Api/V1/HealthController.php`
- `routes/api.php`
- `tests/Feature/Api/V1/HealthCheckTest.php`

The unauthenticated `/api/v1/health` endpoint concatenates the raw database exception message into the returned database status. It also exposes framework/PHP versions and the application environment. The exception disclosure occurs independently of the generic API exception handler's debug protection.

Return minimal public healthy/degraded status and log diagnostic details privately. If detailed diagnostics are operationally necessary, restrict them to an authorized internal surface. Update the existing test, which currently expects the diagnostic fields.

### Acceptance criteria

- Simulated database failure returns HTTP 503 with a generic response and no raw exception, connection details, paths, or internal configuration.
- Healthy responses retain the status required by monitoring without unnecessary internal metadata.
- Meaningful regression tests cover both success and failure.

## P1 — Verify and fix two-factor challenge concurrency

**Confidence:** Source-level concurrency concern; no exploit was reproduced during this review.

**Files:**

- `app/Services/Security/TwoFactorChallengeService.php`
- `app/Services/Security/TwoFactorAuthenticationService.php`
- `tests/Feature/Auth/TwoFactorAuthenticationTest.php`
- `tests/Feature/SecurityConcurrencyTest.php`

`verifyChallenge()` checks challenge consumption through `getChallenge()` and reads the failed-attempt count before acquiring the user row lock. Within the transaction it uses that previously read state without rechecking consumption. Concurrent requests can therefore arrive with stale challenge validity and attempt counts. Existing TOTP-step and recovery-code protections should be preserved, but they do not by themselves establish atomic challenge consumption.

Choose a consistent synchronization mechanism for challenge inspection, attempt accounting, verification, and consumption. Recheck validity after acquiring the protection. Ensure failed-attempt accounting survives rejected verification and transaction rollback; account for the deployed cache backend's behavior.

### Acceptance criteria

- Concurrent valid submissions for one challenge cannot produce multiple successful authentications, including submissions using distinct valid recovery codes.
- Concurrent invalid submissions cannot lose failed-attempt increments or bypass the configured challenge attempt limit.
- Consumed, cancelled, and expired challenges remain rejected.
- Existing TOTP replay protection and one-time recovery-code consumption remain intact.
- Run meaningful concurrency tests with separate processes/connections against an isolated production-like database and shared cache, rather than relying only on SQLite in-memory tests.

## P2 — Bound habit history loading and eliminate repeated history queries

**Confidence:** Confirmed query patterns; production impact has not been measured.

**Files:**

- `app/Services/Habit/HabitService.php`, especially `list()` and `dailyOverview()`
- `app/Services/Habit/HabitStreakService.php`, especially `calculateStats()`
- `app/Http/Controllers/Api/V1/Habits/HabitController.php`, especially `index()`
- `tests/Feature/Habits/HabitApiTest.php`

`HabitService::list()` fetches all historical logs for the habits on the page, groups them in memory, then keeps 30 per habit. `HabitController::index()` subsequently calls `calculateStats()` per habit; that method queries the habit's history again. The daily overview also calculates statistics separately for each habit.

Limit recent logs at the SQL level per habit and batch/reuse the history or aggregate data needed for statistics. Preserve complete-history streak semantics: applying an arbitrary history cutoff would make some results incorrect. Consider persisted aggregates only if measurements justify the added complexity.

### Acceptance criteria

- Recent-log payloads remain correct and bounded per habit without hydrating every historical log first.
- Query counts no longer increase by one history query per listed habit.
- Current/longest streaks, skipped/missed days, timezone behavior, and completion statistics retain existing behavior.
- Record query counts, response time, and memory for representative page sizes and long histories before and after the change.

## P2 — Measure and consolidate task summary queries

**Confidence:** Confirmed query pattern; not demonstrated to violate a latency target.

**File:** `app/Services/Task/TaskService.php`, `scheduleSummary()`.

The method issues eight separate count queries over related scoped task filters. Measure it with representative membership/task volumes, then consider conditional aggregation or another consolidated query. Preserve authorization scope and schedule group definitions.

### Acceptance criteria

- Counts match existing behavior across personal/project tasks, statuses, and date boundaries.
- No widening of project visibility occurs.
- Before/after measurements demonstrate a useful improvement before retaining a more complex implementation.

## P2 — Establish operational release evidence

These are unverified release requirements, not confirmed infrastructure defects:

- Verify actual production configuration: `APP_ENV=production`, `APP_DEBUG=false`, appropriate secure-cookie and HTTPS settings, allowed origins, and stateful domains. `.env.example` contains local development values and is not evidence of deployed values.
- Verify the production database engine, migration execution, rollback/recovery procedure, and an isolated test database. MySQL-specific constraint and concurrency tests can skip when the test database is unavailable; a green SQLite run alone does not validate them.
- Verify supervised queue workers, failed-job monitoring, scheduler execution, shared locks across instances, and realtime configuration if enabled.
- Verify actual invitation/password-reset email delivery and recipient-accessible URLs.
- Verify backups with a restoration exercise, application/error monitoring, and health alerting.
- Run staging acceptance for authentication/2FA, role boundaries, invitations, projects, tasks, appointments, habits, and notifications.
- Define expected traffic and latency/error targets, then run a representative load test. Do not infer supported user counts from source structure alone.

Reference: [Laravel production deployment guidance](https://laravel.com/framework/docs/deployment).

## P3 — Focused maintainability cleanup

- Review repeated notification dispatch/after-commit logic in `app/Services/Notification/NotificationService.php`; consolidate only where behavior is truly shared.
- Address actionable frontend lint feedback, particularly effect-driven state updates that cause unnecessary renders.
- Keep refactors separate from security fixes so each change is easy to review and validate.

## Implementation rules and completion checklist

Follow `AGENTS.md` and any applicable `.ai/rules` files if added. `.ai/rules` did not exist during this review. Read the required testing guidance before writing tests; use existing factories and test conventions. Do not change dependencies without approval.

- [ ] Clean installation and release checks pass with recorded evidence.
- [ ] Public health responses no longer disclose diagnostic details.
- [ ] Challenge concurrency is addressed and verified with meaningful tests.
- [ ] Habit history loading is bounded and regression-tested.
- [ ] Task summary optimization is measured and applied if justified.
- [ ] MySQL-specific constraint and concurrency checks execute successfully.
- [ ] Operational configuration and recovery evidence are recorded for the target environment.
- [ ] Run affected tests after behavior changes; run `vendor/bin/pint --dirty --format agent` after modifying PHP.
- [ ] Reassess readiness using the resulting evidence rather than treating the scores above as permanent.
