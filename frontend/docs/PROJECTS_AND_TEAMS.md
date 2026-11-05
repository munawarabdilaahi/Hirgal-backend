# Projects and Teams

Frontend Phase 5 integrates the project and team APIs already implemented by Laravel. The server remains authoritative for every permission and contextual role check; list results are scoped by the current actor on the API.

## Frontend routes

| Route | Purpose | Frontend gate |
| --- | --- | --- |
| `/projects` | Search, status filter, paginated project cards | `projects.view` |
| `/projects/new` | Create a project | `projects.create` (checked in the page) |
| `/projects/:projectUuid` | Overview, allocated teams, project members | `projects.view` |
| `/projects/:projectUuid/edit` | Edit project metadata | `projects.update` plus contextual `owner` or `lead` |
| `/teams` | Search and paginated team cards | `teams.view` |
| `/teams/new` | Create a team | `teams.create` (checked in the page) |
| `/teams/:teamUuid` | Team lead, roster, roster roles | `teams.view` |
| `/teams/:teamUuid/edit` | Edit team metadata and designated lead | `teams.update` plus contextual team leadership |

Pages are lazy-loaded with the existing route loading fallback. The application shell now links to Projects and Teams using their backend permissions.

## Verified API contract

All endpoints use `/api/v1`, Sanctum bearer authentication, the standard `{ success, message, data, meta? }` response envelope, and the shared Axios client. List endpoints return pagination metadata (`current_page`, `last_page`, `per_page`, `total`). The Laravel paginator reads `page`; accepted `per_page` is 1–100, default 15. Frontend list views request 12 records per page.

### Projects

| Method and path | Request/filter fields | Response | Authorization and behavior |
| --- | --- | --- | --- |
| `GET /projects` | `search` (name/slug, max 100), `status` (`planning/active/paused/completed/archived`), `priority` (`urgent/high/medium/low`), `per_page`, `sort_by`, `sort_direction`, `page` | Paginated `ProjectResource[]` | `projects.view`; System Admin sees all, other actors see only owned/member projects. |
| `POST /projects` | `name` required max 255; optional `description` max 5000, non-archived status, priority, dates, settings | `ProjectResource`, HTTP 201 | `projects.create`; creator becomes owner. |
| `GET /projects/{uuid}` | UUID route key | `ProjectResource` | `projects.view` and project scope. Out-of-scope/missing resources resolve to 404. |
| `PUT /projects/{uuid}` | Optional name, description, non-archived status, priority, dates, settings | `ProjectResource` | `projects.update` and contextual project `owner` or `lead`. |
| `POST /projects/{uuid}/archive` | No body | `ProjectResource` | `projects.archive` and contextual `owner` or `lead`; changes status to archived. |
| `DELETE /projects/{uuid}` | No body | `data: null` | `projects.delete` and project owner; System Admin is allowed by policy. This is a soft delete. |
| `POST /projects/{uuid}/restore` | No body | `ProjectResource` | `projects.delete` and project owner; route resolves soft-deleted UUIDs. |
| `GET /projects/{uuid}/members` | `page`, `per_page` | Paginated `ProjectMemberResource[]` | In-scope project plus `projects.view`. Includes sanitized user details and contextual role. |
| `POST /projects/{uuid}/members` | `user_id`, role `lead/member/viewer` | Member resource, HTTP 201 | `projects.invite` and contextual owner/lead. Owner may grant lead/member/viewer; lead may grant member/viewer. |
| `PUT /projects/{uuid}/members/{memberId}` | role `lead/member/viewer` | Member resource | `projects.invite`, contextual owner/lead; project owner row cannot be changed. |
| `DELETE /projects/{uuid}/members/{memberId}` | No body | Member resource and `meta.removed_teams` | `projects.invite` and owner/lead; owner row is protected except System Admin policy bypass. Team roster effects are handled by the backend. |
| `GET /projects/{uuid}/teams` | No query | `TeamResource[]` | In-scope project plus `projects.view` and `teams.view`. |
| `POST /projects/{uuid}/teams/{teamUuid}` | No body | `TeamResource`, HTTP 201 | Project `projects.update` plus contextual owner/lead and team in actor scope; backend requires team roster to be a subset of project members. |
| `DELETE /projects/{uuid}/teams/{teamUuid}` | No body | `data: null` | Same project contextual allocation authority and team scope. |

Project list search, status, and priority filters are implemented. The UI does not expose sort controls. Soft-deleted projects are absent from ordinary lists and `GET /projects/{uuid}` returns 404, so the restore route cannot be safely discovered from the current UI and is not exposed. Project invitations are database-only and have no endpoint.

### Teams

| Method and path | Request/filter fields | Response | Authorization and behavior |
| --- | --- | --- | --- |
| `GET /teams` | `search` (name/slug, max 100), `per_page`, `sort_by`, `sort_direction`, `page` | Paginated `TeamResource[]` | `teams.view`; list is scoped to a leader, roster member, or shared allocated project; System Admin sees all. |
| `POST /teams` | `name` required max 255; optional description max 5000 and nullable integer `leader_id` that exists | `TeamResource`, HTTP 201 | `teams.create`; when leader is omitted, the actor becomes the designated leader; eligibility for allocated projects is enforced by the action. |
| `GET /teams/{uuid}` | UUID route key | `TeamResource` | `teams.view` and team scope; cross-scope resources resolve to 404. |
| `PUT /teams/{uuid}` | Optional name, description, nullable integer `leader_id` | `TeamResource` | `teams.update` plus team leader/roster leader, contextual owner/lead of a shared allocated project, or System Admin. |
| `DELETE /teams/{uuid}` | No body | `data: null` | Team scope plus `teams.delete`, or System Admin; soft deletes team and removes allocations per backend action. |
| `GET /teams/{uuid}/members` | `page`, `per_page` | Paginated `TeamMemberResource[]` | Team scope and `teams.view`. |
| `POST /teams/{uuid}/members` | `user_id`, role `leader/member` | Member resource, HTTP 201 | `teams.manage` plus contextual team authority; candidate must belong to every allocated project. |
| `PUT /teams/{uuid}/members/{memberId}` | role `leader/member` | Member resource | `teams.manage` plus contextual authority; designated leader row cannot be changed. |
| `DELETE /teams/{uuid}/members/{memberId}` | No body | Member resource | `teams.manage` plus contextual authority, or System Admin; designated leader row is protected. |

Team search and pagination are implemented. All directory pickers use debounced server-side search and the directory paginator (`page`, `per_page=100`); the selected user remains available when search terms or pages change. Directory loading, empty, retryable error, and authorization states are presented. Project and team roster views also paginate their member endpoints. The separate project allocation picker still loads only the first 100 accessible teams and has no search/page controls. The team resource has no allocated-project field and there is no team-to-project listing route; project allocation lists are available only from project details. Project roster eligibility and team leadership invariants remain server-validated and may return 422.

## Security and error handling

- Frontend route guards use the backend permission strings; contextual checks hide operations unless the current role is available from project/team owner or roster data.
- Team mutation UI omits the designated lead from role/removal controls. Project membership controls omit the project owner row and enforce the assignable roles of the acting owner/lead.
- Server policy enforcement remains final. API 401, 403, 404, 422, and unexpected/network failures remain visible as retryable or inline errors; 404 does not imply that the resource exists outside scope.
- Logout continues to clear the shared TanStack Query cache through the existing auth provider. Mutation success invalidates affected project, team, and roster query keys.
- Destructive project/team actions require confirmation. Project/team membership removal uses a native confirmation prompt.

## Validation and limitations

Checks run: `npm run typecheck` and `npm run lint` passed; `npm test` passed with **101 tests across 14 files**; `npm run build` passed without a Vite large-chunk warning; `npm audit` found **0 vulnerabilities**.

The Phase 5 baseline build emitted **36 JavaScript chunks totaling 849.27 kB**. Its main entry was **371.99 kB (115.18 kB gzip)**. Phase 4.2 emitted 27 chunks totaling 803.07 kB with a 369.40 kB (114.74 kB gzip) main entry. Project/team pages are lazy-loaded.

No live authenticated API or browser viewport/theme screenshot verification was performed during this phase. Component tests mock API service methods; backend contracts and policy behavior were verified from Laravel routes, requests, controllers, services, actions, resources, and policies.

The component tests exercise list loading/empty/error states, search/filter parameters, UUID navigation, project/team details, authorization visibility, create payloads, membership changes, allocation, confirmation, and API error paths. They mock API services and are not live HTTP integration tests. No backend or dependency changes are part of Phase 5.

## Phase 5.1 verification audit

- Git baseline: branch `main`, HEAD `c1bd9325908c89b9184a67b9919d2e4c4b5f1f68`; Phase 5 commit `c1bd932` exists at HEAD; the working tree was clean before audit edits; five commits ahead of `origin/main`.
- Laravel route listing confirmed 15 project routes, 9 team routes, and the existing directory route. Contracts were cross-checked against requests, controllers, services, actions, policies, resources, and route middleware. All UI operations use existing endpoints; restore and project-task creation are not exposed here.
- The directory endpoint accepts a maximum search length of 100 and `per_page` from 1 to 100, searches active users by name, email, job title, and department, and returns Laravel paginator metadata. Its request validator does not declare `page`, but Laravel pagination resolves the query-string page automatically. Pickers now send search/page and retain a selected user across result changes.
- Fixed archived-project editing: archived status is displayed as unchanged and is omitted from the update payload, avoiding an accidental status change to `completed`.
- Fixed team updates with a cleared lead selection: updates omit `leader_id` when blank because the backend update action casts null to ID 0 instead of clearing the relationship. Team creation retains the API behavior that a null/omitted lead defaults to the actor.
- Added pagination to project and team roster views. Query keys include the roster page. Team update, member-role/removal, and project soft-delete mutations invalidate project summaries when those summaries can contain affected team data or scope.
- Roster pagination state is tied to its route UUID and resets to page 1 when navigating directly between projects or teams.
- Pagination and retry buttons inside forms use `type="button"`, preventing accidental submissions while paging rosters/search results or retrying directory requests.
- Authorization review confirmed project manager global role does not grant project-wide access; project data is server-scoped to owner/member, with System Admin policy behavior explicit. Contextual owner/lead and team leader roles remain separate from global role slugs. Frontend controls are advisory; the Laravel policies remain authoritative.
- Authentication behavior remains the existing memory-only token lifecycle: 401 clears the current token, only `ACCOUNT_NOT_ACTIVE` 403 clears it, ordinary 403 preserves the session, and logout clears query cache. User/project/team query caches are removed on permission signature change.
- Visual browser verification was attempted, but the computer/browser host was unavailable. No live authenticated API request was made; local Laravel availability was not confirmed for this audit. No screenshots are available.
- The separate project allocation picker remains limited to the first 100 accessible teams. Project/team edit-form contextual-role checks inspect page 1 of their roster, so a non-designated lead whose membership is beyond that page may be unable to open the edit form directly. Backend access remains enforced.
- Final audit validation: **107 tests across 15 files passed** (baseline 101 across 14); typecheck, lint, production build, `npm audit` (0 vulnerabilities), and `git diff --check` passed. Production output: 36 JavaScript chunks totaling 850.99 kB; main entry 371.99 kB (115.17 kB gzip); no Vite large-chunk warning. Tests mock the APIs and do not establish live integration.

## Phase 5.2 remediation and verification (2026-11-05)

### Allocation picker

The allocation picker now uses the existing `GET /api/v1/teams` endpoint with debounced `search`, `page`, and `per_page=12` query parameters. Each query is keyed by its normalized filters through the shared team list key. Laravel's `ListTeamsRequest` validates `search` (maximum 100 characters) and `per_page` (1–100); it does not explicitly list `page`, but Laravel's paginator reads `page` from the query string. Live requests confirmed search, page metadata, and actor-scoped team results. The picker displays loading, empty, and retryable error states, resets to page one when search changes, filters already allocated teams, and retains a selected team while results change. It no longer fetches 100 teams for a single page of options.

### Team contextual access and duplicate membership

`TeamResource` returns the designated `leader`, but no permission or contextual-authority field exists. `TeamPolicy::hasContextualAuthority` also allows a roster member with role `leader`, or a project owner/lead on a shared allocated project, as well as a system administrator. The team resource does not expose allocated projects and there is no reverse team-to-project endpoint. To avoid missing roster leaders on later pages, the frontend reads the team's paginated membership endpoint in `per_page=100` pages and caches the complete roster for 30 seconds. Permission loading and failures keep roster-derived edit/manage controls hidden; a failed roster check has a retry state. This recognizes roster leaders on later pages and does not use global role names as contextual team roles.

The remaining authorization limitation is that a project owner/lead who is not the designated team leader or a roster leader cannot be identified from the team response. The frontend therefore may hide team editing for that policy-authorized user. It does not grant editing based on incomplete data; Laravel remains authoritative for requests made outside the frontend. A future backend permission field or team-to-project relationship endpoint is needed to represent every allowed contextual path in the UI without scanning unrelated project data.

Candidate exclusion now uses all known roster pages, so an existing member on a later page is not offered as a new candidate. The backend `AddTeamMemberAction` uses `firstOrCreate`, so a duplicate request returns the existing membership rather than a duplicate row or a duplicate-specific 422. The UI refreshes roster/team/project queries after successful membership mutations. A 422 from the backend is shown with the team requirement that the person belong to each allocated project. If another actor adds the selected person after the roster scan, the backend's idempotent behavior avoids a second membership row; the frontend cannot guarantee the roster remains current between requests.

### API evidence and live checks

Backend source reviewed: team/project list requests, services, controllers, resources, routes, policies, and membership actions. The API supports paginated project/team/member lists, server search for projects and teams, and directory search/pagination. Team list scope comes from `TeamService::listTeams`; non-admin results are limited to teams visible through leadership, roster membership, or shared project scope. `TeamResource` does not include a permission field. Team membership creation's project-roster eligibility is enforced by the backend action.

Live checks used only existing seeded development accounts and read-only project/team/directory requests, apart from a member's denied empty project-create request. Laravel and MySQL were running; `php artisan db:show` confirmed MySQL connectivity for `hirgal_backend`. The frontend was listening on `[::1]:5173`; `.env.example` and the frontend fallback both point to `http://127.0.0.1:8000/api/v1`. The seeded System Admin account logged in, returned an active account with 31 effective permissions, and successfully called `/auth/me`, project/team listing and search, project detail/member/team listing, team detail/roster, and directory search. Unauthenticated team listing returned 401. A seeded ordinary member received 403 for team listing and project creation; the empty create request was denied before validation or mutation. `per_page=101` returned 422.

The seeded database contained one visible project and one team, so page-two list requests returned valid empty pages. The member account was already a member of the only seeded project, so a cross-scope existing-project 404 could not be demonstrated. No successful write requests were issued; the member's empty project-create request was denied with 403 before a mutation. Project/team create/update/archive/delete/member changes and allocations were not attempted, to preserve the existing development data. Successful test sessions were logged out. Tokens left by failed local HTTP harness attempts were removed by their exact test device names from the development token table; no other tokens were removed. Login updated the seeded users' normal `last_login_at` field. Frontend component tests use mocked service calls; they are not live HTTP tests.

### Browser and remaining verification

Browser verification remains incomplete. `mcp__cua_repl` reported that the browser access host was unavailable. An attempt to launch an isolated headless Edge session was blocked by the execution policy. No screenshot or viewport/theme/accessibility observation was captured. Desktop (1440×900), tablet (768×1024), mobile (390×844), light/dark/system theme, keyboard/focus, dialogs, and dropdown clipping therefore remain unverified in a real browser.

Regression tests cover server-side allocation search/pagination, selected-team persistence, full paginated roster candidate exclusion, later-page roster-leader controls, and useful backend eligibility errors. Full suite and build/audit results for this phase are recorded after the final validation run below.

### Final validation results

- Git baseline: `main` at `9cd2571`, equal to `origin/main`, clean before this phase.
- `npm run typecheck`: passed.
- `npm run lint`: passed with no reported issues.
- `npm test`: passed, **113 tests across 15 files** (Phase 5.1 baseline: 107 across 15 files).
- `npm run build`: passed; **36 JavaScript chunks totaling 854.17 kB**. Main entry: **371.99 kB (115.18 kB gzip)**. No Vite large-chunk warning.
- `npm audit`: passed, **0 vulnerabilities**.
- `git diff --check`: passed; Git printed only CRLF-to-LF working-copy notices for the two edited Markdown files.
- The `testing-best-practices` skill was not installed in the local skill catalog; the repository's established Vitest and Testing Library patterns were followed.
- No backend files, dependency manifests, or lockfiles changed.
