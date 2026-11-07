# Appointments & Scheduling API — v1

**Status:** Implemented in code; apply the Phase 7 migration and seed the new administrative permission on the intended deployment database before enabling the API.

Base path `/api/v1`; requests require `Accept: application/json` and Sanctum bearer authentication. All results use the shared `ApiResponse` envelope.

## Context and privacy

Every appointment is project, team, or personal. The context is mutually exclusive: `project_uuid` XOR `team_uuid`, or neither for personal. Project appointments are visible to active project members and the owner; project owner/lead or the organizer may manage them subject to global permission. Team appointments are visible to the team roster and leader; the roster leader or organizer may manage them. Personal appointments are visible only to the organizer and active invitees. Team appointment access does not imply access to projects allocated to that team. System Administrators do not receive ordinary cross-context visibility.

The authenticated organizer is assigned server-side. Participant IDs are internal user IDs, consistent with existing Hirgal API payloads. Public appointment identifiers are UUIDs. Unauthorized cross-context access resolves as 404. Project/team participants must be active and belong to that context; personal invitations may target any active user.

## Time contract

`start_time` and `end_time` accept RFC3339 seconds with an explicit offset (for example `2026-11-08T10:00:00+03:00` or `2026-11-08T07:00:00Z`) plus an IANA `timezone`. The offset must match that timezone at the submitted instant. The API rejects invalid dates, offset mismatch, nonexistent local DST times, and `end_time <= start_time`. An explicit offset selects the intended occurrence of an ambiguous fall-back local time. Stored values are UTC instants; responses return UTC (`...Z`) and the persisted display timezone. Changing only `timezone` preserves the instant.

## Routes

| Method | Path | Behavior |
|---|---|---|
| GET | `/appointments` | Scoped, paginated appointment list |
| GET | `/appointments/calendar` | Scoped list with required bounded `from`/`to` range (maximum 90 days) |
| POST | `/appointments` | Create event and pending participant invitations; returns conflict warnings |
| GET | `/appointments/{uuid}` | Read one authorized event |
| PUT | `/appointments/{uuid}` | Update details, timezone, reschedule, or valid status transition; returns refreshed warnings |
| POST | `/appointments/{uuid}/cancel` | Set cancelled status and historical actor/time; preserves participant records |
| DELETE | `/appointments/{uuid}` | Soft-delete; cancellation remains a separate operation |
| GET | `/appointments/{uuid}/participants` | Paginated active participants |
| POST | `/appointments/{uuid}/participants` | Invite or reinvite eligible active user; idempotent for an active invite |
| DELETE | `/appointments/{uuid}/participants/{user}` | Soft-remove invitee while preserving response history |
| PUT | `/appointments/{uuid}/rsvp` | Authenticated invitee changes their own RSVP |
| POST | `/appointments/admin/{uuid}/view` | System Admin read-only support view; requires reason and writes an immutable audit event |

List filters include `from` (inclusive), `to` (exclusive), `context=project|team|personal`, `project_uuid`, `team_uuid`, `status`, and `per_page` (1–100). Calendar requires both time bounds and limits the range to 90 days. Context UUID filters cannot be combined.

### Create example

```json
{
  "project_uuid": "6a499e9f-e0c6-4b76-a369-99b7acbbab62",
  "title": "Design review",
  "description": "Review the proposed API contract.",
  "timezone": "Africa/Mogadishu",
  "start_time": "2026-11-08T10:00:00+03:00",
  "end_time": "2026-11-08T11:00:00+03:00",
  "location_type": "virtual",
  "meeting_link": "https://meet.example.test/design-review",
  "participants": [12, 13]
}
```

For personal appointments omit both context UUIDs. For a team appointment supply only `team_uuid`. The organizer cannot invite themselves.

### Conflict warnings

Conflict intervals use `[start,end)`; adjacent meetings do not overlap. Conflicts are warnings and never reject a valid authorized operation. Organizer conflicts and existing accepted/tentative invitee commitments are reported. Pending/declined/removed participants, cancelled appointments, and soft-deleted appointments are excluded as existing commitments. Adding an invitee also checks that invitee’s existing commitments before RSVP. The response uses `data.conflicts = { "has_conflicts": boolean, "items": [...] }`. Items include the affected user and reason; appointment UUID/title/time are included only when the caller can view that other event. Warning results reflect the transaction snapshot and can become stale after concurrent writes.

## Status and participant rules

Creation starts `scheduled`. `scheduled` may become `confirmed` or, once its end has passed, `completed`; `confirmed` may become `completed`. Completion and cancellation are terminal. Cancellation stamps `cancelled_at`/`cancelled_by`; cancellation cannot be reversed. Participants begin `pending` with null `responded_at`; only the invited user may set `accepted`, `declined`, or `tentative`. RSVP stamps response time. Removed invitations retain their prior response in `response_history`; reinvitation resets the active RSVP to pending and preserves prior response entries.

## System Admin support access

`POST /appointments/admin/{uuid}/view` accepts `{ "reason": "..." }`. It requires both the System Admin role and the persisted `appointments.admin.view` permission. The endpoint is read-only and is deliberately separate from ordinary list/detail routes. Each successful read creates an append-only `activity_logs` entry with actor, appointment subject, appointment UUID, context type/ID, read-only action, reason, IP, user agent, and timestamp. The endpoint is not a blanket permission bypass; the ordinary API continues to restrict System Admins to their own appointment context.

## Responses and delivery

Create returns HTTP 201 with `data.appointment` and `data.conflicts`; update and participant operations return HTTP 200. Validation uses the standard 422 envelope; missing/out-of-scope appointments return 404; missing global permissions return 403. Invitations, reschedules, cancellation, and RSVP send queued mail and Laravel database notifications after transaction commit. Existing profile `email` and `in_app` notification preferences are honored. The database queue must have a worker; delivery failures do not roll back committed appointments.
