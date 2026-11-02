# Hirgal — Project Context

> **Central Project Knowledge & Architecture Guide for AI Agents & Developers**  
> **Repository Location:** `C:\Hirgal`  
> **Last Updated:** 2026-11-02  
> **Status:** Phase 5.2 Completed & Accepted (`main` commit `2a571ee`)

---

## 1. Project Overview

### 1.1 Purpose & Vision
**Hirgal** is an enterprise-grade Project Management and Team Collaboration Platform built as a robust, secure, API-driven backend. The system integrates project planning, cross-functional team coordination, Kanban task workflows, calendar scheduling, personal habit tracking, user follow-up inboxes, and centralized audit logging into a unified, high-performance architecture.

### 1.2 Core Product Functionality
1. **Identity & Access Management:** Secure token-based authentication via Laravel Sanctum, invitation-driven onboarding, granular role-based access control (RBAC), and user profile management.
2. **Projects & Tenancy Workspaces:** Contextual project boundaries with project-specific member assignments, contextual membership roles, and invitations.
3. **Teams & Squad Coordination:** Cross-functional organizational squads, team rosters, and multi-team project assignments.
4. **Tasks & Work Management:** Project Kanban boards, subtasks, task delegations, priority matrices, threaded discussions, and file attachments.
5. **Appointments & Scheduling:** Collaborative calendar appointments, video conferencing links, and participant RSVP status tracking.
6. **Habit Tracker:** Personal habit definition, cadence/frequency scheduling, daily check-in logging, and completion streak tracking.
7. **Follow-Up Inbox & Mentions:** High-speed indexed `@mentions` across tasks and comments, automated in-app notifications, and activity tracking.
8. **Polymorphic Activity Auditing:** Immutable audit trail recording actor identity, client IP, action type, subject entity, and change diffs.

### 1.3 Intended Users & Role Profiles
- **System Administrator:** Global platform administrators responsible for system configuration, user lifecycle administration, and global security management.
- **Project Manager:** Coordinates project lifecycles, creates projects, invites team members, establishes sprint boards, and tracks task delivery.
- **Team Leader:** Leads functional squads, assigns tasks to squad members, schedules team meetings, and supervises daily workflows.
- **Member:** Individual team contributors collaborating on assigned tasks, tracking personal productivity habits, and participating in meetings.

---

## 2. Technology Stack

All versions documented below reflect the **actual installed packages** verified directly against the running runtime and composer manifests:

| Technology / Package | Verified Version | Purpose / Architectural Scope |
| :--- | :--- | :--- |
| **PHP** | `8.4.26 (cli)` (NTS x64) | Runtime engine with Zend OPcache enabled |
| **Laravel Framework** | `13.39.0` | Backend API core framework (Modular Monolith) |
| **MySQL Server** | `8.0.46` (InnoDB) | Primary relational database (utf8mb4, strict mode) |
| **Laravel Sanctum** | `v4.3.3` | Token-based REST API authentication and hashing |
| **PHPUnit** | `12.5.42` | Automated testing framework (Unit & Feature suites) |
| **Laravel Pint** | `v1.25.x` | Automated code style and formatting engine |
| **Database Drivers** | `pdo_mysql`, `pdo_sqlite` | Production MySQL 8 and fast SQLite memory tests |

---

## 3. Architecture & Engineering Standards

### 3.1 Modular Monolith & REST API Design
Hirgal is architected as a **Modular Monolith**. Code is partitioned by functional domain rather than scattered utility scripts. All client interaction is strictly conducted through a versioned RESTful API under the `/api/v1` route namespace.

### 3.2 Actions → Services → Controllers Pattern
The backend enforces a strict four-layer separation of concerns:
```
[HTTP Request]
       │
       ▼
[Form Request] ────> Validates schema & verifies request-level gate authorization
       │
       ▼
[Controller]   ────> Thin endpoint; extracts parameters, invokes Service/Action
       │
       ▼
[Service]      ────> Orchestrates multi-step business logic and read operations
       │
       ▼
[Action]       ────> Single-responsibility state mutation inside DB::transaction()
       │
       ▼
[API Resource] ────> Sanitizes model data and returns uniform ApiResponse JSON
```

- **Form Requests (`app/Http/Requests`):** Validate input schemas, sanitize data, and enforce early authorization rules.
- **Controllers (`app/Http/Controllers/Api/V1`):** Keep endpoints minimal (under 30 lines per method). Controllers never write raw SQL or complex business conditionals.
- **Services (`app/Services`):** Coordinate multi-model workflows, read aggregations, and business process lifecycles.
- **Actions (`app/Actions`):** Pure, single-purpose classes executing database write operations within atomic transactions (`DB::transaction()`).
- **API Resources (`app/Http/Resources`):** Transform Eloquent models into sanitized JSON output. Sensitive attributes (`password`, `token_hash`, internal admin metadata) are never leaked.
- **Policies (`app/Policies`):** Centralize granular authorization logic, mapped directly to Eloquent models.
- **Middleware (`app/Http/Middleware`):** Intercept and enforce system invariants (`ForceJsonResponse`, `EnsureAccountIsActive`, `auth:sanctum`).
- **Response Standard:** Standardized JSON responses through `App\Support\ApiResponse`.
- **Naming Conventions:** PascalCase for classes, camelCase for methods/variables, snake_case for database columns and JSON keys, kebab-case for URLs and permission slugs.

---

## 4. Project Structure

```
C:\Hirgal
├── app/
│   ├── Actions/                  # Single-purpose write operations
│   │   ├── Auth/                 # Login, Logout, Password reset, Invitation acceptance
│   │   └── User/                 # User mutation, Activation, Deactivation, Invitations
│   ├── Enums/                    # Strongly-typed PHP 8.4 Enums (Roles, Statuses, Priorities)
│   ├── Http/
│   │   ├── Controllers/Api/V1/   # Thin REST API controllers
│   │   ├── Middleware/           # Request filters (ForceJsonResponse, EnsureAccountIsActive)
│   │   ├── Requests/Api/V1/      # Form requests for validation and gate checks
│   │   └── Resources/Api/V1/     # Eloquent API transformation resources
│   ├── Models/                   # 23 Eloquent models representing business entities
│   ├── Notifications/            # Mailable email notifications (ResetPassword, UserInvitation)
│   ├── Policies/                 # Authorization policies (UserPolicy, UserInvitationPolicy)
│   ├── Services/                 # Business logic orchestrators (Auth, User, Invitation)
│   └── Support/                  # Shared framework helpers (ApiResponse)
├── config/                       # Configuration (app, auth, database, sanctum)
├── database/
│   ├── factories/                # Model factories for testing and seed generation
│   ├── migrations/               # 14 migrations defining 32 database tables
│   └── seeders/                  # RoleSeeder, PermissionSeeder, RolePermissionSeeder
├── docs/
│   ├── api/                      # Authoritative API specs (AUTH.md, USERS.md, INVITATIONS.md)
│   └── database/                 # Authoritative DB specs (SCHEMA.md, ERD.md, RELATIONSHIPS.md)
├── routes/
│   └── api.php                   # Versioned REST API route definitions (/api/v1)
├── tests/
│   ├── Feature/                  # Feature tests (Auth, Users, Database, Security, Api)
│   └── Unit/                     # Low-level unit tests
└── PROJECT_CONTEXT.md            # Central project context & living documentation (this file)
```

---

## 5. Database Architecture

> **Authoritative Specification:** For complete schemas, foreign keys, and indexing definitions, inspect [`docs/database/`](file:///c:/Hirgal/docs/database/).

### 5.1 Table Classification & Inventory (32 Total Tables)
The database contains **32 tables**, strictly partitioned into **23 Core Business Domain Tables** and **9 Laravel Framework Tables**:

1. **Identity & Profiles (3):** `users`, `user_profiles`, `user_invitations`
2. **Global RBAC (4):** `roles`, `permissions`, `role_permissions`, `user_roles`
3. **Projects & Tenancy (3):** `projects`, `project_members`, `project_invitations`
4. **Teams & Squads (3):** `teams`, `team_members`, `project_teams`
5. **Tasks & Work Management (4):** `tasks`, `task_assignments`, `task_comments`, `task_attachments`
6. **Appointments & Scheduling (2):** `appointments`, `appointment_participants`
7. **Inbox & Follow-Up (1):** `user_mentions`
8. **Habit Tracker (2):** `habits`, `habit_logs`
9. **Auditing & Logs (1):** `activity_logs`
10. **Framework Infrastructure (9):** `personal_access_tokens`, `password_reset_tokens`, `sessions`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `notifications`

### 5.2 Key Design Principles
- **Dual Identification Strategy:** High-performance clustered `BIGINT UNSIGNED AUTO_INCREMENT` primary keys for joins and foreign keys; public `uuid` (CHAR 36) on tenant-facing entities (`projects`, `tasks`, `teams`, `appointments`, `habits`) to prevent enumeration attacks.
- **Composite Ownership Constraints:** Enforced at storage engine level (e.g., `(habit_id, user_id)` foreign key on `habit_logs` referencing `habits(id, user_id)`).
- **Application-Level Enums:** All categorical columns (`status`, `priority`, `role`) store `VARCHAR(50)` cast to PHP 8.4 Enums.
- **Cryptographic Token Hashing:** Invitation and password reset tokens store only SHA-256 hashes (`token_hash` CHAR 64). Raw tokens are never persisted.
- **Soft Deletes:** Preserved on `users`, `projects`, `tasks`, `teams`, `appointments`, and `habits`.
- **Explicit Scoping:** No hidden global scopes that silently corrupt CLI jobs or administrative reporting.

---

## 6. Authentication & Security

### 6.1 Sanctum Authentication & Token Lifecycle
- Token issuance occurs on `POST /api/v1/auth/login`, `POST /api/v1/auth/register` (when enabled), or `POST /api/v1/invitations/{token}/accept`.
- Tokens are SHA-256 hashed in `personal_access_tokens`.
- Token revocation is strictly immediate:
  - `POST /api/v1/auth/logout`: Revokes caller's current token.
  - `POST /api/v1/auth/logout-all`: Revokes all active tokens for the user across all devices.
  - Password Reset: Revokes all tokens belonging to the user.
  - User Deactivation (`POST /api/v1/users/{id}/deactivate`): Immediately deletes all tokens for the target user.

### 6.2 Account Status Verification
- Three states: `active`, `suspended`, `pending` (`App\Enums\AccountStatus`).
- Inactive accounts attempting login are evaluated *after* password verification to avoid user status enumeration, returning `403 Forbidden` (`ACCOUNT_NOT_ACTIVE`).
- The `EnsureAccountIsActive` middleware intercepts all authenticated requests and terminates suspended/inactive sessions.

### 6.3 Security Hardening Mitigations (Phase 5.2 Verified)
- **Privilege Escalation Defense (SEC-01 & SEC-02):**
  - Non-administrators cannot modify `role_id` or `account_status` via `PUT /api/v1/users/{id}` (`403 Forbidden`).
  - Users cannot escalate their own roles or statuses (`403 Forbidden`). Self updates are restricted to `PUT /api/v1/auth/me/profile`.
  - Only System Administrators can invite or manage users for the `System Admin` role.
- **Last Administrator Protection & Concurrency Locking (SEC-03):**
  - Demoting or deactivating the last active System Administrator is blocked.
  - Mutating System Admin status executes within a database transaction acquiring a pessimistic exclusive row lock on the `system-admin` role (`Role::lockForUpdate()`), eliminating TOCTOU race conditions.
- **Token Exposure Mitigation (SEC-04):**
  - Public invitation verification is handled via `POST /api/v1/invitations/inspect` with `{ "token": "..." }` in the request body. Legacy URL path token routes are deprecated (`Deprecation: true` header).
- **User Enumeration Timing Defense (SEC-05):**
  - `LoginUserAction` executes a dummy 12-round Bcrypt comparison when an email is not found, equalizing response time with valid account verification (~250ms).
- **Orphaned Token Table Exhaustion Defense (SEC-06):**
  - `SendPasswordResetLinkAction` queries user existence prior to inserting into `password_reset_tokens`. Non-existent emails trigger no database writes while returning a generic 200 response.
- **Collaborative Directory Separation (SEC-07):**
  - Administrative user lists (`GET /api/v1/users`) require `users.view`.
  - General member lookup uses `GET /api/v1/users/directory` requiring `users.view_directory`, exposing only sanitized collaboration fields (`id`, `name`, `email`, `avatar_url`, `timezone`, `job_title`, `department`).
- **Frontend Action Link Redirection (SEC-08):**
  - Password reset and invitation emails generate action links directed to the frontend SPA (`config('app.frontend_url')`).

### 6.4 Rate Limiting Quotas
- Global API: 60 requests / minute (User ID or Client IP).
- Login: 5 attempts / minute (Email + Client IP).
- Password Reset: 5 requests / minute (Client IP).
- Invitations: 10 requests / minute (User ID or Client IP).
- Token Inspection: 30 requests / minute (Client IP).

---

## 7. Global Roles & Permissions

### 7.1 Global System Roles
Hirgal defines **4 global system roles** in `roles`:

| Role Name | Slug | Purpose & Global Scope |
| :--- | :--- | :--- |
| **System Admin** | `system-admin` | Full system-level authority, user administration, security governance. |
| **Project Manager** | `project-manager` | Organization-level coordination, project creation, member invitations. |
| **Team Leader** | `team-leader` | Squad leadership, task delegation, team meeting coordination. |
| **Member** | `member` | Individual contributor, collaborative task execution, habit tracking. |

### 7.2 System Permissions Matrix (31 Permissions)
Permissions are distributed across 8 functional modules:
- `users`: `users.view`, `users.view_directory`, `users.create`, `users.update`, `users.delete`, `users.invite`
- `roles`: `roles.view`, `roles.manage`
- `projects`: `projects.view`, `projects.create`, `projects.update`, `projects.delete`, `projects.archive`, `projects.invite`
- `tasks`: `tasks.view`, `tasks.create`, `tasks.update`, `tasks.delete`, `tasks.assign`, `tasks.comment`
- `teams`: `teams.view`, `teams.create`, `teams.update`, `teams.delete`, `teams.manage`
- `appointments`: `appointments.view`, `appointments.create`, `appointments.update`, `appointments.delete`
- `habits`: `habits.manage`
- `audit`: `audit.view`

### 7.3 Global Roles vs Contextual Project Roles
> **CRITICAL ARCHITECTURAL DISTINCTION:**  
> Never confuse **Global System Roles** (`roles`) with **Contextual Project Membership Roles** (`project_members.role`).
- Global Roles govern system-wide administration, tenant creation, and access to platform-level APIs.
- Contextual Project Roles (`owner`, `manager`, `contributor`, `viewer`) exist strictly within the boundary of a specific project.
- A user with the global `Member` role may be the `owner` of an individual project. Conversely, a global `Project Manager` does not possess write privileges to projects to which they have not been explicitly added as a member.

---

## 8. Implemented Modules

### Module 1: Authentication & User Profile
- **Status:** `IMPLEMENTED` | `TESTED` | `AUDITED` | `HARDENED`
- **Main Responsibilities:** User login, logout, device token invalidation, profile inspection (`/auth/me`), profile updates (`/auth/me/profile`), password reset, password modification.
- **Routes:** `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/logout-all`, `GET /api/v1/auth/me`, `PUT /api/v1/auth/me/profile`, `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`, `POST /api/v1/auth/change-password`
- **Models / Tables:** `User` (`users`), `UserProfile` (`user_profiles`), `password_reset_tokens`, `personal_access_tokens`
- **Tests:** `tests/Feature/Auth/LoginTest.php`, `tests/Feature/Auth/PasswordResetTest.php`, `tests/Feature/Auth/ProfileTest.php`
- **Docs:** [`docs/api/AUTH.md`](file:///c:/Hirgal/docs/api/AUTH.md)

### Module 2: User Administration & Directory
- **Status:** `IMPLEMENTED` | `TESTED` | `AUDITED` | `HARDENED`
- **Main Responsibilities:** Administrative user listing, individual user inspection, profile & role updates, user account activation, deactivation with token revocation, team collaboration directory.
- **Routes:** `GET /api/v1/users`, `GET /api/v1/users/directory`, `GET /api/v1/users/{id}`, `PUT /api/v1/users/{id}`, `POST /api/v1/users/{id}/activate`, `POST /api/v1/users/{id}/deactivate`
- **Models / Tables:** `User` (`users`), `Role` (`roles`), `user_roles`
- **Policies / Permissions:** `UserPolicy`, permissions: `users.view`, `users.view_directory`, `users.update`, `users.delete`
- **Tests:** `tests/Feature/Users/UserManagementTest.php`, `tests/Feature/Security/SecurityHardeningTest.php`
- **Docs:** [`docs/api/USERS.md`](file:///c:/Hirgal/docs/api/USERS.md)

### Module 3: User Invitations & Onboarding
- **Status:** `IMPLEMENTED` | `TESTED` | `AUDITED` | `HARDENED`
- **Main Responsibilities:** Dispatch onboarding invitations, token inspection via POST body, invitation resending, revocation, single-use acceptance.
- **Routes:** `POST /api/v1/invitations/inspect`, `GET /api/v1/invitations/{token}` (deprecated), `POST /api/v1/invitations/{token}/accept`, `GET /api/v1/invitations`, `POST /api/v1/invitations`, `POST /api/v1/invitations/{id}/resend`, `DELETE /api/v1/invitations/{id}`
- **Models / Tables:** `UserInvitation` (`user_invitations`), `User` (`users`), `Role` (`roles`)
- **Policies / Permissions:** `UserInvitationPolicy`, permission: `users.invite`
- **Tests:** `tests/Feature/Users/UserInvitationManagementTest.php`, `tests/Feature/Auth/InvitationAcceptanceTest.php`, `tests/Feature/Security/SecurityHardeningTest.php`
- **Docs:** [`docs/api/INVITATIONS.md`](file:///c:/Hirgal/docs/api/INVITATIONS.md)

### Module 4: Database Infrastructure & Models Foundation
- **Status:** `IMPLEMENTED` | `TESTED` | `AUDITED` | `VERIFIED ON MYSQL 8`
- **Main Responsibilities:** 23 Eloquent models, 14 migrations, relationship definitions, factories, and seeders.
- **Tests:** `tests/Feature/Database/*` (Integrity, ModelRelationships, MySQLCompositeConstraintTest)
- **Docs:** [`docs/database/`](file:///c:/Hirgal/docs/database/)

---

## 9. API Standards

### 9.1 Prefix & Headers
- Prefix: `/api/v1`
- Mandatory Header: `Accept: application/json` (enforced by `ForceJsonResponse` middleware)
- Authentication: `Authorization: Bearer <sanctum_token>`

### 9.2 Standard Response Structure
Managed centrally through `App\Support\ApiResponse`:

```json
// Success Response
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": { ... },
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 15,
    "total": 75
  }
}

// Error Response
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["Invalid credentials."]
  },
  "error_code": "VALIDATION_ERROR"
}
```

### 9.3 HTTP Status Conventions
- `200 OK`: Successful read or update.
- `201 Created`: Resource successfully created.
- `401 Unauthorized`: Missing, expired, or invalid Sanctum token (`UNAUTHENTICATED`).
- `403 Forbidden`: Insufficient permissions or inactive account (`FORBIDDEN`, `ACCOUNT_NOT_ACTIVE`).
- `404 Not Found`: Resource does not exist or unauthorized tenant access (`RESOURCE_NOT_FOUND`).
- `422 Unprocessable Content`: Validation schema failure (`VALIDATION_ERROR`).
- `429 Too Many Requests`: Rate limit exceeded (`RATE_LIMIT_EXCEEDED`).
- `500 Internal Server Error`: Unexpected failure (`INTERNAL_SERVER_ERROR`).

---

## 10. Testing & Quality Assurance

### 10.1 Framework & Test Execution
- **Testing Framework:** PHPUnit 12.5.42.
- **Commands:**
  ```sh
  php vendor/bin/phpunit
  php artisan test
  ```
- **Code Style Verification:**
  ```sh
  php vendor/bin/pint --test
  ```

### 10.2 Verified Test Count & Assertion Summary
Verified directly via runtime execution:
- **Total Tests:** 102
- **Passing Tests:** 102 (100% green)
- **Total Assertions:** 469
- **Failures / Errors:** 0

### 10.3 Test Suite Breakdown
1. `tests/Unit`: 1 test, 1 assertion.
2. `tests/Feature/Auth`: 30 tests, 138 assertions (Registration, Login, Logout, Profile, Passwords, Invitations).
3. `tests/Feature/Users`: 17 tests, 74 assertions (CRUD, Activation, Deactivation, Invitations).
4. `tests/Feature/Database`: 26 tests, 126 assertions (Relationships, Schema constraints, Seeders, MySQL composite keys).
5. `tests/Feature/Security`: 23 tests, 97 assertions (Security regression tests SEC-01 through SEC-08).
6. `tests/Feature/Api`: 4 tests, 32 assertions (Connection, Health checks).
7. `tests/Feature/ExampleTest.php`: 1 test, 1 assertion.

### 10.4 SQLite vs MySQL Testing Strategy
- **SQLite In-Memory (`:memory:`):** Default for high-speed feature and unit testing in `phpunit.xml`.
- **MySQL 8 (`hirgal_backend_test`):** Mandatory for composite foreign key constraints, pessimistic row locks, and real InnoDB transactions (`tests/Feature/Database/MySQLCompositeConstraintTest.php`).

---

## 11. Completed Phases

| Phase | Title | Completion Date | Acceptance Status | Git Commit | Key Achievements / Scope |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **Phase 1** | Architecture Blueprint | 2026-10-30 | **ACCEPTED** | — | System requirements, modular design, domain boundaries. |
| **Phase 2** | Backend Foundation & Scaffolding | 2026-10-31 | **ACCEPTED** | — | Laravel 13 setup, Sanctum, ApiResponse envelope, Health API. |
| **Phase 3** | Database Design & ERD | 2026-10-31 | **ACCEPTED** | — | Complete 32-table schema, indexing strategy, data dictionary. |
| **Phase 3.1** | Database Design Corrections | 2026-10-31 | **ACCEPTED** | — | Schema reconciliation, habit composite FK, seeder plans. |
| **Phase 4** | Database Implementation | 2026-10-31 | **ACCEPTED** | `0c9582b` | 14 migrations, 23 Eloquent models, factories, seeders. |
| **Phase 4.1** | Database Audit & Verification | 2026-10-31 | **ACCEPTED** | — | Read-only audit identifying seeder production risks. |
| **Phase 4.2** | Seeder Safety & Reconciliation | 2026-10-31 | **ACCEPTED** | `e6c9111` | Environment safety guards on seeders, table classification. |
| **Phase 5** | Auth & User Management API | 2026-10-31 | **ACCEPTED** | `b9e913e` | Implemented 21 endpoints, Actions/Services/Controllers. |
| **Phase 5.1** | Security Audit | 2026-10-31 | **FAILED** | — | Independent audit identified SEC-01 through SEC-08. |
| **Phase 5.2** | Security Hardening & Remediation | 2026-11-02 | **ACCEPTED** | `2a571ee` | Fixed SEC-01 to SEC-08, added 23 regression tests (102 tests total). |

---

## 12. Current Project Status

- **Latest Completed Phase:** Phase 5.2 (Security Hardening & Remediation).
- **Latest Accepted Phase:** Phase 5.2 (Passed all audit requirements; report generated).
- **Current Development Phase:** Phase 5.2 Finalized / Pre-Phase 6.
- **Remaining Work:**
  - Phase 6: Projects, Teams & Work Management APIs.
  - Phase 7: Appointments & Scheduling API.
  - Phase 8: Habit Tracker API.
  - Phase 9: Follow-Up Inbox, Mentions & Activity Logging.
  - Phase 10: Production Readiness, Performance Optimization & Final Security Audit.
- **Pending Audits:** None.
- **Known Blockers:** None.
- **Frontend Status:** **STRICTLY PROHIBITED.** No frontend code, Blade views, or SPAs may be introduced until backend APIs are complete and approved.

---

## 13. Known Issues & Technical Debt

1. **Invitation GET Route Deprecation:** `GET /api/v1/invitations/{token}` remains operational for backwards compatibility with a `Deprecation: true` header. It must be scheduled for complete removal in a future major API release once clients transition to `POST /api/v1/invitations/inspect`.
2. **Multi-Node Concurrency Scaling:** Pessimistic row locking on `roles` table (`Role::lockForUpdate()`) provides serialization across single MySQL instances. If the platform migrates to a multi-master or globally distributed database cluster, an atomic distributed lock (Redis/Cache lock) will be required.
3. **Public Registration Disabled:** `config('auth.allow_registration')` is `false` by default; platform onboarding relies strictly on administrative invitations. Public registration flows require further review before production enablement.

---

## 14. Development Roadmap

1. **Phase 6: Projects, Teams & Task Management API**
   - Projects CRUD, workspace boundaries, project invitations, project membership roles.
   - Teams CRUD, team rosters, multi-team project allocation.
   - Tasks CRUD, Kanban boards, subtasks, task assignments, task comments, attachments.
2. **Phase 7: Appointments & Calendar Scheduling API**
   - Appointments CRUD, video conferencing link integrations, participant invitations & RSVP tracking.
3. **Phase 8: Habit Tracker API**
   - Habit definitions, schedules, daily logs, streak computation, composite key validation.
4. **Phase 9: Follow-Up Inbox, Mentions & Activity Logging API**
   - Notification dispatch, `@mentions` extraction & indexing, activity audit trail querying.
5. **Phase 10: Production Readiness & Final Verification**
   - Comprehensive performance profiling, rate limiter optimization, security re-audit, API documentation finalization.

---

## 15. Important Development Rules

The following rules are **permanent and non-negotiable** for all AI coding agents working on Hirgal:

1. **Backend-First Development:** Do not write frontend code, React components, Vue templates, or Blade views.
2. **Verify Before Coding:** Always read `PROJECT_CONTEXT.md` and inspect actual files, routes, and tests before making modifications.
3. **Preserve Architecture:** Adhere strictly to Actions → Services → Controllers, Form Requests, Policies, and `ApiResponse`. Never put business logic in controllers.
4. **No Destructive Database Commands:** Never run `migrate:fresh`, `db:wipe`, or schema commands that destroy existing data.
5. **Enforce Authorization Server-Side:** Never rely on client-side constraints. Every route must validate authentication, account status, and model policies.
6. **Mandatory Automated Tests:** Every new endpoint, action, and bugfix must include automated PHPUnit feature tests asserting both positive and negative authorization cases.
7. **Maintain Code Style:** All code must pass Laravel Pint formatting (`php vendor/bin/pint --test`).
8. **Phase Boundary Discipline:** Complete and test the current phase only. Never begin subsequent roadmap phases without explicit user instruction.
9. **Living Documentation:** Update `PROJECT_CONTEXT.md` in the same commit whenever changes are made to schema, architecture, endpoints, or project status.

---

## 16. Change History

| Date | Phase / Milestone | Git Commit | Files / Areas Changed | Summary of Changes | Tests Executed | Documentation Updated |
| :---: | :---: | :---: | :--- | :--- | :---: | :--- |
| **2026-10-30** | Phase 1 | — | `docs/` | Architectural blueprint, requirements definition. | — | Architecture documentation |
| **2026-10-31** | Phase 2 | — | Foundation | Laravel setup, Sanctum, ApiResponse envelope. | 4 tests | `README.md` |
| **2026-10-31** | Phase 3 & 3.1 | — | `docs/database/` | Complete 32-table database design and corrections. | — | `docs/database/*` |
| **2026-10-31** | Phase 4 & 4.2 | `0c9582b`<br>`e6c9111` | `database/`, `app/Models/` | 14 migrations, 23 models, factories, seeders with safety guards. | 26 tests | Database documentation |
| **2026-10-31** | Phase 5 | `b9e913e` | `app/Http/`, `app/Actions/`, `routes/api.php` | 21 endpoints for Auth, Users, and Invitations. | 79 tests | `docs/api/*` |
| **2026-10-31** | Phase 5.1 | — | Security Audit | Independent audit identifying vulnerabilities SEC-01 through SEC-08. | — | Audit report artifact |
| **2026-11-02** | Phase 5.2 | `2a571ee` | `app/`, `config/`, `routes/`, `tests/Feature/Security/` | Remediated SEC-01 to SEC-08, added 23 regression tests, Pint formatted. | 102 tests | `docs/api/*`, acceptance report |
| **2026-11-02** | Phase 5.2 Docs | *Current* | `PROJECT_CONTEXT.md` | Created permanent root-level living documentation file for all future agents. | 102 tests | `PROJECT_CONTEXT.md` |
