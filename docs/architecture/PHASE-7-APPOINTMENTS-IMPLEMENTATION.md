# Phase 7 — Appointments & Scheduling Implementation

**Implementation status:** Code and SQLite feature coverage implemented; incremental migration applied only to isolated MySQL test database. The active `hirgal_backend` database was not modified.  
**Original baseline:** `396314f` on `main`, tracking `origin/main`.  
**Initial worktree:** two pre-existing untracked documents (`PHASE_7_TECHNICAL_AUDIT.md` and `docs/architecture/PHASE-7-APPOINTMENTS-ARCHITECTURE.md`); no tracked diffs.

## Architecture and files

The implementation follows the existing Actions → Services → Controllers flow. `AppointmentService` scopes read queries and coordinates mutations; discrete actions own transactional create, update, cancellation, RSVP, and participant changes. Form Requests validate inputs, `AppointmentPolicy` handles resource/context access, and API Resources sanitize output. Public routes use `/api/v1` and appointment UUIDs. No package or new application layer was introduced.

The additive migration `2026_11_07_000001_extend_appointments_for_context_timezone_and_cancellation.php` adds project/team nullable FKs, UTC-default IANA timezone, cancellation actor/time, context indexes, and participant removal/response-history fields. MySQL 8 enforces project XOR team via CHECK; application validation enforces the same invariant on SQLite. Project/team hard deletion is restricted by appointment FKs. Soft-deleted context resources are out of scope. Removed participants retain status, response time, actor/time of removal, and prior response history on reinvitation.

No historical appointment values were shifted. The existing naive DATETIME values are assigned the `UTC` timezone default. This is based on the UTC application configuration and the seed implementation’s use of `now()`; legacy rows did not store their own timezone or context. Existing contextless rows therefore remain personal (both context IDs null), the narrowest access choice. If a deployment’s old values were authored in local time, that deployment must review its data before applying the migration.

## Time, conflicts, and lifecycle

Writes accept RFC3339 seconds with an explicit offset or `Z`, plus an IANA timezone. Offset/timezone consistency and end-after-start are validated; explicit offsets disambiguate DST folds and reject nonexistent local times. UTC is stored, UTC `Z` timestamps are returned, and timezone-only edits preserve the instant.

Half-open overlap detection reports warnings for organizer commitments and accepted/tentative attendee commitments. Pending, declined, removed, cancelled, and soft-deleted existing events do not block. The API never rejects solely for a conflict. Create, update, RSVP, and participant addition check inside transactions and lock affected user rows in ascending ID order. Since warnings do not enforce exclusivity, they describe the transaction snapshot and may become stale after concurrent writes; multi-process MySQL concurrency was not verified.

Lifecycle is scheduled → confirmed/completed or confirmed → completed; completion is allowed only after the end time. Cancellation is a separate terminal transition with `cancelled_at` and `cancelled_by`; soft deletion is distinct and keeps historical cancellation records intact. Reopening terminal events is rejected.

## Authorization matrix

| Context | View | Create | Update/cancel | Invite |
|---|---|---|---|---|
| Project | Project owner and project members with `appointments.view` | Project owner/lead with `appointments.create` | Organizer or project owner/lead with `appointments.update` | Active project members |
| Team | Team leader and roster with `appointments.view` | Team leader with `appointments.create` | Organizer or team roster leader with `appointments.update` | Active team roster members |
| Personal | Organizer and active, non-removed invitees | User with `appointments.create` | Organizer with `appointments.update` | Any active user |
| System Admin support | Separate read-only audited endpoint only | No blanket cross-context create authority | No blanket cross-context mutation authority | No blanket access |

Team appointment access deliberately does not inherit shared-project visibility or project-lead management from `TeamPolicy`; this avoids making team context reveal or inherit every allocated project boundary. A future product change may refine this rule. Ordinary System Admin list/detail queries remain scoped like any other actor. `appointments.admin.view` is assigned by the System Admin role seeder and explicitly excluded from Project Manager’s module-wide appointment grant. The admin POST view endpoint requires a reason and appends an immutable `ActivityLog` with actor, target, context, action, timestamp, IP, and user agent.

## API and notifications

Implemented endpoints: list, calendar, create, show, update/reschedule, cancel, soft-delete, participant list/invite/remove, RSVP, and audited admin view. Calendar ranges are required and capped at 90 days; regular lists are paginated (max 100 per page). Context filters support project, team, and personal. Details are documented in [`docs/api/APPOINTMENTS.md`](../api/APPOINTMENTS.md).

The `AppointmentNotification` uses Laravel queued notification delivery over mail and database channels after commit. Events include invitation, update, cancellation, and RSVP received. Existing `email` and `in_app` profile preferences are respected. Queue failure does not roll back the appointment. No recurrence, reminders, provider integration, or calendar sync were added.

## Migration and rollback

The application connection reported MySQL 8.0.46 and database `hirgal_backend`, which contained existing project data and one appointment. No migration/seed/test cleanup ran against it. The dedicated `mysql_test` connection targets `hirgal_backend_test`; it already contained three user rows, so the MySQL constraint test was revised to create and remove only its own uniquely identified fixtures. The migration was applied to that test database only, and the appointment context CHECK was verified there.

The migration is additive and introduces UTC default for old records; it does not rewrite start/end values. Rollback refuses if appointment context/timezone/cancellation or participant removal/history metadata has been used, preventing silent loss. Otherwise the schema columns/indexes/FKs can be removed. No rollback was executed.

## Tests and verification

PHPUnit was used because it is the repository’s configured framework. Added appointment API coverage includes context creation/eligibility, UTC conversion, overlap warnings that do not reject, privacy/404 behavior, System Admin audited read, RSVP ownership, reinvitation history, notification preference channels, bounded calendar, offset mismatch, and DST fold/gap behavior. The MySQL-only database test now also verifies the XOR CHECK and no longer deletes pre-existing rows.

Verified commands and results are recorded in the final implementation report. PHPStan is not installed as `vendor/bin/phpstan` and no repository PHPStan command is configured. Multi-process lock-contention behavior remains unverified. Production migration remains pending operator authorization and environment confirmation.

## Deviations and limitations

- Team-scoped access is limited to leader/roster and does not inherit shared-project access; the existing TeamPolicy grants broader visibility for general team discovery, but that is intentionally not reused for private appointments.
- No notification-specific preferences exist; the implementation honors current generic `email`/`in_app` settings.
- Administration is read-only in Phase 7; there is no administrative mutation endpoint.
- A System Admin permission grant needs `PermissionSeeder` and `RolePermissionSeeder` run on the intended database before the support view is usable.
- Context migration of historical contextless appointments defaults to personal because no source context exists.
- MySQL conflict concurrency under multiple PHP processes is not claimed as verified; warning data can become stale after transaction completion.

## Future improvements

- Add dedicated appointment notification preferences in user profiles (e.g. allowing users to opt in/out of RSVP receipts specifically).
- Support external calendar provider synchronization (Google Calendar / Outlook Calendar feeds / iCal export) once approved in subsequent roadmap phases.
- Add recurring appointments support with recurrence rule validation (RRULE) and exception management.
- Provide automated conflict-resolution suggestions (suggesting nearest open slot across all attendee schedules).
- High-concurrency slot reservations with dedicated distributed locking if booking contention metrics warrant hard-blocking reservation flows.
