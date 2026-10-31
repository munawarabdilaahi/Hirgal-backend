# Hirgal Security, Data Isolation & Authentication Architecture (27 Tables)

This document defines the defense-in-depth model, resource isolation mechanisms, IDOR protection, audit-log immutability, and authentication architecture for Hirgal.

---

## 1. Dissecting UUIDs, Identification, and Authorization

A critical architectural distinction must be maintained between **identity unpredictability** and **access authorization**:

| Dimension | Mechanism | What It Provides | What It DOES NOT Provide |
| :--- | :--- | :--- | :--- |
| **Identifier Unpredictability** | Public UUIDv4 (`uuid CHAR(36)`) | Prevents sequential integer enumeration (`/tasks/1`, `/tasks/2`) and automated crawling. | **Does NOT authorize access.** An attacker who intercepts or guesses a UUID still has zero rights to access it unless authorized. |
| **Authentication** | Laravel Sanctum (Cookies / Bearer Tokens) | Cryptographically establishes **WHO** the caller is (`$request->user()`). | **Does NOT determine WHAT** resources the user is permitted to view or mutate. |
| **Authorization** | Laravel Policies & Gates | Evaluates **WHAT** actions the authenticated user can perform on a specific model instance. | Requires explicit invocation at the request lifecycle boundary. |
| **Tenancy Isolation** | Explicit Project Scoping | Ensures queries physically filter out records outside the caller's authorized workspace boundary. | Relies on disciplined query authoring rather than database magic. |

> [!CAUTION]
> **Architectural Rule:** UUIDs must never be treated as an authorization token or secret key. Every single API route binding a UUID must pass through a strict Laravel Policy check (`$this->authorize('view', $resource)`) and tenant-scoped query verification.

---

## 2. Multi-Tier Authorization & Role Separation

Hirgal implements a **two-tiered authorization model** separating systemic capabilities from contextual project/team roles:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 1: Global System Roles (app/Models/Role)                          │
│ Scope: Entire Application Instance                                     │
│ Roles: System Admin | Project Manager | Team Leader | Member          │
│ Governs: User invitations, system roles, platform maintenance         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Evaluated alongside
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 2: Contextual Project & Team Roles (project_members, team_members) │
│ Scope: Specific Project or Team Boundary                               │
│ Roles: Owner | Lead | Member | Viewer                                  │
│ Governs: Tasks, comments, files, appointments inside that project      │
└────────────────────────────────────────────────────────────────────────┘
```

### Authorization Rule Enforcement:
1. **System Admin:** Holds the `*` wildcard capability. Bypasses contextual isolation for system maintenance via `Gate::before()` checks.
2. **Project Manager:** Holds global `projects.create` capability. However, creating a project does not grant access to *all* other projects. A Project Manager **cannot** view or edit projects owned by others unless explicitly added to `project_members`.
3. **Team Leader:** Manages only their designated teams where `teams.leader_id = user.id` or `team_members.role = 'leader'`.
4. **Member:** Default system role. Zero administrative privileges. Access is strictly confined to projects and teams where a verified membership record exists.
5. **Project-Level Role Independence:** Global roles do not automatically confer project ownership. A user with global `Member` role can be the `Owner` of a specific project they originated.

---

## 3. Project Data Isolation: Explicit Scopes vs Global Eloquent Scopes

### Evaluation of Global Eloquent Query Scopes:
While global scopes (`addGlobalScope`) appear convenient on paper, in complex enterprise platforms they introduce severe architectural hazards:
- **Background Jobs & Queue Workers:** Asynchronous jobs execute in CLI context without an authenticated session (`Auth::user() === null`). Global scopes referencing `Auth::user()` crash jobs or silently return zero records.
- **Scheduled Console Commands & Cron:** Maintenance commands (e.g. archiving completed projects or indexing tasks) require access across all tenants. Forcing developers to remember `withoutGlobalScopes()` creates high risk of human error.
- **System Administrator Overrides:** Bypassing global scopes for administrators requires sprawling conditionals across model boots.
- **Cross-Project Dashboards & Reporting:** Aggregating metrics across multiple projects triggers unexpected query alterations.
- **Eager-Loading Leakage:** Global scopes on joined relations can cause subtle query pruning and partial object hydration.

### The Hirgal Standard: Explicit Project Scopes + Laravel Policies

Hirgal adopts **Explicit Query Scoping** combined with **Mandatory Laravel Policies**:

1. **Explicit Scoped Queries:**
   Repository and query builder methods explicitly declare tenancy parameters:
   ```php
   // Scoped to project and authenticated user membership
   public function getTasksForKanban(Project $project, User $user, TaskStatus $status): Collection
   {
       return $project->tasks()
           ->where('status', $status)
           ->orderBy('order_column')
           ->get();
   }
   ```
2. **Mandatory Policy Authorization:**
   Every controller and action invokes policy checks before execution:
   ```php
   public function show(Project $project, Task $task): JsonResponse
   {
       $this->authorize('view', $project);
       $this->authorize('view', $task);

       // Verify task strictly belongs to the resolved project (anti-tampering)
       abort_if($task->project_id !== $project->id, 404);

       return ApiResponse::success(new TaskResource($task));
   }
   ```
3. **Assignment Integrity Verification:**
   A task cannot be assigned to an arbitrary user. In `AssignTaskRequest`:
   ```php
   public function rules(): array
   {
       return [
           'user_id' => [
               'required',
               'integer',
               Rule::exists('project_members', 'user_id')->where(function ($query) {
                   $query->where('project_id', $this->project->id);
               }),
           ],
       ];
   }
   ```

---

## 4. Habit Log Relational Ownership Integrity

To mathematically prevent a malicious user from recording a completion log against another user's habit, the database enforces a **Composite Foreign Key**:

```
HABITS (id, user_id) [UNIQUE KEY habits_id_user_id]
   ▲
   │ FOREIGN KEY (habit_id, user_id) REFERENCES habits(id, user_id) ON DELETE CASCADE
   │
HABIT_LOGS (habit_id, user_id)
```

### Defense Layers:
1. **Database Layer (Storage Engine):** The MySQL 8 InnoDB engine guarantees that the tuple `(habit_id, user_id)` in `habit_logs` must exist in `habits`. If user `5` attempts to insert a record with `habit_id = 99` (owned by user `8`) and `user_id = 5`, MySQL physically aborts the transaction with foreign key constraint violation `SQLSTATE[23000]`.
2. **Application Layer (Policies & Requests):** `HabitLogPolicy` verifies `$habit->user_id === $user->id` prior to dispatching the creation action.

---

## 5. Audit-Log Protection & Practical Immutability

The `activity_logs` table stores an append-only audit trail capturing administrative, security, and domain events.

### Practical Immutability Architecture:
1. **Creation Permissions:**
   - Audit records are generated exclusively by internal application events or the centralized `ActivityLogger` service.
   - No public `POST /api/v1/activity-logs` endpoint exists. Client input can never directly forge audit entries.
2. **Read Permissions:**
   - Viewing activity logs is restricted by `ActivityLogPolicy` to users holding the `audit.view` permission (System Admins) or individual users viewing their own actor timeline (`user_id = auth()->id()`).
3. **Update and Delete Restrictions:**
   - **Application Layer:** The `App\Models\ActivityLog` Eloquent model disables standard timestamps (`$timestamps = false;` only `created_at` exists). In the model boot listener, attempting to call `update()` or `delete()` throws an immutable model exception:
     ```php
     static::updating(function () {
         throw new \RuntimeException('Activity logs are append-only and cannot be modified.');
     });
     static::deleting(function () {
         throw new \RuntimeException('Activity logs cannot be deleted.');
     });
     ```
   - **API Layer:** Zero `PUT`, `PATCH`, or `DELETE` routes exist for activity logs.
   - **Database Layer:** The foreign key `users.id -> activity_logs.user_id` uses `ON DELETE SET NULL`. If a user is purged, their historical audit trail remains permanently preserved with `user_id = NULL`.
   - **Infrastructure Hardening (Production):** In production environments, database users allocated to web workers can be granted `SELECT` and `INSERT` privileges on `activity_logs` while omitting `UPDATE` and `DELETE` grants.

---

## 6. Authentication Architecture: Sanctum SPA Cookies vs PATs

Hirgal supports **Dual-Mode Hybrid Authentication**:

1. **Web SPA (Next.js / React / Vue):**
   - **Sanctum SPA Cookie Authentication**.
   - Credentials stored in `HttpOnly`, `SameSite=Lax`, secure browser cookies.
   - Completely immune to JavaScript XSS token exfiltration.
   - CSRF protection enforced automatically via `/sanctum/csrf-cookie` handshakes on all state-mutating HTTP methods.
2. **Mobile Apps & External Integrations:**
   - **Sanctum Personal Access Tokens (PAT)** via `Authorization: Bearer <token>`.
   - Client sends credentials to `POST /api/v1/auth/token` and receives a SHA-256 hashed bearer token.
   - Supports granular token abilities, custom expiration, and instant database revocation via token deletion.
