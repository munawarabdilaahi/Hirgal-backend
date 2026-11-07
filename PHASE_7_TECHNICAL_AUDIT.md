# Phase 7 Technical Audit — Appointments & Scheduling API

**Audit date:** 2026-11-07 (Africa/Nairobi)  
**Repository:** `C:\Hirgal`  
**Audit baseline:** `main`, commit `396314fc1c56d1878630c749004324f2cf61d886` (`396314f`), equal to `origin/main`; working tree clean before this report.  
**Scope:** Read-only audit of the Phase 7 appointment and scheduling foundations. No source code, database schema, or database records were changed. This report is the only new file.

## 1. Executive summary

The repository contains appointment database foundations, Eloquent models and relationships, three enums, factories, seed data, and limited relationship/enum/UUID test coverage. It contains **no appointment API routes or implementation layers**: no appointment policies, requests, controllers, services, actions, or API resources were found. `php artisan route:list --path=appointments --except-vendor` returned no matching routes.

The existing schema is a reasonable starting point for one-off appointments and participant RSVP records. It has a UUID, organizer foreign key, start/end `DATETIME`s, status/location fields, soft deletion, unique attendee membership, and several lookup indexes. It does not connect appointments to projects or teams, record an appointment timezone, enforce `end_time > start_time`, or enforce scheduling conflict rules. Existing indexes can assist candidate conflict queries but do not prevent overlaps or establish correctness under concurrent writes.

Global appointment permissions are already seeded and assigned to roles. Those permissions do not define resource-level visibility, contextual project membership, attendee access, organizer powers, or cancellation semantics. In particular, the schema's absence of a project/tenant foreign key conflicts with a database security document statement that contextual project roles govern appointments “inside that project.” That statement is not supported by the current appointment schema or model.

**Readiness assessment: READY WITH CONDITIONS.** The domain foundation is present, but implementation should not begin until the project/tenant scope, timezone contract, conflict policy, lifecycle semantics, and participant-management authority are decided. Those decisions affect the API, authorization model, and potentially schema changes.

Finding labels used below:

- **Already implemented and verified** — present in inspected source or tests.
- **Partially implemented** — a foundation exists, but the behavior is absent or incomplete.
- **Not implemented** — no supporting implementation was found.
- **Requires a product decision** — code cannot safely choose the intended policy.

## 2. Existing implementation inventory

| Area | Finding | Evidence |
| --- | --- | --- |
| Database schema | **Already implemented and verified** | `database/migrations/2026_11_01_000007_create_appointments_and_participants_tables.php` creates `appointments` and `appointment_participants`. |
| Appointment model | **Already implemented and verified** | `app/Models/Appointment.php`; UUID generation, `SoftDeletes`, enum/datetime casts, organizer and participant relationships. |
| Participant model | **Already implemented and verified** | `app/Models/AppointmentParticipant.php`; RSVP enum cast and belongs-to relationships. |
| User relationships | **Already implemented and verified** | `organizedAppointments`, `attendingAppointments`, and `appointmentParticipations` in `app/Models/User.php`. |
| Enums | **Already implemented and verified** | `AppointmentStatus`, `AppointmentLocationType`, and `ParticipantStatus` in `app/Enums/`. |
| Factories | **Already implemented and verified** | `database/factories/AppointmentFactory.php` and `AppointmentParticipantFactory.php`; appointment factory offers `withParticipants()`. |
| Development seed | **Already implemented and verified** | `database/seeders/DevelopmentProjectSeeder.php` seeds one confirmed appointment and accepted participant rows, guarded by the existing development-seeder flow. |
| Global permissions | **Already implemented and verified** | `appointments.view/create/update/delete` in `PermissionSeeder`; role assignments in `RolePermissionSeeder`. |
| API routes and layers | **Not implemented** | No appointment route or appointment-named action, service, controller, form request, policy, or API resource exists. Route-list check returned no matches. |
| API behavior/tests | **Not implemented** | No appointment API feature tests or unit tests exist. Current tests cover model relationships, UUID generation, enum casts, and table presence only. |

The development seed uses the team leader as organizer, sets a virtual meeting link and confirmed status, and adds the project manager and member as accepted participants. This demonstrates example data only; it does not define production scheduling behavior or scope.

## 3. Database schema assessment

### 3.1 `appointments`

The migration defines:

- Auto-incrementing internal `id` and unique `CHAR(36)` `uuid`.
- Required `organizer_id` foreign key to `users.id`, with `ON DELETE RESTRICT`.
- Required `title` (`VARCHAR(255)`), nullable `description`.
- Required `start_time` and `end_time` as SQL `DATETIME`.
- `location_type` defaulting to `virtual`; nullable `meeting_link` and `location_address`.
- `status` defaulting to `scheduled`.
- Laravel timestamps and `deleted_at` soft-delete column.
- Indexes on each time field, status, organizer/status/start/end, and start/end/status.

`Appointment` generates a UUID on model create if absent and casts the two times to Laravel datetimes, `status` to `AppointmentStatus`, and `location_type` to `AppointmentLocationType`. It uses `SoftDeletes`.

### 3.2 `appointment_participants`

The migration defines:

- Internal `id`.
- Required `appointment_id` foreign key with `ON DELETE CASCADE`.
- Required `user_id` foreign key with `ON DELETE CASCADE`.
- RSVP `status` defaulting to `pending`, nullable response notes and `responded_at`, and timestamps.
- Unique `(appointment_id, user_id)` constraint (`appt_user_unique`).
- Indexes on status and `(user_id, status, appointment_id)`.

`AppointmentParticipant` has no soft-delete behavior. Its `status` is enum-cast, and `responded_at` is datetime-cast. `Appointment::participants()` and `User::attendingAppointments()` expose a many-to-many relationship with pivot fields; `participantRecords()` and `appointmentParticipations()` expose the explicit rows.

### 3.3 Constraints, indexes, and deletion behavior

**Already implemented and verified:** UUID uniqueness, organizer and participant foreign keys, participant uniqueness, ordinary lookup indexes, and appointment soft deletion are present in the migration. Participant rows are retained when an appointment is soft-deleted because soft deletion does not issue a physical parent delete. Physical appointment deletion cascades participant rows; hard deletion of an organizer is restricted while appointment rows reference them. User deletion cascades participant rows at the FK level, but the `User` model itself also uses soft deletes.

**Not implemented:** There is no database check constraint enforcing `end_time > start_time`; no foreign key/check tying attendees to a common project or tenant; no uniqueness or exclusion mechanism for overlapping times; and no explicit index containing `deleted_at` for active-only appointment range queries. Indexes are query aids, not conflict enforcement. The composite organizer index is a possible input to an organizer conflict query, but correctness, index use, participant conflict performance, and concurrent-write safety have not been demonstrated.

The schema documentation labels overlap/timeline indexes by intended use. That is design intent only; no conflict query or scheduling behavior currently exists.

### 3.4 Timezone and temporal representation

**Partially implemented:** The user schema has a timezone string, and appointment start/end are stored as timezone-naive `DATETIME` values. The appointment has no timezone column, UTC offset, original local-time representation, or recurrence/timezone rule. The model casts values to datetimes but does not state or enforce an API timezone contract.

**Requires a product/technical decision:** Define whether API input/output is UTC ISO-8601, local wall time plus an IANA zone, or another contract; specify how the organizer's timezone and participant display timezones interact; and define behavior for daylight-saving gaps/overlaps if local wall times are accepted. User timezone alone cannot reconstruct the timezone intended when the appointment was scheduled, especially after profile changes.

## 4. API and architecture assessment

**Not implemented:** No appointment route is registered. No index/list, show, create, update, cancel/delete, participant add/remove, RSVP, or calendar-range API exists. No API resource, request validation, orchestration, mutation action, or query service exists. There is also no appointment API documentation under `docs/api/`.

The intended architecture in project context is Form Request → Controller → Service/Action → API Resource, with policy checks, explicit query scoping, and standardized `ApiResponse`. The database/model foundation is compatible with that architecture, but no appointment flow currently exercises it.

The current API standards use versioned `/api/v1` routes, Sanctum auth, JSON envelopes, request-level validation/authorization, policies, and explicit tenant scoping. Appointment implementation will need to follow these patterns rather than expose model serialization directly.

## 5. Authorization and security assessment

### 5.1 Existing permissions

`PermissionSeeder` defines:

- `appointments.view` — description says users can view own and invited appointments.
- `appointments.create` — schedule meetings and invite participants.
- `appointments.update` — modify times and links.
- `appointments.delete` — cancel appointments.

`RolePermissionSeeder` grants all appointment-module permissions to Project Managers; Team Leaders receive view/create/update; Members receive view; System Admin receives all seeded permissions. These are **global capability assignments**, not appointment-specific policies.

### 5.2 Missing authorization rules

**Not implemented:** There is no policy defining who can view an appointment, update or cancel it, manage participants, or respond to an RSVP. There is no request or query enforcing the “own and invited” view scope described in the permission seed. No distinction is implemented between organizer, attendee, project owner/lead, team leader, or global administrator.

### 5.3 Tenant/project boundary risk

The `appointments` table contains no `project_id`, `team_id`, organization/tenant id, or polymorphic contextual owner. The models have no Project or Team relationship. Existing project-scoped access rules cannot be applied directly to an appointment from its current row alone.

`docs/database/SECURITY-AND-ISOLATION.md` says contextual project/team roles govern appointments “inside that project,” but no project association exists in the appointment schema. Treat this as an **unverified/inconsistent documentation claim**, not an implemented access guarantee. A global System Admin bypass also exists for Gates, but it does not replace scoped resource queries or define participant privacy.

**Requires a product decision:** Decide whether appointments are personal/global among users, team-scoped, project-scoped, or support multiple contexts. Decide whether every participant must belong to the associated project/team and whether cross-project invitees are permitted. The choice may require schema changes and new membership validation.

### 5.4 Other security considerations for implementation

Before exposing endpoints, define UUID route binding plus explicit scope checks to prevent IDOR; response-field allowlists for meeting links and response notes; active/deleted account handling; whether a participant may see other invitees; whether RSVP notes are visible to organizers or all attendees; organizer-only mutations; authorization for self-RSVP; and safe behavior for soft-deleted/cancelled appointments. These behaviors are currently **not implemented**.

## 6. Scheduling behavior and missing functionality

| Requirement | Status | Audit finding |
| --- | --- | --- |
| Create appointment | **Not implemented** | No endpoint/request/action/service/resource. |
| List/calendar retrieval | **Not implemented** | No list route or range query; indexes suggest intended timeline reads only. |
| Retrieve one appointment | **Not implemented** | UUID exists, but no route binding or authorization. |
| Update appointment | **Not implemented** | No field validation, lifecycle restrictions, or change notifications. |
| Cancellation | **Partially implemented** | `cancelled` enum state and `appointments.delete` permission exist; no transition/action, cancellation metadata, or decision whether cancellation means status change versus soft delete. |
| Participant invitation/add/remove | **Partially implemented** | Participant schema, FK, unique constraint, relationships, factory, and seed rows exist. No endpoint or authorization. |
| RSVP response | **Partially implemented** | `pending/accepted/declined/tentative`, notes, and `responded_at` fields exist; no transition rules or API. |
| Date/time input validation | **Not implemented** | No rule for required format, ordering, past times, duration bounds, precision, or updates to already-started appointments. No DB check constraint. |
| Timezone handling | **Partially implemented** | User timezone exists; appointment uses timezone-naive `DATETIME` without an appointment timezone contract. |
| Organizer conflicts | **Not implemented** | Supporting index exists, but no overlap query or enforcement. |
| Participant conflicts | **Not implemented** | No attendee-overlap behavior. Current participant index does not include appointment times; range conflict requires joining appointment data. |
| Concurrent conflict protection | **Not implemented** | No transaction/locking/constraint strategy for two simultaneous bookings. An application pre-check alone can race. |
| Project/team/tenant boundary | **Not implemented** | Appointment has no contextual FK or relationship. |
| Recurrence, external calendar sync, notifications | **Not implemented** | No recurrence or external provider fields/logic, no appointment notification workflow. Treat scope as future work or a decision; do not infer these are Phase 7 requirements from the foundation alone. |

### Conflict semantics requiring a decision

If conflicts are to be rejected, specify which participants count (organizer only, accepted/tentative attendees, all invited attendees), which appointment states count (`scheduled`, `confirmed`, etc.), whether adjacent appointments where `existing.end_time == candidate.start_time` are allowed, how cancelled and soft-deleted appointments are excluded, and whether conflicts are warnings or hard failures. Define behavior for editing an appointment that creates a conflict and for simultaneous requests. The current schema and enums do not answer these questions.

## 7. Existing test coverage

**Already implemented and verified by source inspection:**

- `tests/Feature/Database/DatabaseSchemaMigrationTest.php` confirms the two table names exist and includes common critical-column assertions for users/projects/tasks/habits. It does not assert appointment columns, foreign keys, unique constraints, indexes, or soft-delete behavior.
- `tests/Feature/Database/ModelRelationshipsTest.php::test_appointment_and_participants_relationship` creates an appointment with three factory participants and checks participant count and organizer relation.
- The same file checks appointment UUID generation and `AppointmentStatus` casting.
- There are no test files for appointment API behavior; repository search found only the above appointment test references.

**Coverage missing:** schema-level appointment constraints and cascades; participant uniqueness; enum/location casts; `responded_at`; soft delete and physical-delete behavior; valid/invalid time intervals; timezone conversion/DST; overlap boundaries and concurrency; tenant/project membership; API envelopes and query filters; auth-required behavior; unauthorized 403 and out-of-scope 404; organizer/participant/admin capabilities; participant invitation/removal and RSVP transitions; cancellation/update lifecycle; and query-cache/range retrieval behavior if frontend/API consumers are added later.

No tests were run for this audit; test findings are from source inspection only.

## 8. Risks and decisions to resolve

1. **Scope/tenant association — Requires a product decision; high impact.** The model cannot determine contextual access without an association. Clarify personal, team, project, or multi-context appointments before designing policy or API.
2. **Timezone contract — Requires a product/technical decision; high impact.** Naive `DATETIME` plus mutable user timezone can cause shifted or ambiguous meeting times.
3. **Conflict semantics and concurrency — Requires a product decision; high impact.** Indexes do not prevent conflicts; participant conflict handling and atomicity need an explicit design.
4. **Cancellation vs deletion — Requires a product decision.** Enum has `cancelled`, model has soft delete, and permission text says “cancel”; no canonical lifecycle is set.
5. **Organizer and attendee authority — Requires a product decision.** Global permission descriptions do not specify whether attendees may edit, who can cancel, or whether organizer is always an attendee.
6. **Participant RSVP semantics — Requires a product decision.** Defaults and statuses exist, but response-note visibility, repeat responses, responded timestamp semantics, and status transition rules are undefined.
7. **Documentation inconsistency — Partially implemented/documentation issue.** Security documentation asserts appointments belong inside project boundaries without a schema link supporting that claim.
8. **Persistence/deletion consistency — Partially implemented.** Soft deletion hides parent appointments through Eloquent, while participant rows remain; physical deletion cascades them. User soft deletes, organizer `RESTRICT`, and participant `CASCADE` need lifecycle expectations documented.
9. **Scheduling index assumptions — Partially implemented.** Named “overlap” indexes are not enforcement and their benefit for range-overlap queries has not been verified. Participant conflict queries may need a different access path.

## 9. Recommended implementation sequence

This is a recommendation only; no implementation was started.

1. **Resolve product/API decisions:** contextual scope, invitee eligibility, role authority, organizer-as-attendee behavior, RSVP transitions, cancellation vs soft delete, conflict rules, timezone input/output, duration/past-time limits, recurrence and notification scope.
2. **Reconcile schema and documentation:** if project/team context or per-appointment timezone is required, design migrations and indexes before API work; correct the unsupported security documentation claim. Define delete behavior and whether appointment participants need audit/soft-delete history.
3. **Write the API contract:** list/range filters and pagination, UUID routes, request/response resources, error envelopes, date format, timezone semantics, and notification behavior. Add appointment API documentation.
4. **Implement authorization and scoped queries:** Appointment and participant policies; explicit list/detail scoping; 404 for out-of-scope resources; organizer, attendee, contextual role, and System Admin semantics. Validate every invitee against the chosen scope.
5. **Implement actions/services/requests/resources:** create, list, show, update, cancel, participant management, and RSVP as separate authorized operations. Use transactions for appointment plus participant changes. Make status transitions explicit and idempotent where appropriate.
6. **Implement time validation/conflict handling:** centralize interval rules; define overlap query semantics; handle updates excluding self; select a concurrency strategy if conflicts must be guaranteed rather than advisory; add/adjust indexes based on measured query plans.
7. **Add focused tests before acceptance:** database constraints and deletes; authorization and tenant boundaries; API contract/validation; timezone and DST; lifecycle and RSVP; overlap edge cases and concurrent writes; then run the complete PHPUnit suite and required formatting checks.

## 10. Required automated tests for Phase 7

At minimum, add feature tests for:

### API and authorization

- Authentication required for every appointment route; inactive accounts rejected.
- List returns only appointments visible under the chosen scope, with date-range/pagination/filter behavior.
- Organizer, participant, non-participant, contextual project/team roles, and System Admin permissions for view/update/cancel/invite/RSVP.
- Cross-scope UUIDs return 404 without disclosing records; same-scope insufficient ability returns the established 403 behavior.
- Validation errors and response envelopes; no unapproved/private fields (including participant notes or meeting links) leak.

### Scheduling and lifecycle

- Create/update accepts valid intervals and rejects equal/reversed intervals and invalid timestamps.
- Timezone conversion preserves the intended instant; DST ambiguous/nonexistent local times follow the chosen contract.
- Cancellation behavior, soft-delete behavior, idempotency, and forbidden transitions are explicit.
- Organizer/participant overlap behavior for exact adjacency, partial overlap, containment, same start, and cancelled/deleted records.
- Participant overlap statuses follow the chosen policy; update checks exclude the appointment being edited.
- Concurrent create/update attempts cannot violate a hard no-overlap guarantee, if that is the decision.

### Participants and persistence

- Participant IDs are unique per appointment; invalid/nonexistent/out-of-scope invitees are rejected.
- Invite/remove behavior, organizer rules, RSVP status transitions, `responded_at`, and response notes.
- Foreign-key delete behavior and appointment soft-delete treatment of participant rows.
- Project/team/user lifecycle interactions, including deleted or inactive organizers/participants.

### Database and query behavior

- Assert exact appointment/participant columns, nullability, defaults, foreign keys, unique constraints, and indexes.
- Verify active range queries exclude soft-deleted/cancelled rows as required.
- If concurrency locking/constraints are used, test the selected database behavior with an appropriate multi-connection or integration strategy rather than assuming SQLite proves MySQL semantics.

## 11. Explicit readiness assessment

### READY WITH CONDITIONS

The database and model foundation is sufficient to begin detailed Phase 7 contract/design work. It is **not yet ready for implementation without conditions** because appointment scope, timezone semantics, conflict guarantees, lifecycle/cancellation, and participant authority are unresolved. The current schema cannot enforce tenant/project isolation because it has no contextual relationship, and the existing “overlap” indexes do not implement or guarantee conflict handling. Resolve the decisions listed in Section 8, reconcile security documentation, then approve the schema/API design before implementation.

## Audit source index

- `README.md`, `PROJECT_CONTEXT.md`
- `docs/database/README.md`, `SCHEMA.md`, `ERD.md`, `RELATIONSHIPS.md`, `INDEXING-STRATEGY.md`, `SECURITY-AND-ISOLATION.md`
- `database/migrations/2026_11_01_000007_create_appointments_and_participants_tables.php`
- `app/Models/Appointment.php`, `AppointmentParticipant.php`, `User.php`, `Project.php`
- `app/Enums/AppointmentStatus.php`, `AppointmentLocationType.php`, `ParticipantStatus.php`
- `app/Policies/ProjectPolicy.php`, `app/Providers/AppServiceProvider.php`
- `database/seeders/PermissionSeeder.php`, `RolePermissionSeeder.php`, `DevelopmentProjectSeeder.php`
- `database/factories/AppointmentFactory.php`, `AppointmentParticipantFactory.php`
- `tests/Feature/Database/DatabaseSchemaMigrationTest.php`, `ModelRelationshipsTest.php`
- `routes/api.php` and `php artisan route:list --path=appointments --except-vendor`
