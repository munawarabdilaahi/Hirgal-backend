# User Management API Specification

- **Module:** User Directory & Administration
- **Prefix:** `/api/v1/users`
- **Authentication:** Required (`auth:sanctum`, `account.active`)

---

## 1. Endpoints Overview

| Method | Endpoint | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users` | `users.view` | Full administrative listing with filtering, sorting, and metadata. |
| `GET` | `/api/v1/users/directory` | `users.view_directory` | Basic member directory for team collaboration (sanitized fields). |
| `GET` | `/api/v1/users/{id}` | `users.view` (or self) | View specific user details and profile. |
| `PUT` | `/api/v1/users/{id}` | `users.update` | Update user attributes and global system role (Admin only). |
| `POST` | `/api/v1/users/{id}/activate` | `users.update` | Re-activate a suspended user account. |
| `POST` | `/api/v1/users/{id}/deactivate` | `users.delete` | Suspend user account and revoke all their tokens. |

---

## 2. Authorization Rules & Protective Constraints

1. **System Admin Account Protection:**
   - A non-admin user cannot edit, demote, or deactivate a user possessing the `system-admin` role.
   - The platform strictly forbids demoting or deactivating the **last remaining active System Administrator** to prevent catastrophic administrative lockouts.
   - All System Admin mutation actions execute under pessimistic database row locking (`Role::where('slug', 'system-admin')->lockForUpdate()`) inside atomic transactions to eliminate Time-of-Check to Time-of-Use (TOCTOU) race conditions.
2. **Privilege Escalation Prevention (SEC-01):**
   - Regular users (`Member`, `Team Leader`, `Project Manager`) cannot assign or escalate global roles.
   - Non-administrators cannot modify their own or others' `role_id` or `account_status` via `/api/v1/users/{id}`.
   - Self-profile modifications are strictly segregated and must be executed via `PUT /api/v1/auth/me/profile`.
3. **Self-Deactivation Prohibition:**
   - Users cannot deactivate or delete their own accounts via user management endpoints (`403 Forbidden`).
4. **Token Eviction on Deactivation:**
   - Calling `/users/{id}/deactivate` immediately revokes all active Sanctum tokens belonging to the target user.
5. **Directory Separation (SEC-07):**
   - General members querying `GET /api/v1/users` receive `403 Forbidden` unless granted `users.view`.
   - General members collaborate via `GET /api/v1/users/directory`, which strictly redacts administrative metadata (`account_status`, `email_verified_at`, `last_login_at`, `roles`, `permissions`).

---

## 3. Endpoint Details

### 3.1 List Users
- **Route:** `GET /api/v1/users`
- **Query Parameters:**
  - `search` (string, max 100): Matches user name or email.
  - `status` (enum: `active`, `suspended`, `pending`): Filters by account status.
  - `role` (string): Filters by role slug (e.g. `project-manager`).
  - `per_page` (int, 1-100, default: 15): Pagination page size.
  - `sort_by` (`id`, `name`, `email`, `created_at`, `last_login_at`, default: `created_at`).
  - `sort_direction` (`asc`, `desc`, default: `desc`).

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "User directory retrieved successfully.",
  "data": [
    {
      "id": 1,
      "name": "System Administrator",
      "email": "admin@hirgal.local",
      "account_status": "active",
      "avatar_url": null,
      "timezone": "UTC",
      "roles": [
        {
          "id": 1,
          "name": "System Admin",
          "slug": "system-admin"
        }
      ]
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 4
  }
}
```

---

### 3.2 Member Collaboration Directory
- **Route:** `GET /api/v1/users/directory`
- **Required Permission:** `users.view_directory` (granted to all active system roles)
- **Query Parameters:**
  - `search` (string, max 100): Matches name, email, job title, or department.
  - `department` (string, max 100): Filters by department.
  - `per_page` (int, 1-100, default: 20): Pagination page size.

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "User directory retrieved successfully.",
  "data": [
    {
      "id": 2,
      "name": "Sarah Lead",
      "email": "sarah.lead@hirgal.local",
      "avatar_url": null,
      "timezone": "UTC",
      "job_title": "Lead Backend Architect",
      "department": "Engineering"
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 20,
    "total": 4
  }
}
```

---

### 3.3 View Individual User
- **Route:** `GET /api/v1/users/{id}`
- **Permissions:** `users.view` or self (`$actor->id === $target->id`).

---

### 3.4 Update User & System Role
- **Route:** `PUT /api/v1/users/{id}`
- **Required Permission:** `users.update` (Role/status modifications strictly restricted to System Admins)

#### Request Body
```json
{
  "name": "Alex Updated",
  "email": "alex.lead@hirgal.local",
  "role_id": 2,
  "account_status": "active",
  "timezone": "America/Chicago"
}
```

---

### 3.5 Activate User Account
- **Route:** `POST /api/v1/users/{id}/activate`
- **Required Permission:** `users.update`

Sets `account_status` to `active`.

---

### 3.6 Deactivate User Account
- **Route:** `POST /api/v1/users/{id}/deactivate`
- **Required Permission:** `users.delete`

Sets `account_status` to `suspended` and immediately evicts all active Sanctum tokens. Last active System Admin cannot be deactivated.

---

### 3.5 Deactivate User Account
- **Route:** `POST /api/v1/users/{id}/deactivate`
- **Required Permission:** `users.delete`

Sets `account_status` to `suspended` and purges all active Sanctum bearer tokens.
