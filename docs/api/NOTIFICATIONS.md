# Notifications Inbox API — v1

**Status:** Accepted — Product Owner approval 2026-11-10 (independent review PASS WITH CONDITIONS; condition K-1 resolved by the accepted D6 global rate limiter). Uses the existing Laravel-standard `notifications` table; no migration, seeder, or dependency change was required.

Base path `/api/v1`; requests require `Accept: application/json` and Sanctum bearer authentication on an active account. All results use the shared `ApiResponse` envelope.

## Purpose and scope

A private, user-scoped inbox for the authenticated account's in-app notifications, built for normal client polling (list, unread count, read status). It is not a business activity feed, not a unified `/inbox`, and has no WebSockets/broadcasting. Only the four read/list operations below exist — there are no create, delete, or recipient-transfer endpoints.

## Routes

| Method | Path | Route name | Behavior |
|---|---|---|---|
| GET | `/notifications` | `api.v1.notifications.index` | Paginated list of the caller's notifications, newest first |
| GET | `/notifications/unread-count` | `api.v1.notifications.unread-count` | Caller's unread count (single DB aggregate) |
| PATCH | `/notifications/{id}/read` | `api.v1.notifications.read` | Mark one of the caller's notifications read (idempotent) |
| PATCH | `/notifications/read-all` | `api.v1.notifications.read-all` | Mark all of the caller's unread notifications read; returns `updated` count |

All routes sit behind `auth:sanctum` and `account.active`: 401 `UNAUTHENTICATED` without a token, 403 `ACCOUNT_NOT_ACTIVE` for suspended accounts, 403 `FORBIDDEN` when authorization fails, 404 `RESOURCE_NOT_FOUND` for missing/foreign notifications, 422 `VALIDATION_ERROR` for invalid filters.

## Ownership enforcement (including System Admin)

Every query is built from the authenticated user's `notifications()` morphMany relation (`notifiable_type` + `notifiable_id`), so scope is enforced in SQL:

- `NotificationService` never consults `Gate`, so the global `Gate::before` System Admin bypass cannot widen personal inbox scope — an admin's `/notifications` and `/notifications/unread-count` contain only their own records, and mark operations touch only their own rows.
- Mark-one resolves `{id}` inside the caller's relation (`firstOrFail`): another user's notification and a nonexistent id both return the identical 404 envelope, revealing nothing about existence, ownership, contents, or read status.
- Mark-all runs a single relation-scoped `UPDATE ... WHERE read_at IS NULL`; other users' rows (including for System Admins) are never updated.
- Client-supplied `user_id` / `notifiable_id` parameters or bodies are ignored — identity always comes from the session, and unknown parameters are not part of validated input.

## List filters and pagination

`status` (`read` | `unread`), `type` (exact notification class string, max 255), `per_page` (1–100, default 15). Ordering is deterministic: `created_at` descending, then `id` descending. Standard pagination meta: `current_page`, `last_page`, `per_page`, `total`. Invalid values return 422.

## Response fields and payload safety

Each entry contains `id` (UUID), `type` (stored class string), `data`, `read_at` (ISO-8601 or null), and `created_at` (ISO-8601). Internal columns `notifiable_type`, `notifiable_id`, and `updated_at` are never serialized.

`data` is filtered through a per-type allowlist in `NotificationResource`:

- `App\Notifications\AppointmentNotification` → `event`, `appointment_uuid`, `title`, `start_time`, `end_time`, `timezone`, `organizer_name`, `context` (the exact payload written by the existing write path).
- Any unknown/future type → `data` is an empty object (fail-closed), so a future notification that carries sensitive fields cannot leak them without an explicit allowlist update.

Read/unread semantics: `read_at IS NULL` = unread; `read_at` set = read. Mark-one only ever writes `read_at` (never `notifiable_*`), and is a no-op when already read (original `read_at`/`updated_at` preserved).

### Example: `GET /notifications`

```json
{
  "success": true,
  "message": "Notifications retrieved successfully.",
  "data": [
    {
      "id": "a97fc96e-b206-4d92-ad31-47a129c8901a",
      "type": "App\\Notifications\\AppointmentNotification",
      "data": {
        "event": "invitation",
        "appointment_uuid": "6a499e9f-e0c6-4b76-a369-99b7acbbab62",
        "title": "Design review",
        "start_time": "2026-11-12T10:00:00.000000Z",
        "end_time": "2026-11-12T11:00:00.000000Z",
        "timezone": "Africa/Mogadishu",
        "organizer_name": "Amina",
        "context": "personal"
      },
      "read_at": null,
      "created_at": "2026-11-10T09:15:00.000000Z"
    }
  ],
  "meta": { "current_page": 1, "last_page": 1, "per_page": 15, "total": 1 }
}
```

`GET /notifications/unread-count` returns `data: { "unread_count": 3 }`. `PATCH /notifications/read-all` returns `data: { "updated": 3 }`.

## Existing write-path compatibility

The only production writer into this table remains `AppointmentNotification` (database channel, gated by the recipient's `in_app` profile preference, default true; queued with `afterCommit`). Password-reset and invitation notifications are mail-only and create no database rows. This module changed no write path, schema, or payload; compatibility is covered by a regression test that sends a real `AppointmentNotification` and reads it back through the API.

## Polling usage

Clients poll `GET /notifications/unread-count` for badge counts, `GET /notifications` (optionally `status=unread`) for new items, and rely on `read_at` in both list entries and mark responses for read-state sync. `PATCH .../read-all` supports "mark all read" UIs via its `updated` count.
