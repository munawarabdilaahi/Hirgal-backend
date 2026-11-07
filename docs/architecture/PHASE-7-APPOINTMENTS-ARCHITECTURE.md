# Phase 7 — Appointments & Scheduling Architecture Blueprint

**Status:** Planning recommendation; implementation not authorized by this document  
**Repository baseline inspected:** `396314fc1c56d1878630c749004324f2cf61d886` (2026-11-07)  
**Scope:** Backend appointment scheduling API, its data model, authorization, lifecycle, and verification plan.

> This document records verified current state separately from recommendations and unresolved product decisions. Recommendations that change scope or policy require product-owner approval before implementation. No source, schema, dependency, or database changes are included.

## 1. Executive summary

**Readiness: READY WITH CONDITIONS.** The database foundation is present: appointments and participant records have models, enums, factories, migrations, and basic relationship/schema tests. No appointment HTTP endpoints, policies, services, actions, request validation, API resources, or feature tests exist. The current schema also lacks a scheduling context, an IANA timezone, and cancellation metadata. Existing documentation describes project-scoped appointment authorization, but the actual appointment table has no project or team foreign key.

Before implementation, the product owner should approve the appointment context (project, team, personal, or a selected combination), authorization for each context, conflict behavior, and lifecycle semantics. The recommended direction is a single-context appointment (project OR team OR personal), UTC instants plus a persisted IANA timezone, explicit cancellation, and conflict checks for organizer and accepted/tentative participants. This direction is concrete enough to implement after approval, but it is not a record of decisions already made.

## 2. Evidence and current implementation inventory

### Verified as implemented

- `database/migrations/2026_11_01_000007_create_appointments_and_participants_tables.php` creates `appointments` and `appointment_participants`.
- `App\Models\Appointment` has UUID generation, soft deletes, enum casts for status and location type, date/time casts, organizer, participant-record and participant relationships.
- `App\Models\AppointmentParticipant` relates an appointment and user and casts participant status.
- `AppointmentStatus`, `AppointmentLocationType`, and `ParticipantStatus` define the current enum vocabularies.
- Factories exist for appointments and appointment participants. The development seeder creates appointment-domain sample data.
- Global permission slugs `appointments.view`, `appointments.create`, `appointments.update`, and `appointments.delete` are seeded and assigned by role. System Admin and Project Manager receive all four; Team Leader receives view/create/update; Member receives view only.
- The application timezone is UTC. Existing API response conventions are centralized in `App\Support\ApiResponse`.
- Basic database tests cover appointment relationships, UUID and enum casting, and schema inventory.

### Verified as not implemented

`php artisan route:list --path=appointments --except-vendor` returns no appointment routes. There are no appointment-specific controllers, actions, services, policies, Form Requests, API Resources, or HTTP feature tests. Existing endpoint names and payloads proposed below are therefore recommendations, not live contracts.

### Partially implemented / documentation mismatch

Database models and permissions are a foundation only. `docs/database/SECURITY.md` describes project roles governing appointments “inside that project,” but no appointment project/team association exists in the migration or model. This is a documented intended rule, not enforceable current behavior. No tenant boundary currently exists for appointment rows.

## 3. Database schema assessment

### Existing schema

`appointments` currently stores: auto-increment internal ID; unique UUID; organizer user FK with RESTRICT deletion; title; nullable description; timezone-naive `start_time` and `end_time` DATETIME columns; location type; nullable meeting link and address; status; timestamps; and nullable `deleted_at`. Indexes cover start/end/status, organizer/status/start/end, and status/time-oriented queries. The start/end fields have no timezone or offset, so their intended wall-clock zone cannot be recovered reliably from the stored value alone.

`appointment_participants` stores appointment and user FKs with cascade deletion, participant status, nullable notes and `responded_at`, and timestamps. It has a unique appointment/user pair plus status and user/status/appointment indexes. There is no participant soft delete, invitation actor, removal metadata, or event history. Cascading user deletion erases participant rows; appointment deletion cascades them as well.

### Recommended schema direction — requires approval

Adopt exactly one context per appointment: project, team, or personal. Add nullable `project_id` and `team_id` foreign keys, with both null representing personal scope; disallow both being non-null. Prefer restrictive deletion behavior for project/team references so an appointment cannot silently lose its scope. Add indexes supporting context + time + status queries. Add a required IANA `timezone` (for example `Africa/Nairobi`) as the scheduling/display zone snapshot. Keep `start_time` and `end_time` as UTC instants in DATETIME columns to match existing migration conventions; define and test the UTC invariant in model/service conversion. Do not use a user’s current profile timezone to reinterpret an existing appointment.

Add `cancelled_at` and nullable `cancelled_by` (FK to users, SET NULL) to preserve cancellation audit context. A cancellation reason is optional and needs a product decision. Do not use soft deletion to mean cancellation. Keep the existing soft-delete field for authorized removal/retention workflows. If participants can be removed while preserving RSVP history, add removal metadata or a dedicated participant status; otherwise participant deletion can remain hard delete with the decision documented.

The mutual-exclusion check may use a database CHECK constraint only after confirming the supported MySQL version enforces it; application validation remains required. Validate FK delete behavior against actual retention needs. A backfill must not guess historical timezones: confirm the legacy data’s meaning before assigning UTC or another zone. If existing records are only seed/test records, a documented safe default may be sufficient; inspect actual environment data before planning a production migration.

### Constraints and index considerations

The unique UUID and participant pair are valuable invariants. Existing time indexes do not prevent overlapping appointments. No ordinary B-tree index or SQLite test provides a portable exclusion constraint for arbitrary interval overlap. Query plans should be checked after defining context filters and conflict semantics. Keep foreign-key behavior consistent with soft deletion: soft-deleting a project/team does not fire FK actions, so API scope checks must explicitly reject or hide appointments in deleted contexts.

## 4. Scheduling semantics and product decisions

### Timezone and time input

Recommendation: accept ISO 8601/RFC 3339 timestamps with an explicit UTC offset plus an IANA zone identifier. Validate that the submitted offset corresponds to the supplied zone at that local date/time, convert the instant to UTC for storage, and retain the IANA zone on the appointment for display and future local-time operations. Return timestamps in a consistent RFC 3339 UTC representation and include the zone identifier separately. The client must not submit an ambiguous timezone-naive local date/time.

Reject `end_time <= start_time`. Daylight-saving transitions require explicit handling: reject nonexistent local wall times; require an explicit offset/fold choice for ambiguous wall times and verify it against the zone database. Although Africa/Nairobi does not currently use seasonal DST, the API must support users and appointments in other IANA zones. The organizer’s profile timezone may be a default at creation, but must not become a silent mutable dependency. Confirm whether changing an appointment’s zone preserves the instant or preserves the local wall time; recommendation is preserve the instant unless the user explicitly edits the local time.

### Context and tenant boundaries — approval required

The project context describes project/team collaboration, but the product brief’s precise scope must decide which appointments are supported. Recommended shape is mutually exclusive project, team, or personal scope. Project appointments are visible only to project members and manageable by project owner/lead subject to global permission. Team appointments are visible to the team roster/leader; for a team allocated across projects, team context must not imply access to project-private data. Personal appointments are visible to organizer and invitees only. A personal invite to an arbitrary active user is a product decision; recommended default is require shared project/team membership or an explicit allowed personal invite policy.

Alternative: ship project-scoped appointments only for the first increment, because this most closely matches the existing documentation and reuses proven project membership boundaries. Do not create a polymorphic `context_type/context_id` unless cross-domain extensibility is an explicit requirement; it weakens FK integrity and complicates authorization/querying. Decide how a team appointment’s access behaves when roster membership or project allocation changes, and what happens when a project/team is soft-deleted.

### Overlap and conflict policy — approval required

Use half-open intervals `[start, end)`: two appointments overlap when `existing.start_time < candidate.end_time AND existing.end_time > candidate.start_time`; adjacent appointments are allowed. Recommended conflict participants are the organizer and invitees whose status is accepted or tentative. Pending invitations and declined participants do not block. Cancelled and soft-deleted appointments are excluded. Scope conflict checks to the same user across relevant contexts so an individual cannot be double-booked by unrelated projects.

Choose warning versus hard rejection. Recommendation: hard reject an overlap for organizer and accepted/tentative participant, returning `409 APPOINTMENT_CONFLICT` with a sanitized conflict summary only when the caller is authorized to see it; alternatively return no identifying details. This may make inviting an already-booked participant fail. If product prefers non-blocking scheduling, return a warning/conflict flag and do not leak the other appointment’s title or context. Define whether organizers may override conflicts and how overrides are audited.

Conflict checks must be race-safe. Perform all relevant checks and writes in one transaction. On MySQL, lock the affected user rows in deterministic ascending ID order before checking overlaps, and require every create/reschedule/RSVP path that can introduce a blocking participant to follow that protocol. Retry deadlocks within a bounded policy if consistent with project conventions. Row locking must be verified with multi-connection MySQL tests; SQLite in-memory feature tests do not establish concurrency safety. If the product requires hard exclusion under high contention, consider a dedicated slot/lock model or another explicit serialization strategy after measuring expected load.

## 5. Lifecycle and participant behavior

Current `AppointmentStatus` and `ParticipantStatus` enum members must be confirmed from code before implementation; do not silently rename stored values. Recommended lifecycle is `scheduled` at creation, optionally `confirmed` through an explicit transition, then `completed` or `cancelled`. Completion and cancellation are terminal. A reschedule updates the same appointment UUID and is allowed only before terminal state; it re-runs authorization and conflict checks. Cancellation preserves the record and participant responses, stamps cancellation actor/time, and excludes the item from upcoming and conflict queries. Soft delete remains a separate privileged removal/retention operation.

| Current state | Requested transition | Recommendation |
|---|---|---|
| New | Create | Start as scheduled |
| Scheduled | Confirm | Allow if confirmation is part of the approved product flow |
| Confirmed | Reschedule | Allow before start, revalidate conflicts |
| Scheduled / confirmed | Cancel | Allow authorized organizer/context manager; record actor/time |
| Scheduled / confirmed | Complete | Allow when business rules permit; define whether completion is time-gated |
| Completed / cancelled | Any reopen or reschedule | Reject; create a new appointment if needed |

Only the invited participant may change their own RSVP. Recommended RSVP values are pending, accepted, declined, and tentative; pending means no response and has null `responded_at`. RSVP updates are idempotent and stamp `responded_at`; accepted/tentative changes run conflict checks if those states block scheduling. Do not let an organizer impersonate a participant’s response. Adding a participant should validate active account and approved context eligibility, prevent duplicates, and preserve an existing response unless an explicit reinvitation/reset flow is approved. Decide whether removed invitees’ history is retained and whether invitation can be resent after decline.

## 6. API contract proposal (not implemented)

All routes should use `/api/v1`, `Accept: application/json`, Sanctum authentication, UUID-bound appointment identifiers, `ApiResponse`, Form Requests, and API Resources. The endpoint names below are proposals.

| Method and path | Purpose | Primary authorization |
|---|---|---|
| GET `/appointments` | Paginated list with date range, context, status, and organizer/participant filters | `appointments.view` plus explicit row scope |
| GET `/appointments/calendar` | Bounded calendar range query | Same scope; enforce maximum range |
| POST `/appointments` | Create and invite initial participants | `appointments.create` plus context authority |
| GET `/appointments/{appointment:uuid}` | Detail | `appointments.view` plus row scope |
| PUT `/appointments/{appointment:uuid}` | Update/reschedule | `appointments.update` plus organizer/context authority |
| POST `/appointments/{appointment:uuid}/cancel` | Explicit cancellation transition | `appointments.update` plus cancellation authority |
| GET `/appointments/{appointment:uuid}/participants` | Paginated participant list | Appointment view scope |
| POST `/appointments/{appointment:uuid}/participants` | Add eligible invitees | `appointments.update` plus context authority |
| PUT `/appointments/{appointment:uuid}/response` | Authenticated user updates own RSVP | Must match authenticated user’s participant row |
| DELETE `/appointments/{appointment:uuid}/participants/{user}` | Remove invitee | `appointments.update`; organizer/context authority, with retention policy |

Filter semantics: `from` inclusive and `to` exclusive UTC instants; require `to > from` and cap query window/page size. Return stable pagination and no unbounded calendar query. Validate context IDs and membership server-side. Use UUID in public appointment routes; never treat unguessability as authorization. Responses should expose only approved participant fields, omit internal scheduling metadata unless required, and distinguish cancelled from soft-deleted items. Define whether conflict errors contain opaque IDs or no details.

## 7. Authorization and security assessment

Existing global grants are insufficient to define resource access. Follow the established two-tier pattern: global permission AND contextual authority, with explicit query scoping before policy checks. Out-of-scope resources should follow the project convention of `404` to avoid disclosing existence. System Admin’s Gate bypass must not accidentally bypass tenant visibility in list/detail queries; any administrative cross-context access requires an explicit product decision and must be tested.

| Operation | Global permission | Context requirement (recommendation) |
|---|---|---|
| List/read | `appointments.view` | Organizer, participant, or authorized context member; context-scoped query |
| Create | `appointments.create` | Project owner/lead; team leader/approved manager; personal rule to approve |
| Update/reschedule | `appointments.update` | Organizer or context manager; participant cannot edit event |
| Cancel | `appointments.update` | Organizer or context manager; separate transition action |
| Manage invitees | `appointments.update` | Organizer/context manager; eligible active users only |
| RSVP | `appointments.view` or a dedicated participant response rule | Authenticated matching invitee only; no organizer impersonation |
| Delete/soft-delete | `appointments.delete` | Explicit retention/admin policy; distinct from cancellation |

The current Member role has view only; Team Leader has view/create/update; Project Manager and System Admin have all four appointment permissions. Confirm that these broad global grants align with resource-scoped rules. Do not grant access to every appointment merely because the user has a global role. Inactive/suspended users must be rejected by existing active-account middleware. Validate all request fields with allowlists; derive organizer, actor, responded user, and tenant membership from authenticated server state. Treat meeting links as potentially sensitive and avoid returning them to unauthorized directory/list callers. Apply rate limits to invitation/RSVP operations and avoid leaking conflict appointment details.

## 8. Architecture fit and implementation components

Use existing Actions → Services → Controllers architecture:

1. Form Requests validate timestamps, timezone and context invariants and authorize request-level capability.
2. Thin versioned API controllers dispatch to services/actions and return `ApiResponse` resources.
3. `AppointmentService` owns scoped listing/calendar reads; a scheduling conflict service centralizes interval and lock logic.
4. Single-purpose transactional actions create, update/reschedule, cancel, add/remove participants, and record RSVP. Actions own atomic state mutation; avoid duplicated conflict checks in controllers.
5. `AppointmentPolicy` (and participant policy only if it clarifies responsibilities) combines global permission and contextual rules. Explicitly guard against broad Gate bypass leaking scope.
6. `AppointmentResource` and participant resource serialize a documented allowlist. Do not add queries or mutations to resources.
7. Dispatch invitation, reschedule/cancel, and RSVP notifications only after commit. Use queued notifications if queue conventions are established; avoid external calendar sync in this phase.

Reuse UUID route binding and query scoping patterns from Projects/Teams/Tasks. Keep participant RSVP separate from administrative participant management to prevent impersonation. Every mutation that changes the blocking attendee set or interval must share one transaction/locking strategy.

## 9. Notifications and future scope

Recommended Phase 7 notification scope is email invitation, material reschedule, cancellation, and RSVP-to-organizer notices, dispatched after commit. Decide whether mail delivery is synchronous or queued and how retries/idempotency avoid duplicate notices. In-app notification inbox integration belongs with Phase 9 unless separately approved. Recurrence, reminders, video provider provisioning, Google/Outlook sync, external calendar feeds, and conferencing lifecycle are not present in this database/API foundation and should remain deferred unless the Phase 7 product brief explicitly includes them.

## 10. Missing functionality and risks

- **Not implemented:** appointment API surface and every associated application layer/test suite.
- **Partially implemented:** storage primitives and model relationships; no timezone invariant or scope boundary.
- **Requires product decision:** appointment context model; who can view/manage each context; RSVP eligibility; hard/soft conflict behavior and overrides; status transition rules; cancellation and participant history; notification scope; timezone edit semantics; deleted-context behavior; personal invitation policy.
- **Risk:** naive DATETIME values can be misread as local time; migrating existing rows without source-zone knowledge can shift appointments.
- **Risk:** race conditions allow double booking if conflict validation is not serialized across all write paths.
- **Risk:** Gate::before System Admin bypass plus overly broad list queries can disclose cross-project events.
- **Risk:** team membership changes and multi-project team allocation make “team appointment” scope ambiguous.
- **Risk:** cascades erase participant history when users/appointments are hard deleted; soft deletion alone does not enforce parent visibility.
- **Risk:** current docs imply a project context that does not exist in schema; align docs after decisions and implementation.

## 11. Required automated tests and acceptance criteria

Before acceptance, add tests that prove:

- Schema FKs, uniqueness, nullability, timezone/context invariant, delete behavior, indexes/migration rollback; run database-specific checks on supported MySQL as well as SQLite where useful.
- Model casts, UUID behavior, organizer and participant relationships, soft-delete behavior, and context relations.
- Login requirement, inactive-account rejection, permission denial, out-of-scope `404`, no cross-project/team/personal disclosure, and System Admin bypass boundaries.
- Create/read/list/calendar pagination and range filters; validation of missing offsets, invalid zone, offset-zone mismatch, nonexistent/ambiguous DST local times, and end not after start.
- Exact interval overlap, containment, same start, same end, adjacency, cancelled/deleted exclusion, pending/declined versus accepted/tentative behavior, organizer conflicts, reschedule conflicts, and sanitized conflict responses.
- MySQL concurrent create/reschedule/RSVP contention with separate connections/processes proving the chosen serialization; SQLite-only success is insufficient for this claim.
- Every allowed and forbidden lifecycle transition; cancellation metadata and visibility; terminal-state immutability.
- Invite authorization and eligibility, duplicate idempotency, RSVP self-only, response timestamp, no response reset on unrelated update, participant removal/reinvitation policy.
- Notification payload privacy, post-commit dispatch, and no dispatch after rolled-back mutation.
- Standard response envelope, ISO 8601 output, UUID-only binding, rate limiting, and no accidental exposure of internal IDs/sensitive fields.

Acceptance requires approved decisions recorded, migration/backfill plan reviewed, all role/context combinations tested, full endpoint contracts documented, concurrency behavior demonstrated on MySQL, targeted and full test suites passing, and Pint passing for PHP changes. Do not claim full conflict safety based solely on unit tests or SQLite.

## 12. Recommended implementation sequence

1. Resolve and record the approval-required product decisions below; reconcile security/database docs with the chosen scope.
2. Confirm runtime MySQL behavior/version and inspect any non-test appointment data before designing backfill or FK constraints.
3. Finalize schema change and reversible migration/backfill plan, including UTC interpretation, context, timezone, cancellation, and retention.
4. Add model relationships/casts/factory states and schema/model tests.
5. Implement scoped authorization and query services before exposing endpoints; test role and tenant boundaries.
6. Implement UTC/timezone normalization and centralized overlap/locking service with MySQL concurrency verification.
7. Implement transactional Actions and Form Requests for creation, update, cancellation, participants, and RSVP.
8. Add controllers, UUID routes, resources, pagination, standard errors, and rate limits.
9. Add post-commit notifications only within approved scope; test privacy and rollback behavior.
10. Run targeted tests, MySQL integration/concurrency checks, full suite, Pint, route/API review, and update `PROJECT_CONTEXT.md` and API/database docs after implementation approval.

## 13. Product-owner decisions required before implementation

1. Which contexts are in scope: project only, project and team, personal, or all three?
2. If mixed contexts are approved, is exactly one context allowed per appointment (recommended), and can personal appointments invite arbitrary active users?
3. Which users can read an appointment, and do global Project Manager/System Admin grants cross context boundaries?
4. How does team appointment access behave when the roster changes or a team is allocated to multiple projects?
5. Are conflicts hard failures or warnings; which statuses block; can an organizer override; may invitees have a conflicting tentative RSVP?
6. Confirm schedule input/output contract and timezone-change semantics; recommendation is explicit offset + IANA zone, UTC storage, preserve instant on zone-only change.
7. Confirm lifecycle states, who can confirm/complete, whether completion is time-gated, and terminal-state behavior.
8. Is cancellation a reversible status transition or permanent terminal cancellation? Recommendation: terminal, retain history, explicit cancellation endpoint.
9. Can managers remove invitees, and should participant history be retained? Can declined users be reinvited without losing prior response?
10. Which roles may soft-delete or permanently delete; what retention/deletion rules apply to participant records?
11. Should cancelled and past appointments appear in ordinary list/calendar responses by default?
12. Which email notifications are required in Phase 7, and should in-app notifications remain deferred to Phase 9?
13. What is the authoritative timezone meaning of any existing appointment rows that must be migrated?

## Readiness decision

**READY WITH CONDITIONS.** The existing database foundation and architectural conventions are suitable starting points. API implementation should begin only after the context, scope/authorization, timezone, conflict, lifecycle, and retention decisions are recorded. In particular, project-scoped access is currently described in documentation but is not represented by the actual schema. This blueprint proposes a safe and testable direction while leaving that decision with the product owner.
