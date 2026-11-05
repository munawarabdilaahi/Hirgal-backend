# Dashboard

The authenticated `/dashboard` route presents the signed-in user's account overview and shortcuts to account settings. It reads the current user already loaded by the authentication provider; it does not request another endpoint.

The overview displays the user's name, email, account status, time zone, global roles, and available profile details (job title and department). Profile management and password security links are always available. A People & access shortcut appears only when the authenticated user's API-provided permissions include `users.view_directory` or `users.view`.

The backend does not currently provide a dashboard aggregation or activity endpoint. The dashboard therefore does not show invented counts, activity, or project summaries. Workspace activity can be added when an API contract exists.

## Verified API inputs

The auth provider obtains the displayed user from `GET /api/v1/auth/me` after login or session verification. The backend requires a Sanctum bearer token and an active account, and returns the `UserResource`: identity, account status, avatar, timezone, timestamps, profile, roles, and effective permissions. The dashboard does not make a duplicate request.

## Access and verification

The route requires an authenticated active account. API permissions control the People shortcut; backend policies remain authoritative. Dashboard component coverage verifies account data rendering and conditional shortcut visibility. Authentication tests cover current-user loading and failed verification using mocks. Tests do not claim live HTTP integration.
