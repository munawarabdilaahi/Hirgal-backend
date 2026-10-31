# User Management API Specification

- **Module:** User Directory & Administration
- **Prefix:** `/api/v1/users`
- **Authentication:** Required (`auth:sanctum`, `account.active`)

---

## 1. Endpoints Overview

| Method | Endpoint | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users` | `users.view` | Paginated listing with filtering and sorting. |
| `GET` | `/api/v1/users/{id}` | `users.view` (or self) | View specific user details and profile. |
| `PUT` | `/api/v1/users/{id}` | `users.update` | Update user attributes and global system role. |
| `POST` | `/api/v1/users/{id}/activate` | `users.update` | Re-activate a suspended user account. |
| `POST` | `/api/v1/users/{id}/deactivate` | `users.delete` | Suspend user account and revoke all their tokens. |

---

## 2. Authorization Rules & Protective Constraints

1. **System Admin Account Protection:**
   - A non-admin user cannot edit, demote, or deactivate a user possessing the `system-admin` role.
   - The platform strictly forbids demoting or deactivating the **last remaining active System Administrator** to prevent catastrophic administrative lockouts.
2. **Self-Deactivation Prohibition:**
   - Users cannot deactivate or delete their own accounts via user management endpoints (`403 Forbidden`).
3. **Token Eviction on Deactivation:**
   - Calling `/users/{id}/deactivate` immediately revokes all active Sanctum tokens belonging to the target user.

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

### 3.2 View Individual User
- **Route:** `GET /api/v1/users/{id}`
- **Permissions:** `users.view` or self (`$actor->id === $target->id`).

---

### 3.3 Update User & System Role
- **Route:** `PUT /api/v1/users/{id}`
- **Required Permission:** `users.update`

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

### 3.4 Activate User Account
- **Route:** `POST /api/v1/users/{id}/activate`
- **Required Permission:** `users.update`

Sets `account_status` to `active`.

---

### 3.5 Deactivate User Account
- **Route:** `POST /api/v1/users/{id}/deactivate`
- **Required Permission:** `users.delete`

Sets `account_status` to `suspended` and purges all active Sanctum bearer tokens.
