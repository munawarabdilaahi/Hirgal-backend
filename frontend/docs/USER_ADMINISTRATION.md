# User administration

Accounts with `users.view` see the administrative list at `/users`. It uses `GET /api/v1/users` with supported search, account-status, global-role slug, sorting, page-size, and page filters. Results display account status, global roles, department, and a link to `/users/{id}`. The backend `UserResource` provides the administrative fields.

The detail route requires `users.view` and loads `GET /api/v1/users/{id}`. Users with `users.update` may edit name, email, and time zone through `PUT /api/v1/users/{id}`. The form surfaces validation failures and updates cached detail/auth data after success. Global role assignment is intentionally absent: although the update request accepts a role ID, this API has no roles-list endpoint from which the UI could safely resolve valid role IDs.

Account activation uses `POST /api/v1/users/{id}/activate` and requires `users.update`. Suspension uses `POST /api/v1/users/{id}/deactivate` and requires `users.delete`. Both require confirmation. The UI prevents self status changes and mirrors the backend's System Admin restrictions where the target role is known; Laravel remains authoritative, including the protection for the last active System Admin. Backend validation and authorization failures remain visible to the operator.

The dashboard, list, detail, validation, and action interfaces are tested using component/service mocks. No live backend HTTP integration is claimed. The API contracts and policies are documented in [`../../docs/api/USERS.md`](../../docs/api/USERS.md).

## Phase 4 verification

The frontend suite passes with 48 tests across 10 files. TypeScript typecheck and Oxlint pass. The production build succeeds; Vite reports that the main minified JavaScript chunk is 792.15 kB, above its 500 kB advisory threshold. `npm audit --omit=dev` reports zero vulnerabilities. Tests use mocked API/auth data and do not represent live backend integration.
