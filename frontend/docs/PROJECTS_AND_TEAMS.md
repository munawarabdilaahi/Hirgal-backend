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

Team search and pagination are implemented. Team leader and membership pickers use the first 100 results from the sanitized user directory; the API supports directory search, but the picker does not yet offer an in-form search or pagination control. The team resource has no allocated-project field and there is no team-to-project listing route; project allocation lists are available only from project details. Team membership management is included, but project roster eligibility and leadership-transfer invariants are server-validated and may return 422.

## Security and error handling

- Frontend route guards use the backend permission strings; contextual checks hide operations unless the current role is available from project/team owner or roster data.
- Team mutation UI omits the designated lead from role/removal controls. Project membership controls omit the project owner row and enforce the assignable roles of the acting owner/lead.
- Server policy enforcement remains final. API 401, 403, 404, 422, and unexpected/network failures remain visible as retryable or inline errors; 404 does not imply that the resource exists outside scope.
- Logout continues to clear the shared TanStack Query cache through the existing auth provider. Mutation success invalidates affected project, team, and roster query keys.
- Destructive project/team actions require confirmation. Project/team membership removal uses a native confirmation prompt.

## Validation and limitations

Checks run: `npm run typecheck` and `npm run lint` passed; `npm test` passed with **101 tests across 14 files**; `npm run build` passed without a Vite large-chunk warning; `npm audit` found **0 vulnerabilities**.

The build emits **36 JavaScript chunks totaling 849.27 kB**. Its main entry is **371.99 kB (115.18 kB gzip)**. Phase 4.2 emitted 27 chunks totaling 803.07 kB with a 369.40 kB (114.74 kB gzip) main entry. Project/team pages are lazy-loaded.

No live authenticated API or browser viewport/theme screenshot verification was performed during this phase. Component tests mock API service methods; backend contracts and policy behavior were verified from Laravel routes, requests, controllers, services, actions, resources, and policies.

The component tests exercise list loading/empty/error states, search/filter parameters, UUID navigation, project/team details, authorization visibility, create payloads, membership changes, allocation, confirmation, and API error paths. They mock API services and are not live HTTP integration tests. No backend or dependency changes are part of Phase 5.
