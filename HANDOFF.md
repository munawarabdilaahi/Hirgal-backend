# Hirgal development handoff

**14 November 2026 · `C:\Hirgal` · `main`**

HEAD is `20c1f5c`. The work described below is in the local working tree, including untracked frontend files. Review both `git status --short` and `git diff` before staging. No deployment or commit was made for this handoff.

## What changed

| Area | Implementation | Entry point |
| --- | --- | --- |
| Invite user | A permission-gated button in People & access opens an email and role dialog. The API supplies role IDs and excludes System Admin for non-admin inviters. Recipients set their own password through the public acceptance page. | [Dialog](frontend/src/features/users/InviteUserDialog.tsx), [controller](app/Http/Controllers/Api/V1/User/UserInvitationController.php), [acceptance page](frontend/src/features/auth/pages/AcceptInvitationRoute.tsx) |
| Invitation security | Inspect and accept send tokens in JSON request bodies. New email links carry tokens in the fragment, and the SPA removes them from the address bar after reading them. The SPA also accepts older query-token links. Legacy token-in-path API routes were retired. Acceptance, resend and revoke use row locks. Malformed invitation IDs return 404. | [Routes](routes/api.php), [API contract](docs/api/INVITATIONS.md) |
| Tasks and My work | Added task list and board views, task editing, due dates, subtasks and assignment controls. My work uses the signed-in user as the assignee filter. The backend rejects self-parenting and descendant cycles. | [Tasks route](frontend/src/features/tasks/TasksRoute.tsx), [task update action](app/Actions/Tasks/UpdateTaskAction.php) |
| Appointments | Added calendar/date-range views, scheduling, RSVP and participant invitations. Applied the pending appointment context and participant-history migration to local MySQL `hirgal_backend`. | [Appointments route](frontend/src/features/appointments/AppointmentsRoute.tsx), [migration](database/migrations/2026_11_07_000001_extend_appointments_for_context_timezone_and_cancellation.php) |
| Habits and API errors | Archive filters now send `0` or `1`. Invalid legacy profile timezones fall back to UTC. The SPA uses a generic message for 5xx responses and discards server error details. | [Habit client](frontend/src/services/api/habitApi.ts), [error normalization](frontend/src/services/api/normalizeApiError.ts) |
| Follow-up, activity and teams | Connected notifications and activity to existing APIs. System audit access is permission-gated. Team controls use capabilities returned by Laravel on the team detail endpoint. | [Follow-up and activity](frontend/src/features/follow-up/FollowUpRoutes.tsx), [team resource](app/Http/Resources/Api/V1/TeamResource.php) |

## Verification recorded during implementation

- Local MySQL returned HTTP 200 through Laravel for appointment calendar, active and archived habit filters, and assigned-task requests under the administrator, team lead and member accounts.
- Before the Invite user change, the frontend suite passed **141 tests** across 18 files. After the invitation change, **10 targeted frontend tests** and **13 targeted backend invitation and rate-limiter tests** passed. Frontend build, lint and Pint passed. These are separate runs.
- An earlier full backend run passed **398 tests**, with **3 skipped**. The full backend suite was not rerun after the invitation dialog and role endpoint were added.
- No real-browser acceptance or external invitation delivery was verified.

## Local setup and release checks

From the repository root, run `php artisan migrate:status` to check the migrations for the configured database. The appointment migration was applied to the local database only. Verify the target separately before enabling Appointments there.

Local MySQL uses `127.0.0.1:3306`. If Windows refuses the connection, check the `MySQL80` service from an Administrator PowerShell. The local mailer is `log`, so invitations created locally are logged instead of delivered. Configure a delivery transport and a recipient-accessible frontend URL in the target environment before testing real email delivery. Deploy the invitation SPA and API together because the acceptance endpoint changed.

## Resume here

1. Review all working-tree changes and run the final backend and frontend suites.
2. Verify an invitation from **People & access** through email receipt, password setup, sign-in and role assignment on staging. Verify the appointment migration and scheduling flow on the same target.
3. Perform real-browser acceptance for My work, Appointments, Habits and role-specific navigation.
4. Keep task comments and mentions, directory email visibility, and team-leader transfer policy on the remaining-work list. The existing notification inbox covers notifications.
