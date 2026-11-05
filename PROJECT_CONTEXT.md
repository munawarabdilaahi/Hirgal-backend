# Hirgal — Project Context

> **Central Project Knowledge, Architectural Blueprint & Living Operational Guide**  
> **Repository Location:** `C:\Hirgal`  
> **Current Version:** Backend Phase 6.2 Accepted; Frontend Phase 4 Dashboard, User Directory & User Administration
> **Last Audited & Updated:** 2026-11-04
> **Git Baseline:** Commit `d7e0916` (Phase 6.2) & Commit `3556549` (Documentation Baseline) — Phases 6 & 6.2 recorded in Section 11

---

## 1. Project Overview

### 1.1 Purpose & Vision
**Hirgal** is an enterprise-grade Project Management and Team Collaboration Platform built as an API-first backend system. It unifies project planning, cross-functional team coordination, Kanban task workflows, calendar scheduling, personal habit tracking, user follow-up inboxes, and centralized audit logging into a modular, secure, high-performance architecture.

### 1.2 Core Product Functionality (Vision vs Current Status)
The complete platform vision encompasses 8 functional pillars. The backend API implementation status is:

1. **Identity & Access Management (`IMPLEMENTED & AUDITED`):** Token-based authentication via Laravel Sanctum, invitation-driven onboarding, granular role-based access control (RBAC), and user profile management.
2. **User Directory (`IMPLEMENTED & AUDITED`):** Team collaboration directory exposing basic profile details with administrative metadata redacted.
3. **Projects & Tenancy Workspaces (`IMPLEMENTED — PHASE 6`):** Workspace boundaries, contextual project roles, membership management, project/team allocation.
4. **Teams & Squad Coordination (`IMPLEMENTED — PHASE 6`):** Organizational squads, member rosters, and multi-team project allocations.
5. **Tasks & Work Management (`IMPLEMENTED — PHASE 6`):** Kanban task workflows, subtasks, task assignments, priorities, and status lifecycle. *(Comments and attachments remain database-only, deferred to a later phase.)*
6. **Appointments & Scheduling (`DATABASE FOUNDATION ONLY — API PLANNED FOR PHASE 7`):** Calendar appointments, video conferencing links, and participant RSVP tracking.
7. **Habit Tracker (`DATABASE FOUNDATION ONLY — API PLANNED FOR PHASE 8`):** Personal habit definitions, frequency schedules, daily check-in logging, and streak tracking.
8. **Follow-Up Inbox & Mentions (`DATABASE FOUNDATION ONLY — API PLANNED FOR PHASE 9`):** Indexed `@mentions` across tasks and comments, notifications, and activity tracking.
9. **Polymorphic Activity Auditing (`DATABASE FOUNDATION ONLY — API PLANNED FOR PHASE 9`):** Immutable audit trail recording actor identity, client IP, action type, subject entity, and change diffs.

### 1.3 Intended Users & Role Profiles
- **System Administrator:** Global platform administrator responsible for system configuration, user lifecycle administration, and global security management.
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
The backend enforces a strict separation of concerns across dedicated architectural layers:

```
[HTTP Request]
       │
       ▼
[Form Request] ────> Validates schema & verifies request-level gate authorization
       │
       ▼
[Controller]   ────> Thin transport handler; extracts inputs, invokes Service/Action
       │
       ▼
[Service]      ────> Orchestrates multi-step business workflows and read queries
       │
       ▼
[Action]       ────> Single-responsibility state mutation inside DB::transaction()
       │
       ▼
[API Resource] ────> Presentation layer: sanitizes attributes, returns ApiResponse JSON
```

### 3.3 Layer Responsibilities
- **Form Requests (`app/Http/Requests`):** Validate input schemas, sanitize incoming parameters, and evaluate request-level authorization rules (e.g. verifying caller permissions before reaching the controller).
- **Controllers (`app/Http/Controllers/Api/V1`):** Purely **HTTP transport handlers**. They receive validated request data, dispatch execution to dedicated Services or Actions, and return JSON responses wrapped in `ApiResponse`. Controllers contain **no business logic, no direct SQL queries, and no state mutations**.
- **Services (`app/Services`):** Business workflow coordinators and read query providers. They manage multi-step processes, complex read filtering/pagination, and coordinate across multiple Actions or external providers.
- **Actions (`app/Actions`):** Discrete, single-purpose state mutation units. Each action executes a specific business operation (e.g. `UpdateUserAction`, `DeactivateUserAction`) and manages its own database transactions (`DB::transaction`) to ensure atomicity.
- **Policies (`app/Policies`):** Fine-grained model-level authorization logic defining who can view, create, update, or delete specific domain resources based on global permissions and entity ownership.
- **API Resources (`app/Http/Resources`):** Strictly **presentation and serialization layers**. They transform Eloquent models into sanitized JSON arrays, format timestamps (ISO 8601), and redact sensitive internal attributes (`password`, `token_hash`, administrative metadata). They do **NOT** contain business logic, query databases, or perform mutations.
- **Middleware (`app/Http/Middleware`):** HTTP pipeline filters that enforce cross-cutting concerns, such as forcing JSON responses (`ForceJsonResponse`), verifying Sanctum authentication (`auth:sanctum`), enforcing active account status (`EnsureAccountIsActive`), and applying rate limits.
- **Response Standard:** Standardized JSON responses through `App\Support\ApiResponse`.
- **Naming Conventions:** PascalCase for classes, camelCase for methods/variables, snake_case for database columns and JSON keys, kebab-case for URLs and permission slugs.

---

## 4. Project Structure

`C:\Hirgal` is the canonical repository and the only Laravel application root. Keep the application, its dependencies, documentation, and tests at this root; do not create a nested copy of the project. The redundant `Hirgal-backend/` snapshot was removed on 2026-11-04 after its tracked files and Git history were compared with this repository. It contained no unique project files; the root already held the newer Phase 6.2 implementation and documentation.

```
C:\Hirgal
├── app/
│   ├── Actions/                  # Single-purpose write operations
│   │   ├── Auth/                 # Login, Logout, Password reset, Invitation acceptance
│   │   ├── Projects/             # Project & membership mutations (Phase 6)
│   │   ├── Teams/                # Team, roster & allocation mutations (Phase 6)
│   │   ├── Tasks/                # Task & assignment mutations (Phase 6)
│   │   └── User/                 # User mutation, Activation, Deactivation, Invitations
│   ├── Enums/                    # Strongly-typed PHP 8.4 Enums (Roles, Statuses, Priorities)
│   ├── Http/
│   │   ├── Controllers/Api/V1/   # Thin REST API controllers (Projects, Teams, Tasks, ...)
│   │   ├── Middleware/           # Request filters (ForceJsonResponse, EnsureAccountIsActive)
│   │   ├── Requests/Api/V1/      # Form requests (Auth, Users, Projects, Teams, Tasks)
│   │   └── Resources/Api/V1/     # Eloquent API presentation & transformation resources
│   ├── Models/                   # 23 Eloquent models representing business entities
│   ├── Notifications/            # Mailable email notifications (ResetPassword, UserInvitation)
│   ├── Policies/                 # Authorization policies (6 Phase 6 policies + User, UserInvitation)
│   ├── Services/                 # Business logic orchestrators (Auth, User, Project, Team, Task)
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
│   ├── Feature/                  # Feature tests (Auth, Users, Projects, Teams, Tasks, Database, Security, Api)
│   └── Unit/                     # Low-level unit tests
├── frontend/                     # Independent React 19 / TypeScript application (Frontend Phase 2 design system)
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
- **Dual Identification Strategy:** High-performance clustered `BIGINT UNSIGNED AUTO_INCREMENT` primary keys for joins and foreign keys; public `uuid` (CHAR 36) on tenant-facing entities (`projects`, `tasks`, `teams`, `appointments`, `habits`) to prevent sequential enumeration attacks.
- **Composite Ownership Constraints:** Enforced at storage engine level (e.g., `(habit_id, user_id)` foreign key on `habit_logs` referencing `habits(id, user_id)`).
- **Application-Level Enums:** All categorical columns (`status`, `priority`, `role`) store `VARCHAR(50)` cast to strongly-typed PHP 8.4 Enums.
- **Cryptographic Token Hashing:** Invitation and password reset tokens store only SHA-256 hashes (`token_hash` CHAR 64). Raw tokens are never persisted in the database.
- **Soft Deletes:** Preserved on `users`, `projects`, `tasks`, `teams`, `appointments`, and `habits`.
- **Explicit Scoping:** Multi-tenant boundaries rely on explicit project queries and policies. Hidden global scopes are avoided to prevent silent corruption in CLI jobs or administrative reporting.

---

## 6. Authentication & Security

### 6.1 Sanctum Authentication & Token Lifecycle
- Token issuance occurs on `POST /api/v1/auth/login`, `POST /api/v1/auth/register` (when public registration is enabled), or `POST /api/v1/invitations/{token}/accept`.
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
  - Public invitation verification is handled via `POST /api/v1/invitations/inspect` with `{ "token": "..." }` in the request body, eliminating URI-based token logging.
  - The legacy `GET /api/v1/invitations/{token}` route remains temporarily operational for backward compatibility, marked with a `Deprecation: true` header. *(See Section 6.5 for critical risk details).*
- **User Enumeration Timing Defense (SEC-05):**
  - `LoginUserAction` executes a dummy 12-round Bcrypt comparison when an email is not found, substantially reducing timing discrepancies compared to an immediate return. *(See Section 6.6 for realistic assessment).*
- **Orphaned Token Table Exhaustion Defense (SEC-06):**
  - `SendPasswordResetLinkAction` queries user existence prior to inserting into `password_reset_tokens`. Non-existent emails trigger no database writes while returning a generic 200 response.
- **Collaborative Directory Separation (SEC-07):**
  - Administrative user lists (`GET /api/v1/users`) require `users.view`.
  - General member lookup uses `GET /api/v1/users/directory` requiring `users.view_directory`, exposing sanitized collaboration fields (`id`, `name`, `email`, `avatar_url`, `timezone`, `job_title`, `department`). *(See Section 6.7 for privacy considerations).*
- **Frontend Action Link Redirection (SEC-08):**
  - Password reset and invitation emails generate action links directed to the frontend SPA (`config('app.frontend_url')`).

### 6.4 Rate Limiting Quotas
- Global API: 60 requests / minute (User ID or Client IP).
- Login: 5 attempts / minute (Email + Client IP).
- Password Reset: 5 requests / minute (Client IP).
- Invitations: 10 requests / minute (User ID or Client IP).
- Token Inspection: 30 requests / minute (Client IP).

### 6.5 Legacy Route Token Exposure Analysis (SEC-04 Technical Truth)
- **Current State:** The legacy route `GET /api/v1/invitations/{token}` is **still operational**.
- **Security Exposure:** The route accepts the raw 64-character unauthenticated credential directly in the URL path.
- **Header Limitation:** Emitting the `Deprecation: true` response header notifies HTTP clients that the endpoint is deprecated, but **does NOT prevent the raw token from being logged** across web server access logs (Nginx/Apache), reverse proxy logs (Cloudflare, AWS ALB), browser histories, or HTTP Referrer headers.
- **Remediation & Removal Milestone:** The newly introduced `POST /api/v1/invitations/inspect` endpoint passes the token within the JSON body, eliminating URL exposure. The legacy `GET` endpoint must be completely decommissioned and removed from `routes/api.php` prior to public production deployment (recommended by Phase 6 or Phase 7).

### 6.6 Authentication Timing Protection Reality (SEC-05 Technical Truth)
- **Implementation:** `LoginUserAction` executes `Hash::check($password, '$2y$12$...')` when `$user === null` to mitigate gross timing attacks (avoiding a ~2ms immediate return vs a ~250ms Bcrypt hash).
- **Realistic Security Assessment:** This is a **heuristic timing mitigation**, NOT a mathematically guaranteed constant-time algorithm.
- **Sources of Discrepancy:**
  1. Database query duration varies between cache hits, index lookups, and missing rows.
  2. Eager-loaded relations (`roles.permissions`, `profile`) run additional queries when `$user` is found, which do not run when `$user` is null.
  3. PHP runtime garbage collection, OS thread scheduling, and network latency introduce timing jitter.
- Therefore, the system mitigates timing disparity to an extent that makes remote network-based enumeration impractical, but it does **not** provide mathematical constant-time guarantees.

### 6.7 User Directory Privacy Analysis (SEC-07 Policy Truth)
- **Current State:** `GET /api/v1/users/directory` uses `UserDirectoryResource` and exposes: `id`, `name`, `email`, `avatar_url`, `timezone`, `job_title`, and `department`.
- **Policy Enforcement:** Accessible by any authenticated, active user with `users.view_directory` (assigned to Member, Team Leader, Project Manager, System Admin).
- **Open Product Decision:** Exposing `email` to all organizational members facilitates cross-team collaboration, but in strict privacy or multi-tenant corporate settings, global email disclosure might violate internal data minimization standards.
- **Action Required:** Product ownership must explicitly decide before Phase 10 whether:
  1. Email visibility remains open to all organization members;
  2. Email visibility should be restricted to users who share a common project/team;
  3. Users should be given a profile-level privacy toggle (`show_email_in_directory`).
  *(In accordance with Phase 5.3 rules, no code changes have been made to the resource or permissions; this policy decision is flagged for product owner review).*

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
- Contextual Project Roles (`owner`, `lead`, `member`, `viewer`) exist strictly within the boundary of a specific project (enum `ProjectMemberRole`). Team rosters use `TeamMemberRole` (`leader`, `member`).
- A user with the global `Member` role may be the `owner` of an individual project. Conversely, a global `Project Manager` does not possess write privileges to projects to which they have not been explicitly added as a member.
- **Two-Tier Authorization (Phase 6):** every contextual write requires BOTH the global permission (or System Admin bypass) AND a contextual role that permits the ability — enforced in policies (`App\Policies`) with `Gate::before`/`Gate::after` hooks in `AppServiceProvider`. Out-of-scope access returns `404` (never `403`) to avoid resource existence disclosure.

---

## 8. Implemented Modules Inventory

To maintain strict truth in documentation, modules are classified into three distinct implementation statuses:
1. **Implemented & Audited:** Complete end-to-end implementation (Routes, Controllers, Services, Actions, Policies, Resources, Automated Tests).
2. **Database Foundation Only:** Migrations, Eloquent Models, Factories, and Seeders exist. **APIs, Controllers, Actions, and Routes DO NOT EXIST.**
3. **Planned:** Scheduled for future roadmap phases.

### 8.1 Implemented & Audited Modules

#### Module 1: Authentication & User Profile
- **Status:** `IMPLEMENTED` | `TESTED` | `AUDITED` | `HARDENED`
- **Main Responsibilities:** User login, logout, device token invalidation, profile inspection (`/auth/me`), profile updates (`/auth/me/profile`), password reset, password modification.
- **Routes (8):**
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/logout`
  - `POST /api/v1/auth/logout-all`
  - `GET /api/v1/auth/me`
  - `PUT /api/v1/auth/me/profile`
  - `POST /api/v1/auth/forgot-password`
  - `POST /api/v1/auth/reset-password`
  - `POST /api/v1/auth/change-password`
- **Models / Tables:** `User` (`users`), `UserProfile` (`user_profiles`), `password_reset_tokens`, `personal_access_tokens`
- **Tests:** `tests/Feature/Auth/LoginTest.php`, `tests/Feature/Auth/PasswordResetTest.php`, `tests/Feature/Auth/ProfileTest.php`
- **Docs:** [`docs/api/AUTH.md`](file:///c:/Hirgal/docs/api/AUTH.md)

#### Module 2: User Administration & Directory
- **Status:** `IMPLEMENTED` | `TESTED` | `AUDITED` | `HARDENED`
- **Main Responsibilities:** Administrative user listing, individual user inspection, profile & role updates, user account activation, deactivation with token revocation, team collaboration directory.
- **Routes (6):**
  - `GET /api/v1/users` (Admin list)
  - `GET /api/v1/users/directory` (Collaboration directory)
  - `GET /api/v1/users/{id}`
  - `PUT /api/v1/users/{id}`
  - `POST /api/v1/users/{id}/activate`
  - `POST /api/v1/users/{id}/deactivate`
- **Models / Tables:** `User` (`users`), `Role` (`roles`), `user_roles`
- **Policies / Permissions:** `UserPolicy`, permissions: `users.view`, `users.view_directory`, `users.update`, `users.delete`
- **Tests:** `tests/Feature/Users/UserManagementTest.php`, `tests/Feature/Security/SecurityHardeningTest.php`
- **Docs:** [`docs/api/USERS.md`](file:///c:/Hirgal/docs/api/USERS.md)

#### Module 3: User Invitations & Onboarding
- **Status:** `IMPLEMENTED` | `TESTED` | `AUDITED` | `HARDENED`
- **Main Responsibilities:** Dispatch onboarding invitations, token inspection via POST body, invitation resending, revocation, single-use acceptance.
- **Routes (7):**
  - `POST /api/v1/invitations/inspect` (Preferred body inspect)
  - `GET /api/v1/invitations/{token}` (Deprecated URL inspect)
  - `POST /api/v1/invitations/{token}/accept`
  - `GET /api/v1/invitations`
  - `POST /api/v1/invitations`
  - `POST /api/v1/invitations/{id}/resend`
  - `DELETE /api/v1/invitations/{id}`
- **Models / Tables:** `UserInvitation` (`user_invitations`), `User` (`users`), `Role` (`roles`)
- **Policies / Permissions:** `UserInvitationPolicy`, permission: `users.invite`
- **Tests:** `tests/Feature/Users/UserInvitationManagementTest.php`, `tests/Feature/Auth/InvitationAcceptanceTest.php`, `tests/Feature/Security/SecurityHardeningTest.php`
- **Docs:** [`docs/api/INVITATIONS.md`](file:///c:/Hirgal/docs/api/INVITATIONS.md)

#### Module 4: Projects & Membership
- **Status:** `IMPLEMENTED` | `TESTED` | `AUDITED`
- **Main Responsibilities:** Project CRUD, archive/restore lifecycle, membership listing/addition/role updates/removal, project-scoped task creation, project-team allocation listing.
- **Routes (15):**
  - `GET|POST /api/v1/projects`
  - `GET|PUT|DELETE /api/v1/projects/{project}` (UUID-bound)
  - `POST /api/v1/projects/{project}/archive`
  - `POST /api/v1/projects/{project}/restore` (soft-deleted, `withTrashed`)
  - `GET|POST /api/v1/projects/{project}/members`
  - `PUT|DELETE /api/v1/projects/{project}/members/{member}`
  - `GET /api/v1/projects/{project}/teams`
  - `POST|DELETE /api/v1/projects/{project}/teams/{team}` (allocate/deallocate)
  - `POST /api/v1/projects/{project}/tasks`
- **Models / Tables:** `Project` (`projects`), `ProjectMember` (`project_members`), `ProjectTeam` (`project_teams`)
- **Policies / Permissions:** `ProjectPolicy`, `ProjectMemberPolicy`; global permissions `projects.view/create/update/delete/archive`; contextual roles `owner|lead|member|viewer` (viewer is read-only; `owner` role rejected on membership writes).
- **Invariants:** allocation requires team roster ⊆ project members (incl. `owner_id`); removing a user who is the designated leader of an allocated team is rejected (`422`).
- **Tests:** `tests/Feature/Projects/ProjectManagementTest.php` (19), `tests/Feature/Projects/ProjectMembershipTest.php` (18)

#### Module 5: Teams & Project Allocation
- **Status:** `IMPLEMENTED` | `TESTED` | `AUDITED`
- **Main Responsibilities:** Team CRUD, roster management (add/update role/remove), team listing scoped to leader/roster/shared projects, project-team allocation.
- **Routes (9):**
  - `GET|POST /api/v1/teams`
  - `GET|PUT|DELETE /api/v1/teams/{team}` (UUID-bound)
  - `GET|POST /api/v1/teams/{team}/members`
  - `PUT|DELETE /api/v1/teams/{team}/members/{member}`
- **Models / Tables:** `Team` (`teams`), `TeamMember` (`team_members`), `ProjectTeam` (`project_teams`)
- **Policies / Permissions:** `TeamPolicy`, `TeamMemberPolicy`; global permissions `teams.view/create/update/delete`; contextual roles `owner|lead|member|viewer` for allocation authority (`projects.update` + `owner|lead`).
- **Invariants:** adding a team member requires the candidate to be a member of every allocated project; changing `leader_id` requires the new leader to be in every allocated project; allocation of a team outside the actor's scope returns `404`.
- **Tests:** `tests/Feature/Teams/TeamManagementTest.php`, `tests/Feature/Teams/TeamMembershipTest.php`, `tests/Feature/Teams/TeamProjectAllocationTest.php` (38 total)

#### Module 6: Tasks & Assignments
- **Status:** `IMPLEMENTED` | `TESTED` | `AUDITED` | `HARDENED`
- **Main Responsibilities:** Task listing with filters (`project`, `team`, `status`, `priority`, `assignee`), task CRUD with subtask parenting, bulk assignment, single unassignment, `completed_at` lifecycle sync.
- **Routes (6):**
  - `GET /api/v1/tasks` (filters via query string)
  - `GET|PUT|DELETE /api/v1/tasks/{task}` (UUID-bound)
  - `POST /api/v1/tasks/{task}/assign`
  - `DELETE /api/v1/tasks/{task}/assignees/{user}`
- **Models / Tables:** `Task` (`tasks`), `TaskAssignment` (`task_assignments`)
- **Policies / Permissions:** `TaskPolicy`, `TaskAssignmentPolicy`; global permissions `tasks.view/create/update/delete/assign`; contextual roles `owner|lead|member|viewer` (viewer read-only; assignment additionally allowed for the task creator).
- **Rules:** `parent` and `assignees` must belong to the same project (`422` otherwise); setting status `done` stamps `completed_at`, reverting clears it; duplicate assignments are idempotent; tasks of soft-deleted projects are excluded from all listings and resolve to `404` on direct access (restoring the project restores visibility); the `assignees/{user}` route identifier must be an integer (`422` otherwise).
- **Tests:** `tests/Feature/Tasks/TaskManagementTest.php` (22), `tests/Feature/Tasks/TaskAssignmentTest.php` (13), `tests/Feature/Tasks/TaskProjectSoftDeleteTest.php` (13)

#### Cross-Cutting Phase 6 Authorization
- **Test:** `tests/Feature/Api/V1/Phase6AuthorizationTest.php` (48 tests) verifies `401` on all Phase 6 endpoints, `403 ACCOUNT_NOT_ACTIVE` for suspended accounts, `404 RESOURCE_NOT_FOUND` across 19 cross-scope route/verb combinations, UUID-only route binding, and the standard error/success envelopes.

---

### 8.2 Database Foundations Only (APIs NOT Implemented)

> **WARNING FOR FUTURE AGENTS:** The following modules have completed database schemas, Eloquent models, factories, and seeders from Phase 4. **No API routes, controllers, or actions exist for these domains.** Do NOT attempt to query or integrate against endpoints for these modules until their respective phases are executed.

| Domain Module | Database Tables | Eloquent Models | API Route Status | Planned Roadmap Phase |
| :--- | :--- | :--- | :---: | :---: |
| **Global RBAC Management** | `roles`, `permissions`, `role_permissions`, `user_roles` | `Role`, `Permission` | **NO API ROUTES** | Phase 5.2 (Permissions Seeded Only) |
| **Project Invitations** | `project_invitations` | `ProjectInvitation` | **NO API ROUTES** | Deferred (Phase 6 covered projects/memberships only) |
| **Task Comments & Attachments** | `task_comments`, `task_attachments` | `TaskComment`, `TaskAttachment` | **NO API ROUTES** | Deferred (Phase 6 covered tasks/assignments only) |
| **Appointments & Scheduling** | `appointments`, `appointment_participants` | `Appointment`, `AppointmentParticipant` | **NO API ROUTES** | **Phase 7** |
| **Habit Tracker** | `habits`, `habit_logs` | `Habit`, `HabitLog` | **NO API ROUTES** | **Phase 8** |
| **Follow-Up Inbox & Mentions** | `user_mentions`, `notifications` | `UserMention` | **NO API ROUTES** | **Phase 9** |
| **Activity Auditing & Logs** | `activity_logs` | `ActivityLog` | **NO API ROUTES** | **Phase 9** |

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
Verified directly via live runtime execution on 2026-11-03 (post-Phase 6.2; Phase 6 baseline was 260 tests / 963 assertions):
- **Total Tests:** 273
- **Passing Tests:** 273 (100% green)
- **Total Assertions:** 1052
- **Failures / Errors:** 0
- **Execution Time:** ~33 seconds

### 10.3 Test Suite Breakdown
1. `tests/Unit`: 1 test, 1 assertion.
2. `tests/Feature/Auth`: 30 tests, 138 assertions (Registration, Login, Logout, Profile, Passwords, Invitations).
3. `tests/Feature/Users`: 17 tests, 74 assertions (CRUD, Activation, Deactivation, Invitations).
4. `tests/Feature/Projects`: 37 tests, 112 assertions (Project management, membership, contextual authorization).
5. `tests/Feature/Teams`: 38 tests, 105 assertions (Team management, rosters, project allocation invariants).
6. `tests/Feature/Tasks`: 48 tests, 178 assertions (Task CRUD, lifecycle, assignment/unassignment, soft-deleted-project access hardening).
7. `tests/Feature/Database`: 26 tests, 126 assertions (Relationships, Schema constraints, Seeders, MySQL composite keys).
8. `tests/Feature/Security`: 23 tests, 97 assertions (Security regression tests SEC-01 through SEC-08).
9. `tests/Feature/Api`: 52 tests, 220 assertions (Connection, Health checks, envelope structure, Phase 6 cross-cutting authorization).
10. `tests/Feature/ExampleTest.php`: 1 test, 1 assertion.

### 10.4 SQLite vs MySQL Testing Reality
- **SQLite In-Memory (`:memory:`):** Executes the full feature/unit test suite (273 tests) in `phpunit.xml`.
- **MySQL 8 (`hirgal_backend_test`):** Specifically verified by [`tests/Feature/Database/MySQLCompositeConstraintTest.php`](file:///c:/Hirgal/tests/Feature/Database/MySQLCompositeConstraintTest.php) (2 tests):
  1. `test_mysql8_enforces_composite_foreign_key_on_habit_logs`: Validates cross-user tampering rejection on `(habit_id, user_id)`.
  2. `test_mysql8_composite_foreign_key_cascades_on_habit_delete`: Validates cascading deletes on composite foreign keys under MySQL InnoDB.
- **Pessimistic Row Locking Concurrency Status (`NOT VERIFIED` under multi-process contention):**
  - Pessimistic row locking syntax (`Role::lockForUpdate()`) is verified transactionally in `SecurityHardeningTest.php`.
  - However, **true multi-process concurrent lock contention** (two concurrent PHP processes simultaneously executing deactivation requests on MySQL) is `NOT VERIFIED` via automated concurrency tests because PHPUnit runs as a single synchronous process.

---

## 11. Completed Phases & Audit Milestones

| Phase | Title | Milestone Type | Date | Status | Git Commit | Key Achievements / Findings |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **Phase 1** | Architecture Blueprint | Architecture | 2026-10-30 | **ACCEPTED** | — | System requirements, modular design, domain boundaries. |
| **Phase 2** | Backend Foundation & Scaffolding | Implementation | 2026-10-31 | **ACCEPTED** | — | Laravel 13 setup, Sanctum, ApiResponse envelope, Health API. |
| **Phase 3** | Database Design & ERD | Architecture | 2026-10-31 | **ACCEPTED** | — | Complete 32-table schema, indexing strategy, data dictionary. |
| **Phase 3.1** | Database Design Corrections | Architecture | 2026-10-31 | **ACCEPTED** | — | Schema reconciliation, habit composite FK, seeder plans. |
| **Phase 4** | Database Implementation | Implementation | 2026-10-31 | **ACCEPTED** | `0c9582b` | 14 migrations, 23 Eloquent models, factories, seeders. |
| **Phase 4.1** | Database Implementation Audit | Read-Only Audit | 2026-10-31 | **ACCEPTED** | — | Audit identified production seeder risks & table inventory gap. |
| **Phase 4.2** | Seeder Safety & Reconciliation | Implementation | 2026-10-31 | **ACCEPTED** | `e6c9111` | Environment safety guards on seeders, table classification. |
| **Phase 5** | Auth & User Management API | Implementation | 2026-10-31 | **ACCEPTED** | `b9e913e` | Implemented 21 endpoints, Actions/Services/Controllers. |
| **Phase 5.1** | Security Audit | Read-Only Audit | 2026-10-31 | **FAILED** | — | Independent audit identified vulnerabilities SEC-01 to SEC-08. |
| **Phase 5.2** | Security Hardening & Remediation | Implementation | 2026-11-02 | **ACCEPTED** | `2a571ee` | Remediated SEC-01 to SEC-08, 23 regression tests (102 total). |
| **Phase 5.2 Docs** | Permanent Context Documentation | Documentation | 2026-11-02 | **ACCEPTED** | `3556549` | Created root `PROJECT_CONTEXT.md` living guide. |
| **Phase 5.3** | Context Audit & Reconciliation | Documentation Audit | 2026-11-02 | **ACCEPTED** | `3556549`+ | Reconciled implemented vs planned modules and security risks. |
| **Phase 6** | Projects, Teams & Tasks Management APIs | Implementation | 2026-11-02 | **ACCEPTED** | `77e62b4` | 30 endpoints, 6 policies, 21 actions, 3 services, 5 resources, 16 form requests, 158 new tests (260 total). Fixed enum-cast bug in `ProjectPolicy::contextualRole`. |
| **Phase 6.1** | Independent Security & Implementation Audit | Read-Only Audit | 2026-11-03 | **CONDITIONALLY PASSED** | — | Re-verified 30 routes / 6 policies / invariants; identified F-1 (500 on soft-deleted-project task endpoints, MEDIUM), F-2/F-3/F-4/F-6 (LOW), F-5 flagged for product decision. |
| **Phase 6.2** | Task Access Hardening & Doc Corrections | Security Remediation | 2026-11-03 | **ACCEPTED** | `d7e0916` | Null-safe project scoping resolves soft-deleted-project task access to 404 (F-1/F-2); task listings exclude soft-deleted projects (F-3); assignee route identifier validated → 422 (F-4); 13 regression tests (273 total); documentation counts corrected (5 resources, 19 cross-scope, `project_invitations` deferred row). |

---

## 12. Current Project Status

- **Latest Completed Phase:** Phase 6.2 (Task Access Hardening & Documentation Corrections).
- **Latest Accepted Implementation:** Phase 6.2 (Commit `d7e0916`; prior baseline `77e62b4` for Phase 6).
- **Current Development Phase:** Phase 6.2 Complete — awaiting authorization for Phase 7.
- **Remaining Work:**
  - Phase 7: Appointments & Scheduling API.
  - Phase 8: Habit Tracker API.
  - Phase 9: Follow-Up Inbox, Mentions & Activity Logging.
  - Phase 10: Production Readiness, Performance Optimization & Final Security Audit.
- **Pending Audits:** None.
- **Known Blockers:** None.
- **Frontend Status:** Frontend Phases 1 and 2 foundations are implemented under `frontend/`. The responsive shell, theme system, reusable components, and development-only showcase do not implement business functionality. Feature screens and API integrations remain subject to explicit authorization and verified backend API readiness.

---

## 13. Known Issues & Technical Debt

1. **Invitation GET Route Deprecation (Security Debt):** `GET /api/v1/invitations/{token}` remains operational for backwards compatibility with a `Deprecation: true` header. This endpoint leaks raw tokens in web server logs. It must be permanently deleted prior to production release.
2. **Directory Privacy Decision (Policy Debt):** `GET /api/v1/users/directory` exposes member email addresses globally across all active users. A formal product owner decision is required before Phase 10 on whether email should remain globally visible or be restricted to project collaborators.
3. **Multi-Node Concurrency Scaling (Architectural Debt):** `Role::lockForUpdate()` provides serialization across single MySQL instances. If the platform migrates to a distributed or clustered database setup, an atomic distributed lock (Redis/Cache lock) will be required.
4. **Public Registration Disabled:** `config('auth.allow_registration')` is `false` by default; platform onboarding relies strictly on administrative invitations. Public registration flows require further review before production enablement.
5. **Team Leadership Transfer Roster Behavior (Product Decision Pending):** `UpdateTeamAction` preserves the previous leader's `team_members` row as `leader` when `leader_id` changes (co-leader retention) and does not upgrade an existing roster row's role. This matches the tested co-leader design but was flagged in the Phase 6.1 audit (F-5). A product owner decision is required: keep explicit co-leader behavior, auto-demote the previous leader, or keep role-preservation with clearer documentation. No code change was made in Phase 6.2.
6. **Scalar Integer Route Parameter Outside Phase 6 Scope:** `DELETE /api/v1/invitations/{id}` still type-hints `int $id`; a non-numeric identifier can produce a `500` TypeError — the same defect class as Phase 6.2 F-4, which fixed `DELETE /api/v1/tasks/{task}/assignees/{user}`. Remediate before Phase 10.

---

## 14. Development Roadmap

1. **Phase 6: Projects, Teams & Task Management API** — ✅ **COMPLETED (2026-11-02).**
   - Projects CRUD + archive/restore, project membership roles, project-team allocation.
   - Teams CRUD, team rosters, multi-team project allocation with roster invariants.
   - Tasks CRUD, subtask parenting, task assignments/unassignments, status lifecycle.
   - *Deferred from original scope:* project invitations, task comments, attachments (database-only).
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

1. **Backend-First Development:** Do not write frontend feature screens or business integrations without explicit user authorization and verified backend API contracts. Frontend Phases 1 and 2 are limited to foundation, design system, and development tooling.
2. **Verify Before Coding:** Always read `PROJECT_CONTEXT.md` and inspect actual files, routes, and tests before making modifications.
3. **Preserve Architecture:** Adhere strictly to Actions → Services → Controllers, Form Requests, Policies, and `ApiResponse`. Never put business logic in controllers or API resources.
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
| **2026-10-31** | Phase 4.1 | — | Audit Report | Read-only database audit identifying seeder production risks. | — | Audit report artifact |
| **2026-10-31** | Phase 5 | `b9e913e` | `app/Http/`, `app/Actions/`, `routes/api.php` | 21 endpoints for Auth, Users, and Invitations. | 79 tests | `docs/api/*` |
| **2026-10-31** | Phase 5.1 | — | Security Audit | Read-only security audit identifying vulnerabilities SEC-01 through SEC-08 (FAILED). | — | Audit report artifact |
| **2026-11-02** | Phase 5.2 | `2a571ee` | `app/`, `config/`, `routes/`, `tests/Feature/Security/` | Remediated SEC-01 to SEC-08, added 23 regression tests, Pint formatted. | 102 tests | `docs/api/*`, acceptance report |
| **2026-11-02** | Phase 5.2 Docs | `3556549` | `PROJECT_CONTEXT.md` | Created permanent root-level living documentation file for all future agents. | 102 tests | `PROJECT_CONTEXT.md` |
| **2026-11-02** | Phase 5.3 | `3556549` | `PROJECT_CONTEXT.md` | Reconciled implemented vs planned modules, token security reality, directory privacy, timing mitigation nuances, and multi-process lock status. | 102 tests | `PROJECT_CONTEXT.md` |
| **2026-11-02** | Phase 6 | `77e62b4` | `app/Actions/{Projects,Teams,Tasks}`, `app/Services/{Project,Team,Task}`, `app/Http/{Controllers,Requests,Resources}/Api/V1`, `app/Policies`, `routes/api.php`, `tests/Feature/{Projects,Teams,Tasks,Api}` | 30 REST endpoints for Projects (15), Teams (9), Tasks (6); 6 policies, 21 actions, 3 services, 5 resources, 16 form requests; UUID route binding; two-tier contextual authorization; fixed enum-cast bug in `ProjectPolicy::contextualRole`. | 260 tests | `PROJECT_CONTEXT.md` |
| **2026-11-02** | Phase 6 Docs | `8dc1f75` | `PROJECT_CONTEXT.md` | Recorded Phase 6 commit hash in header, Sections 11 and 12. | 260 tests | `PROJECT_CONTEXT.md` |
| **2026-11-03** | Phase 6.1 | — | Audit Report | Independent read-only audit; CONDITIONALLY PASSED with F-1 (MEDIUM, dynamically proven) and F-2/F-3/F-4/F-6 (LOW) findings; F-5 flagged for product decision. | 260 tests | Audit report artifact |
| **2026-11-03** | Phase 6.2 | `d7e0916` | `app/Policies/ProjectPolicy.php`, `app/Http/Requests/Api/V1/Tasks/*`, `app/Http/Controllers/Api/V1/Tasks/TaskAssignmentController.php`, `app/Services/Task/TaskService.php`, `tests/Feature/Tasks/TaskProjectSoftDeleteTest.php`, `PROJECT_CONTEXT.md` | Null-safe project scoping (soft-deleted project → 404, no TypeErrors), task listings exclude soft-deleted projects, assignee identifier validation → 422; 13 regression tests; doc corrections (5 resources, 19 cross-scope, `project_invitations` row, F-5 known issue). | 273 tests | `PROJECT_CONTEXT.md` |
| **2026-11-04** | Project Structure Cleanup | — | Repository root, `README.md`, `PROJECT_CONTEXT.md` | Removed the redundant nested `Hirgal-backend/` snapshot after verifying all tracked files and history were represented in the canonical root; documented the single-root layout. No application behavior or future-phase assets changed. | 273 tests | `README.md`, `PROJECT_CONTEXT.md` |
| **2026-11-04** | Frontend Phase 1 | — | `frontend/`, `README.md`, `PROJECT_CONTEXT.md` | Added an isolated React 19/TypeScript/Vite foundation with strict typing, Tailwind 4/shadcn-compatible primitives, routing/query providers, typed Axios API contracts and errors, memory-only bearer-token plumbing, tests, and setup documentation. No Laravel application files or API contracts changed. | 11 frontend tests; strict typecheck, Oxlint, and production build passed; `npm audit --omit=dev` reported 0 vulnerabilities | `frontend/README.md`, `README.md`, `PROJECT_CONTEXT.md` |
| **2026-11-04** | Frontend Phase 2 | — | `frontend/src/components/`, `frontend/src/styles/`, `frontend/src/app/`, `frontend/docs/`, frontend docs | Added semantic light/dark/system themes, shared accessible controls and feedback/data components, responsive navigation shell, and a development-only showcase. No business API calls or backend changes. | 16 frontend tests; typecheck, Oxlint, and production build passed; development route/component absent from production assets; production dependency audit reported 0 vulnerabilities | `frontend/docs/DESIGN_SYSTEM.md`, `frontend/README.md`, `README.md`, `PROJECT_CONTEXT.md` |
| **2026-11-05** | Frontend Phase 3.1 | `4dc6901` baseline | `frontend/` | Audited current Phase 3 auth against Laravel contracts; connected auth pages and guards to routes; fixed Radix `Button asChild` child handling and stale-request token cleanup; added auth behavior/permission/redirect coverage and authentication documentation. No Laravel files or contracts changed. | 40 frontend test cases; typecheck, lint, test, build, and production dependency audit results recorded in `frontend/docs/AUTHENTICATION.md` | `frontend/docs/AUTHENTICATION.md`, `frontend/README.md`, `PROJECT_CONTEXT.md` |

## 17. Frontend Foundation

### 17.1 Frontend Phase 1 Status
- **Status:** Frontend Phase 1 foundation retained; feature screens and feature API integrations remain deferred.
- **Location:** `frontend/` is an independent Vite application. The Laravel application and its root Composer/npm manifests remain at `C:\Hirgal`.
- **Stack:** React 19, TypeScript strict mode, Vite, Tailwind CSS 4, shadcn/ui-compatible component configuration, React Router, TanStack Query, Axios, React Hook Form, Zod, and Lucide React.
- **Architecture:** `src/app` owns application configuration, router, and providers; `src/services/api` owns API contracts, Axios configuration, bearer-token plumbing, and normalized errors; UI primitives and feedback states live in `src/components`; future domain code belongs in `src/features/{auth,users,projects,teams,tasks}`.
- **Backend contract:** Laravel responses use `{ success, message, data }` with optional pagination metadata, or `{ success: false, message, errors, error_code? }`. Auth uses Sanctum Bearer tokens. `GET /api/v1/auth/me` returns the authenticated user; `POST /api/v1/auth/logout` revokes the current token. Authenticated inactive accounts are rejected by middleware with 403 `ACCOUNT_NOT_ACTIVE`; inactive login attempts return generic 403 `FORBIDDEN`. See `frontend/docs/AUTHENTICATION.md`, `frontend/README.md`, and `docs/api/AUTH.md`.
- **Credential handling:** The Sanctum bearer token exists only in JavaScript memory and does not persist credentials. A reload loses the token; the token remains accessible to JavaScript while the app is running. The implemented login and account flows are recorded in Section 17.3. Revisit persistence only after evaluating a backend-supported HttpOnly cookie/session design; never store bearer tokens in browser local storage by default.
- **Routing:** Frontend Phase 3.1 connects `/login`, password recovery, dashboard, profile, and password management to authentication flows. Dashboard/profile/password routes are protected. `/users`, `/projects`, `/teams`, and `/tasks` remain permission-gated placeholders and make no business API calls.
- **UI foundation:** Phase 2 extends the Tailwind tokens and reusable accessible component foundations. See Section 17.2 and `frontend/docs/DESIGN_SYSTEM.md`.
- **Testing:** `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` are the frontend verification commands.
- **CORS:** Backend `config/cors.php` currently allows local origins on port 5173 (as well as port 3000). If Vite selects a different port or deployment uses another origin, update the backend CORS allowlist only with separate authorization.
- **Out of scope:** No real project/team/task/user feature screens, feature API services, backend changes, or integrations for Phase 7–9 database-only domains were added.

### 17.2 Frontend Phase 2 — Design System
- **Status:** Implemented; no business screens or real feature integrations.
- **Visual language:** Neutral, system-first typography, restrained blue primary, semantic success/warning/error/information colors, dedicated navigation tokens, measured radius and elevation, and a consistent spacing scale.
- **Theme:** `ThemeProvider` supports light, dark, and system preferences. It stores only the display preference under `hirgal-theme`; it does not persist authentication credentials. An early document script applies the saved/system theme before React mounts.
- **Components:** Buttons, input/textarea/select, checkbox/radio/switch, form field/label, cards, alerts/badges/status, dialog/confirmation dialog, dropdown, popover, tooltip, tabs, toast, skeleton/spinner, empty/error states, avatar/group/user identity, table, pagination, progress, metadata, and layout primitives.
- **Navigation:** `AppShell` composes a configuration-driven sidebar, sticky top bar, theme switcher, breadcrumb, and main region. The mobile sidebar uses an accessible modal drawer. Unimplemented destinations are visibly marked as planned and do not call the backend.
- **Showcase:** `/dev/design-system` is registered only in Vite development mode. All data there is explicitly illustrative and static; the route makes no API requests.
- **Documentation:** `frontend/docs/DESIGN_SYSTEM.md` documents tokens, theme, components, responsive rules, accessibility, and showcase behavior.
- **Verification:** `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` are the frontend verification commands.

### 17.3 Frontend Phase 3.1 — Authentication Verification
- **Status:** Phase 3 authentication implementation verified and integrated into routing; known authentication limitations are recorded in `frontend/docs/AUTHENTICATION.md`.

### 17.4 Frontend Phase 4 — Dashboard, User Directory & User Administration
- **Status:** Dashboard and the existing user APIs are integrated into the frontend. Directory access uses `users.view_directory`; administrative lists/details use `users.view`; edit and activation/deactivation controls use backend permissions. No backend files or contracts changed.
- **Dashboard:** Uses the authenticated user payload only; no dashboard aggregate/activity API exists, so no synthetic metrics are shown.
- **User directory:** Uses `GET /api/v1/users/directory` and the sanitized directory resource. Search, department filter, pagination, loading/error/empty/retry states are included.
- **Administration:** Uses `GET /api/v1/users`, `GET /api/v1/users/{id}`, `PUT /api/v1/users/{id}`, and existing activation/deactivation actions. Role assignment is omitted because no roles-list endpoint exists. Self-status changes and protected System Admin behavior are handled in the UI while backend authorization remains authoritative.
- **Frontend feature details:** `frontend/docs/DASHBOARD.md`, `frontend/docs/USER_DIRECTORY.md`, and `frontend/docs/USER_ADMINISTRATION.md`.
- **Validation:** 48 tests across 10 files passed; typecheck and lint passed; production build succeeded with a 792.15 kB main JavaScript chunk advisory (Vite's threshold is 500 kB); production dependency audit reported zero vulnerabilities. Tests use mocks, with no live Laravel HTTP integration claimed.
- **Implemented flows:** Login, current-user retrieval, protected routing, sign out, profile update, forgot/reset password, and change password. Feature routes for users, projects, teams, and tasks remain placeholders.
- **Session security:** Sanctum bearer token stays in JavaScript memory only; reload clears the session. HTTP 401 clears the token. HTTP 403 clears it only for backend error code `ACCOUNT_NOT_ACTIVE`; generic `FORBIDDEN` does not log out the user. Logout clears local auth state and TanStack Query data even if server logout fails.
- **Permissions:** UI checks use the backend-provided effective global permission list. Global role slugs and contextual project roles are distinct. Frontend checks are not authorization; backend policies enforce private-data access and project membership.
- **Coverage:** Authentication UI and behavior tests use mocked API methods/Axios adapters; these are not live HTTP integration tests. The local Laravel server was unavailable at `127.0.0.1:8000` during the audit. Backend request behavior was cross-checked against route, request, controller, middleware, resource, policy, seeder, and Laravel feature-test code.
- **Verification:** Exact typecheck, lint, test, build, and `npm audit --omit=dev` outcomes are maintained in `frontend/docs/AUTHENTICATION.md`.
