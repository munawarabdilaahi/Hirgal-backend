# Authentication and account security

This document describes the frontend auth flow against the Laravel routes and resources currently in this repository. Frontend tests use mocked API responses; no live Laravel HTTP integration was available during this audit because no server was listening at `127.0.0.1:8000`.

## Endpoints and contracts

All paths below are relative to `/api/v1`. Successful responses use `{ "success": true, "message": "...", "data": ... }`. Errors use `{ "success": false, "message": "...", "errors": ..., "error_code": "..." }` when a code applies.

| Method and path | Auth | Request | Success data |
| --- | --- | --- | --- |
| `POST /auth/login` | No | `{ email, password, device_name? }` | `{ access_token, token_type: "Bearer", user }` |
| `POST /auth/register` | No | `{ name, email, password, password_confirmation, timezone?, device_name? }` | Token and user, 201; disabled by default unless `auth.allow_registration` is enabled |
| `GET /auth/me` | Bearer | None | Authenticated `user`, including global `roles`, effective `permissions`, and `profile` |
| `POST /auth/logout` | Bearer | None | `null`; revokes the current Sanctum token |
| `POST /auth/logout-all` | Bearer | None | `null`; revokes all user tokens; no frontend control is exposed |
| `PUT /auth/me/profile` | Bearer | Permitted user/profile fields | Updated `user` |
| `POST /auth/forgot-password` | No | `{ email }` | `null` plus generic confirmation message |
| `POST /auth/reset-password` | No | `{ email, token, password, password_confirmation }` | `null` plus completion message |
| `POST /auth/change-password` | Bearer | `{ current_password, password, password_confirmation, logout_other_devices? }` | `null` plus completion message |

Login field validation returns HTTP 422 with `VALIDATION_ERROR`; invalid credentials are returned as an `email` validation error (`Invalid credentials.`). A correct password for an inactive account returns HTTP 403 `FORBIDDEN` at login. Authenticated requests for an inactive account return HTTP 403 `ACCOUNT_NOT_ACTIVE` from `EnsureAccountIsActive`. Other authorization denials are HTTP 403 and must not end the session. Unauthenticated requests return HTTP 401.

Forgot password always returns the same successful generic message whether or not the email exists. Reset and change password enforce Laravel validation, including confirmation and minimum length. A successful reset revokes all user tokens. A change-password request only revokes other tokens when `logout_other_devices` is true; the current token remains active.

## Token and session lifecycle

The Sanctum bearer token is held in a module-scoped JavaScript variable in `src/services/api/tokenStore.ts`. It is not written to local storage, session storage, cookies, URLs, or logs. Axios adds `Authorization: Bearer <token>` to requests unless `skipAuth` is set. `withCredentials` is false.

The token exists only in memory. Refreshing or closing the tab loses the session; there is no automatic token restoration. Once login receives a token, the provider fetches `/auth/me` before marking the user authenticated. Failure to verify the session shows a retry state and retains the token for transient failures. HTTP 401 clears the token. HTTP 403 clears it only when `error_code` is `ACCOUNT_NOT_ACTIVE`.

Logout attempts server revocation and clears the local token and TanStack Query cache in a `finally` block. If the request fails, the browser session is still cleared; the UI reports that server revocation could not be confirmed. Sanctum expiration is currently `null`, so a token whose logout request did not reach the server may remain valid until revoked by another action.

## Routing and redirects

`/login` is for signed-out users. `/forgot-password` and `/reset-password` are public. `/dashboard`, `/profile`, `/change-password`, and the feature routes require an authenticated active account. Visiting a protected route while signed out stores only its same-origin pathname, query, and fragment in router state. The login page validates that destination before navigating; external URLs, protocol-relative paths, and backslash paths are rejected.

The `/users` route requires either `users.view_directory` or `users.view`; the route presents the sanitized directory or administrative user list accordingly. `/users/:userId` requires `users.view`. These frontend checks only control route visibility. Laravel policies remain responsible for all private data and mutation authorization. Projects, teams, and tasks remain permission-gated placeholders.

## Permissions and role scope

The user and effective permission list are obtained from authenticated backend responses; the frontend does not infer permission grants from role names. `hasPermission` reads only `user.permissions`. `hasGlobalRole` reads the backend's global role slugs. Project-contextual roles (`owner`, `lead`, `member`, `viewer`) are a separate backend concept and are not treated as global roles by these helpers.

Laravel's project policy requires `projects.view` and membership scope for a specific project. A Project Manager's global role does not grant access to every project. The System Admin role receives all seeded global permissions, and the backend has explicit policy behavior for administrative actions. The frontend does not grant data access based on either role: it has no project data service yet.

## Verification record

Frontend unit/component tests use mocked API methods or Axios adapters; they verify frontend behavior and do not prove a real network exchange with Laravel. Existing Laravel feature tests exercise the backend in its own test environment, but were not run as HTTP integration from the frontend during this audit. Backend contracts were checked against `routes/api.php`, auth controllers, form requests, middleware, resources, policies, seeders, and Laravel auth feature tests.

### Frontend coverage matrix

| Behavior | Frontend coverage | Test type / note |
| --- | --- | --- |
| Successful login | Covered | Component test with mocked token and current-user response |
| Invalid credentials | Covered | Component test with mocked Laravel 422 validation envelope |
| Login validation | Covered | Required email/password blocks API call |
| Logout | Covered | Component test verifies successful server logout and return to login |
| Logout failure | Covered | Component test; local token is cleared regardless |
| Current-user retrieval | Covered | Login flow fetches `/auth/me` before rendering protected content |
| Session initialization | Partial | Starts signed out because token memory is empty; verified backend lookup after login; reload restoration is intentionally unsupported |
| 401 handling | Covered | Axios-adapter test clears in-memory token |
| 403 handling | Covered | Axios-adapter test preserves token for `FORBIDDEN` |
| Stale request after a new login | Covered | Axios-adapter test confirms an old 401 cannot clear the newer token |
| Inactive-account handling | Covered | Axios-adapter test clears only for `ACCOUNT_NOT_ACTIVE`; login `FORBIDDEN` stays generic |
| Protected routes | Covered | Unauthenticated dashboard redirects to login |
| Permission denied route / private content | Covered | A route with a missing permission renders no feature content |
| Safe redirect behavior | Covered | Same-origin path/query/hash accepted; external and malformed destinations rejected |
| Permission helpers | Covered | Backend-derived permission checks and null-user behavior |
| Global vs project-contextual roles | Covered | Global role helper is distinct; contextual role type is not a global grant |
| Forgot-password workflow | Covered | Valid request and generic success state |
| Reset-password workflow | Covered | Token, email, password confirmation submitted and completion shown |
| Change-password workflow | Covered | Validated fields submitted with device logout option |
| Profile update | Covered | Permitted profile fields submitted and query cache updated |

Coverage is frontend component/unit coverage with mocked responses, not real HTTP integration coverage. Laravel's separate feature tests provide backend request coverage.

## Security review and limitations

- Memory-only token handling is preserved. A future persistent session should use a backend-supported secure cookie design and a documented threat review.
- Axios does not log request bodies or Authorization headers. Password reset tokens are sent in the request body after being read from the reset link query string; avoid analytics or third-party scripts that capture full URLs on that route.
- Query cache is cleared when the token is removed and again during logout cleanup. Protected route content is gated on a current active user.
- A late 401 or `ACCOUNT_NOT_ACTIVE` response only clears the token used by that request; it cannot clear a newer login's token.
- Frontend permission checks are a user experience layer. API authorization, including project membership scope, is enforced by Laravel.
- Inactive login responses use generic `FORBIDDEN`, so the frontend does not identify account status on the login page. Authenticated inactive sessions are identified by `ACCOUNT_NOT_ACTIVE`.
- No live Laravel server was available at the expected local URL, and no production credentials or database commands were used.
- Password reset email delivery, token expiry, revocation persistence, and deployment CORS behavior were not exercised over live HTTP.
- The frontend does not expose public registration or logout-all controls, although those backend routes exist.

## Run frontend checks

From `frontend/` run:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

## Phase 3.1 validation results (2026-11-05)

- `npm run typecheck`: passed.
- `npm run lint`: passed with no reported issues.
- `npm test`: passed, 7 test files and 40 tests.
- `npm run build`: passed; Vite reported the main minified JavaScript chunk at approximately 700 kB, above its 500 kB advisory threshold.
- `npm audit --omit=dev`: passed; 0 vulnerabilities.
- Real HTTP integration against Laravel: not run; the local server was unavailable at `127.0.0.1:8000`.

## Phase 4.1 security and contract audit

The current-user contract used by the dashboard is `GET /api/v1/auth/me`, behind Sanctum and active-account middleware. Profile editing uses `PUT /api/v1/auth/me/profile`, with optional `name`, `timezone`, `avatar_url`, `phone`, `job_title`, `department`, `bio`, `theme_preference`, and `notification_preferences`; Laravel validates the fields and returns `UserResource`. The profile screen submits only the editable profile fields it presents.

The auth provider clears the TanStack Query client on logout and when the token transitions to cleared. This also removes the user directory and administrative user query cache after a current-session 401 or `ACCOUNT_NOT_ACTIVE`. When refreshed auth data changes effective permissions, user-list and user-detail queries are removed. Ordinary 403 responses preserve the token and cached identity. Account switching through the UI requires logout, which clears query data before the next login. The bearer remains memory-only.

Phase 4.1 re-ran the full frontend suite (48 tests across 10 files), typecheck, lint, production build, and production dependency audit. Route-level page splitting reduced the entry chunk from 792.15 kB to 369.22 kB (gzip 245.87 to 114.68 kB); the build emits 27 JS chunks totaling 802.79 kB uncompressed and no longer emits Vite's 500 kB large-chunk warning. These frontend tests remain mocked; route listing and source inspection verified Laravel contracts, but no authenticated live HTTP exchange was performed.

Phase 4.2 expanded the suite to 84 tests across 12 files. Dashboard current-user loading/error/retry and no-duplicate-fetch behavior, user-detail updates/actions, directory search/pagination, permission guards against cached rows, permission-change cache removal, and logout cache clearing now have focused tests. The self-view route decision and case coverage are documented in `USER_ADMINISTRATION.md`; directory responsive markup checks and visual-verification limitations are documented in `USER_DIRECTORY.md`. The `testing-best-practices` skill was unavailable locally; established Vitest/Testing Library patterns were followed. The latest build emits a 369.40 kB entry chunk (114.74 kB gzip), 27 JS chunks totaling 803.07 kB uncompressed, with no Vite large-chunk warning. No authenticated live HTTP or browser screenshot verification was available.
