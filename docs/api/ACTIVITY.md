# Activity Audit API — v1

**Status:** Implemented in code (Phase 9 Module A). The `audit.view` permission and its System Admin assignment were seeded in Phase 5, so no migration or seeder change is required.

Base path `/api/v1`; requests require `Accept: application/json` and Sanctum bearer authentication on an active account. All results use the shared `ApiResponse` envelope with standard pagination meta (`current_page`, `last_page`, `per_page`, `total`).

## Purpose and scope

This module exposes the append-only `activity_logs` trail for security auditing. It is read-only by design: there are no create, update, or delete endpoints, the `ActivityLog` model throws on update/delete, and `ActivityLogPolicy` denies `create`/`update`/`delete` for every actor. It is not a business activity feed.

## Routes

| Method | Path | Behavior |
|---|---|---|
| GET | `/activity-logs` | System-wide audit trail; requires the `audit.view` ability |
| GET | `/activity-logs/my` | Caller's own audit records; any authenticated active user |

Both routes live behind `auth:sanctum` and `account.active`. Missing/invalid tokens return 401 `UNAUTHENTICATED`; suspended accounts return 403 `ACCOUNT_NOT_ACTIVE`; missing `audit.view` on the system list returns 403 `FORBIDDEN`.

## Authorization model

- `GET /activity-logs` authorizes through `ActivityLogPolicy::viewAny`, which checks the `audit.view` ability (seeded to the System Admin role only; ordinary `hasPermission` semantics apply).
- `GET /activity-logs/my` never consults system-wide audit permission. Ownership is enforced in SQL as `user_id = <authenticated id>` inside `ActivityLogService::ownTimeline()`, so the global System Admin `Gate::before` bypass cannot widen this timeline: an admin sees only their own records on `/my`.
- A single record's `ActivityLogPolicy::view` allows the record's owner or an `audit.view` holder; no endpoint currently exposes single-record retrieval.

## List filters

System list (`/activity-logs`): `action` (exact string, max 100), `user_id` (existing user), `subject_type` (string, max 255), `subject_id` (integer ≥ 1), `from`/`to` (dates; `to` must be ≥ `from`), `per_page` (1–100, default 15).

Personal timeline (`/my`): `action`, `from`, `to`, `per_page` only — user, subject, and identity filters are deliberately not accepted because the scope is always the caller.

Invalid values return 422 `VALIDATION_ERROR`. Results are ordered by `created_at` descending, then `id` descending for stable pagination.

## Response fields

Each entry contains `id`, `action`, `user_id`, `actor_name`, `subject_type` (model FQCN), `subject_id`, `description`, `properties`, and `created_at` (ISO-8601).

`ip_address` and `user_agent` are captured on every write but are **never** serialized by `ActivityLogResource`, on either route, for any role — forensic metadata stays database-only.

### Example: `GET /activity-logs`

```json
{
  "success": true,
  "message": "Activity logs retrieved successfully.",
  "data": [
    {
      "id": 42,
      "action": "appointment.admin.view",
      "user_id": 1,
      "actor_name": "System Admin",
      "subject_type": "App\\Models\\Appointment",
      "subject_id": 7,
      "description": "System administrator viewed an appointment for support.",
      "properties": {
        "appointment_uuid": "6a499e9f-e0c6-4b76-a369-99b7acbbab62",
        "context_type": "personal",
        "context_id": null,
        "access_mode": "read_only",
        "reason": "Customer support investigation"
      },
      "created_at": "2026-11-10T09:15:00.000000Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 1
  }
}
```

`GET /activity-logs/my` returns the same shape with message "Personal activity timeline retrieved successfully."

## Write path

Audit records are written exclusively through `App\Services\Audit\ActivityLogger::record()`, which stamps actor, action, subject, description, properties, request IP/user agent, and `created_at`. The existing System Admin appointment support view (`POST /appointments/admin/{uuid}/view`) writes through this logger; its stored event semantics (actor, subject, description, five-property metadata, forensic fields, timestamp) are unchanged and covered by regression tests.
