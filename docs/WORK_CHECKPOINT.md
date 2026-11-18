# WORK CHECKPOINT: Profile & Account Settings

Last updated: 2026-11-18 (local workspace time), after final headless-browser QA
Repository: `C:\Users\Muniir\Herd\Hirgal`
Branch/state: working tree with uncommitted changes; no commit or push has been performed.

---

## 1. Current Task

### Main task
Build and deliver a complete Profile & Account Settings system for Hirgal (Laravel 13 + Inertia v3 + React 19 SPA in `frontend/`).

### Expected final outcome
A production-ready account area covering:
- Profile editing and avatar management.
- Security settings: password change, two-factor authentication, recovery codes, security activity.
- Session/device management.
- Notification preferences.
- Preferences/appearance: theme, formatting, timezone, language.
- Privacy: data export, account deactivation, account deletion.
- Enhanced authenticated-user dropdown.
- Backend APIs, validation, authorization, audit logging, tests, and passing quality gates.

### Objectives requested
- Full backend API and service layer.
- Full React UI integrated into existing SPA and Inertia shell.
- Preserve existing architecture and conventions.
- Add meaningful regression tests.
- Defer only work that needs an unapproved dependency or missing translations.
- Do not commit, push, or deploy unless explicitly requested.

---

## 2. Completed Work

### Backend: database and models
- `database/migrations/2026_11_17_162646_add_two_factor_and_account_preferences.php` (new)
  - Adds `two_factor_secret`, `two_factor_recovery_codes`, `two_factor_confirmed_at`, `two_factor_last_used_step` to `users`.
  - Adds `locale`, `date_format`, `time_format` to `user_profiles`.
  - Applied to local development database.
- `database/migrations/2026_11_17_152657_add_pending_email_change_to_users_table.php`
  - Existing pending-email migration; applied locally.
  - Modified only by `vendor/bin/pint` for class formatting, line endings, and braces position. No behavior change.
- `app/Models/User.php`
  - Fillable/hidden/casts updated for 2FA, pending email, recovery codes.
  - `pending_email_hash` hidden.
  - Added `hasTwoFactorAuthentication()` and `canManageOwnAccount()`.
  - Soft deletes already used; account deletion uses soft delete.
- `app/Models/UserProfile.php`
  - Fillable includes `locale`, `date_format`, `time_format`.

### Backend: services, actions, support
- `app/Services/Security/TwoFactorAuthenticationService.php` (new)
  - Base32 encoding, TOTP generation/validation, provisioning URI.
  - +/- 1 time-step tolerance.
  - Replay protection using `two_factor_last_used_step`.
  - Recovery codes in `XXXX-XXXX` format, one-time use.
  - Uses `now()->getTimestamp()` so Carbon test travel works correctly.
- `app/Services/User/AccountSettingsService.php` (new)
  - Pending email change with HMAC code, 15-minute TTL, on-demand verification mail.
  - Rechecks email uniqueness inside the confirmation transaction; throws validation error on `email` if taken.
  - Refreshes the user before confirmation to avoid stale `actingAs` model instances.
  - 2FA setup/confirm/disable/recovery-code regeneration with audit logging.
  - Session listing/revocation, security activity, data export.
  - Deactivation (`AccountStatus::Suspended`) and self-service soft deletion with safeguards:
    - Last System Admin cannot deactivate/delete.
    - Project owners/team leads receive 422 on `account` when deletion would orphan ownership.
  - Audit actions include:
    - `account.email_change_requested`, `account.email_changed`
    - `account.two_factor_enabled`, `account.two_factor_disabled`
    - `account.recovery_codes_regenerated`
    - `account.deactivated`, `account.deleted`
    - `account.data_exported`, `account.sessions_revoked`
    - `account.password_changed`
- `app/Support/AccountAvatar.php` (new)
  - Stores avatars under `account-avatars/{id}/{uuid}.png`.
  - Generates 1-hour signed URLs via `URL::temporarySignedRoute`.
  - GD-based center crop/resize up to 512 px.
  - Accepts jpg/jpeg/png/webp, max 5 MB, dimensions 64x64 to 2048x2048.
  - N+1 filesystem check removed from resource serialization.
- `app/Actions/Auth/LoginUserAction.php`, `app/Services/Auth/AuthenticationService.php`
  - 2FA challenge during login.
- `app/Actions/Auth/ChangePasswordAction.php`
  - Password hashing, optional other-session revocation, notification, audit log.
- `app/Actions/Auth/UpdateUserProfileAction.php`
  - Validates/persists locale, date format, time format, notification preferences.
  - Forces security/login alert notifications on via `normalizeNotificationPreferences()`.

### Backend: HTTP layer and routes
- `app/Http/Controllers/Api/V1/Auth/AccountSettingsController.php` (modified/new endpoint implementation)
  - Sessions, revoke, security activity, export, avatar upload/remove/serve.
  - Email change request/confirm.
  - 2FA setup/confirm/disable/recovery codes.
  - Deactivate/delete.
  - `Cache-Control: no-store` on disable 2FA, deactivate, destroy.
- `app/Http/Controllers/Api/V1/Auth/AuthController.php`
  - Passes `two_factor_code` to authentication service on login.
- `app/Http/Requests/Api/V1/Auth/LoginRequest.php`
  - Validates `two_factor_code`.
- `app/Http/Requests/Api/V1/Auth/UpdateProfileRequest.php`
  - Validates new profile/preference fields.
- `app/Http/Resources/Api/V1/UserResource.php`
  - Signed avatar URL.
  - `two_factor_enabled` remains visible to authorized viewers.
  - `pending_email` and `recovery_codes_remaining` are owner-only (added after checkpoint review). Non-owner responses omit both keys; owner responses include `pending_email` (including `null`) and the recovery-code count.
- `tests/Feature/Users/UserManagementTest.php`
  - Added `test_account_owner_only_fields_are_not_exposed_to_other_users`: verifies the owner receives both fields via `/api/v1/auth/me` and an authorized admin viewing the same user does not receive them, while `two_factor_enabled` remains visible.
- `app/Http/Resources/Api/V1/UserDirectoryResource.php`
  - Signed avatar URL.
- `app/Http/Resources/Api/V1/UserProfileResource.php`
  - `locale`, `date_format`, `time_format`.
- `routes/api.php`
  - Account endpoints under authenticated/active-account middleware, all scoped to `me`.
  - Signed avatar route outside auth group so `<img>` works.
  - Throttles: 10/min sessions/avatar, 5/min export/2FA/email confirm, 3/min email request/deactivate/delete.
- `app/Http/Controllers/Web/ProfileController.php`
  - Renders Inertia page `AccountSettings`.
- `app/Http/Controllers/Web/SessionController.php`
  - 2FA-aware web login.
- `routes/web.php`
  - `/tasks` now protected by `->can('viewAny', Task::class)`, fixing a pre-existing 403 test failure.

### Backend: notifications
- `app/Notifications/EmailChangeVerificationNotification.php` (new).
- `app/Notifications/PasswordChangedNotification.php` (new).
- `app/Notifications/AppointmentNotification.php`
  - Uses `email_notifications` / `in_app_notifications`, with legacy `email` / `in_app` fallback.
- `app/Notifications/TaskReminder.php`
  - Respects `in_app_notifications`; sends no channel when disabled.
- `app/Notifications/UserInvitationNotification.php`
  - Respects `workspace_invitations` and `email_notifications`; sends no email when either is disabled.
- Security-critical notifications (password reset, password changed, email-change verification) intentionally always send.

### Frontend: API and contracts
- `frontend/src/services/api/contracts.ts`
  - `ApiUserProfile`: locale/date/time.
  - `ApiUser`: pending email, 2FA state, recovery-code count.
  - `LoginRequest`: two-factor code.
  - `UpdateProfileRequest`: locale/date/time.
  - New types: `AccountSession`, `AccountSessionList`, `AccountSecurityEvent`, `TwoFactorSetup`, `TwoFactorConfirmation`, `AccountExport`, `AccountNotificationPreferences`.
- `frontend/src/services/api/accountApi.ts`
  - All account endpoints wired.
- `frontend/src/services/api/apiClient.ts`
  - No forced JSON Content-Type for `FormData` (avatar upload fix).

### Frontend: account feature
New directory `frontend/src/features/account/`:
- `AccountSettings.tsx`: six-section navigation driven by URL search params.
- `AccountSettingsRoute.tsx`: SPA route wrapper.
- `ProfileSection.tsx`: profile form, account info, profile completion.
- `ProfileAvatarEditor.tsx`: avatar preview, upload, remove.
- `SecuritySection.tsx`: password, 2FA, security activity.
- `TwoFactorSettings.tsx`: QR via `qrcode` package; setup/scan/disable/regenerate/recovery-code stages.
- `SessionsSection.tsx`: sessions/devices and revoke actions.
- `NotificationsSection.tsx`: email/in-app/mentions/assignments/task updates/appointments/workspace invitations; security alerts locked on.
- `PreferencesSection.tsx`: theme/appearance, date/time/timezone/language (English only).
- `PrivacySection.tsx`: data export, deactivate, delete with safeguards.
- `shared.tsx`: `SettingsCard`, `formatDateTime`, `LoadingRows`, `QueryError`, `PasswordAction`.
- `AccountSettings.test.tsx`: 4 tests.

Other frontend:
- `frontend/src/pages/AccountSettings.tsx` (new): Inertia wrapper using `enableWebSession`, `MemoryRouter`, `AppShell`; logout posts to `/logout`.
- `frontend/src/app/router/router.tsx`: `/profile` and `/settings/account` route to the new account page.
- `frontend/src/app/router/routes/LazyPages.tsx`: removed old `ProfilePage`; wired new lazy page.
- `frontend/src/components/navigation/user-menu.tsx`: avatar image; deep links to profile/security/notifications/preferences; `reloadDocument` in session mode.
- `frontend/src/features/auth/pages/LoginRoute.tsx`: 2FA code field appears on challenge; recovery-code hint.
- `frontend/src/features/auth/pages/ChangePasswordRoute.tsx`: password strength meter/checklist.
- `frontend/src/features/auth/password-strength.ts` (new) and `password-strength.test.ts` (new).
- `frontend/src/features/auth/pages/LoginRoute.test.tsx` (new): 2FA challenge coverage.
- `frontend/src/App.test.tsx`: profile UI expectations updated; timeouts increased for full-suite stability.
- `frontend/src/features/auth/pages/DashboardRoute.test.tsx` and `frontend/src/features/users/pages/UserDetailsRoute.test.tsx`: fixtures updated for avatar fields.
- `frontend/package.json` and `frontend/package-lock.json`: added approved `qrcode@1.5.4` and `@types/qrcode@1.5.5`.

### Files deleted
- `frontend/src/features/auth/pages/AccountSettings.tsx` (old implementation).
- `frontend/src/features/auth/pages/ProfileRoute.tsx`.
- `frontend/src/pages/Profile.tsx`.

### Tests
- `tests/Feature/Auth/AccountSettingsTest.php` (new); covers:
  - Profile/preferences updates.
  - Email change request/confirm, stale-character refresh, uniqueness race at confirmation.
  - 2FA setup/confirm/replay/recovery codes.
  - Sessions/revocation.
  - Export.
  - Deactivation/delete safeguards.
  - Notification-preference channel enforcement for `TaskReminder` and `UserInvitationNotification`.
- `tests/Feature/InertiaAccountTest.php`: expects Inertia component `AccountSettings`.
- `frontend/src/features/account/AccountSettings.test.tsx`, `frontend/src/features/auth/password-strength.test.ts`, `frontend/src/features/auth/pages/LoginRoute.test.tsx`.

### Verified quality gates (current)
- Backend full suite after owner-only field change: `php artisan test --compact` -> **456 passed, 2589 assertions** (exit 0).
- Backend formatting after owner-only field change: `vendor/bin/pint --test --format agent` -> **passed**.
- Frontend tests: `npm run test --prefix frontend` -> **26 files, 174 tests passed**.
- Frontend typecheck: `npm run typecheck --prefix frontend` -> **exit 0**.
- Frontend lint: `npm run lint --prefix frontend` -> **exit 0** (may print non-blocking `react(set-state-in-effect)` warnings).
- Frontend production build: `npm run build --prefix frontend` -> **succeeded** before the final test-only timeout edit in `App.test.tsx`; typecheck and tests were rerun after that edit.
- Root Inertia asset build after browser QA found stale assets: `npm run build` -> **succeeded**; `public/build/manifest.json` now includes the `AccountSettings` chunk at `public/build/assets/AccountSettings-CIJHoUcT.js`.
- Local migrations applied: both account-related migrations ran successfully.

### Manual browser QA (headless Chrome CDP)
- Browser: installed Google Chrome `157.0.8103.79`, headless via CDP on port `9222`; temporary Node scripts used native WebSocket. No browser-automation dependency was added.
- Test server: `http://127.0.0.1:8001` using a direct PHP server with `upload_tmp_dir=C:\Users\Muniir\AppData\Local\Temp\opencode\php-uploads`. Port `8000` initially failed file uploads because PHP could not create temporary files; this was an environment issue, not an application bug.
- Login: `member@hirgal.local` / `Password123!`.
- Stale production build was found and fixed: `/profile` initially rendered blank with `Error: Unknown Inertia page: AccountSettings`. Root `npm run build` generated the current `AccountSettings` chunk (`public/build/assets/AccountSettings-CIJHoUcT.js`), after which the page loaded.
- PASS: account settings navigation; profile values load; name save persists after reload and was restored.
- PASS: avatar upload and removal (on port `8001`), including signed avatar URL.
- PASS: security section, 2FA setup QR generation, and setup cancellation without enabling 2FA.
- PASS: sessions list and revoke confirmation dialog; no session was actually revoked.
- PASS: security/login alerts remain locked on; notification preference save, reload persistence, and restore.
- PASS: data export downloaded `hirgal-account-export-2026-11-18.json` (`816` bytes), with no secrets found.
- PASS: deactivation and deletion guards; dialogs opened, deletion required typed `DELETE`, both cancelled.
- PASS: user dropdown opens; links navigate to `/profile?section=profile`, `security`, `notifications`, `preferences`; sign out redirects to `/login`; QA user re-login succeeded.
- NOT TESTED: scanning the 2FA QR with a real authenticator app; actually revoking a session; actually deactivating or deleting an account.
- Automation note: CDP `Input.dispatchMouseEvent` did not trigger the Radix dropdown in this headless session. Dispatching a real bubbling `PointerEvent('pointerdown')` on the trigger opened the menu and confirmed the app behavior; the earlier dropdown FAIL was an automation limitation, not an application bug.
- Account state after QA: name restored, avatar removed, notification preference restored, signed out then signed back in. An unconfirmed 2FA setup secret may remain because setup was started and cancelled.

---

## 3. Current Progress

### Specific step in progress
Final reporting. Implementation, automated verification, and headless-browser QA are complete. The remaining action is the final delivery report.

### Last successful operation
- Full manual browser QA pass through the account area, including profile/avatar, security/2FA setup, sessions, notifications, preferences, export, privacy guards, and user menu navigation/sign-out/re-login.
- Targeted regression test passed: `test_account_owner_only_fields_are_not_exposed_to_other_users`.
- Full backend suite passed after the change: **456 passed, 2589 assertions**.
- Full Pint check passed after the change.
- Frontend typecheck, lint, and full tests remain green; root `npm run build` refreshed the Inertia manifest and fixed the blank `/profile` page.

### Exact last action executed
- Ran `hirgal-qa-menu-nav.mjs` through headless Chrome CDP: all 7 checks passed (menu opens, four section links, sign out, re-login).
- Confirmed the earlier dropdown failure was an automation artifact: `Input.dispatchMouseEvent` did not open Radix, while a bubbling `PointerEvent('pointerdown')` did.
- No application source changed during browser QA.

### Exact stopping point
All implementation, automated verification, and browser QA work is complete. The next action is to write the final delivery report.

### Owner-only decision and implementation
- Decision: `pending_email` and `recovery_codes_remaining` should be visible only to the authenticated account owner.
- Rationale:
  - `pending_email` is stored in plaintext and reveals a requested future address.
  - Recovery-code count is security metadata that non-owners do not need.
  - `UserResource` is reused by administrative user detail/list/update endpoints, so the previous global exposure was broader than necessary.
- Implementation in `UserResource::toArray()`:
  - Computes `$isOwner = $request->user()?->is($this->resource) ?? false;`.
  - Wraps `pending_email` and `recovery_codes_remaining` in `when($isOwner, ...)`.
  - Keeps `two_factor_enabled` visible to authorized viewers.
- Regression coverage verified:
  - Owner sees `pending_email`, `two_factor_enabled`, and `recovery_codes_remaining` via `/api/v1/auth/me`.
  - Admin viewing the same user sees `two_factor_enabled` but neither `pending_email` nor `recovery_codes_remaining`.
- Test note: Sanctum guard state persisted between two requests in one test because both users were authenticated via bearer tokens. The test calls `$this->app['auth']->forgetGuards()` before the second request, matching existing project test patterns.

---

## 4. Remaining Work

### Required
1. Produce the final delivery report to the user:
   - Implemented features and owner-only hardening.
   - Verification commands and results.
   - Manual verification status and limits.
   - Deferred items and reasons.
   - Confirmation that nothing was committed or pushed.
2. Do not commit, push, or deploy unless explicitly requested.

### Manual verification checklist status
Final headless-browser QA was performed against the running app via installed Chrome and CDP. No browser-automation dependency was added.

| Checklist item | Status | Evidence |
| --- | --- | --- |
| `/profile` and `/settings/account` resolve to the account UI | PASS | Inertia `AccountSettings` page loaded in Chrome after the build refresh; `InertiaAccountTest` passes |
| Section navigation (profile/security/sessions/notifications/preferences/privacy) | PASS | In-browser section navigation and all four deep links verified |
| User dropdown opens; links and sign out work | PASS | Menu items visible; all four section links reached expected URLs; sign out redirected to `/login`; re-login succeeded |
| Profile save behavior and persistence | PASS | Edited name, saved, reloaded, and restored; toast and persisted value verified |
| Avatar upload/remove | PASS | PNG upload and signed avatar URL verified on port `8001`; avatar removed; upload failure on `8000` traced to PHP temp-file environment |
| 2FA setup QR generation and cancellation | PASS | QR data URL generated; setup cancelled; 2FA remained disabled |
| 2FA confirm/disable/recovery-code use with real authenticator | NOT TESTED | Requires a real authenticator app/device; automated backend coverage exists |
| Session list and revoke confirmation | PASS | Session list loaded; dialog opened and was cancelled |
| Actual session revocation | NOT TESTED | Avoided revoking a real session; automated backend coverage exists |
| Notification save, reload persistence, restore | PASS | Toggled preference, saved, reloaded, verified change, restored |
| Preferences persistence | NOT TESTED manually | Section loads; automated frontend/backend tests cover saving |
| Data export | PASS | Downloaded `hirgal-account-export-2026-11-18.json` (`816` bytes); no secrets found |
| Deactivation/deletion guards | PASS | Dialogs and typed `DELETE` guard verified; both cancelled |
| Actual deactivation/deletion | NOT TESTED | Destructive actions were not submitted against the dev account |
| Account owner-only API fields | PASS | `UserManagementTest.php` regression test |
| Visual layout/responsive audit | NOT TESTED comprehensively | Desktop pages visually loaded; no multi-viewport visual audit |

Remaining optional human checks:
- Scan the 2FA QR with a real authenticator and complete confirmation.
- Revoke a disposable session.
- Run deactivate/delete against a disposable account.
- Perform a multi-viewport visual/responsive review.

### Explicitly deferred / out of scope
3. Passkeys/WebAuthn: deferred because it requires an unapproved dependency.
4. Additional languages: deferred because no translations exist; language selector is English-only and communicates that.

### Completion estimate
- In-scope implementation: complete and verified by automated tests/build/typecheck/lint plus headless-browser QA.
- Owner-only hardening: complete and verified.
- Remaining: final delivery report and optional real-device/destructive checks.
- No reliable percentage is asserted; no required coding work is known to remain.

### Dependencies and blockers
- No code blockers.
- Browser QA required no new dependency, using installed Chrome/CDP via temporary scripts.
- Direct port `8000` uploads require a valid PHP `upload_tmp_dir`; `8001` was used successfully for avatar QA.
- Any change to dependencies requires approval; `qrcode` was explicitly approved by the user.
- No commit/push expected.

---

## 5. Errors and Issues

### Resolved
1. **2FA tests failed under time travel**
   - Cause: `time()` was not Carbon-test-travel aware.
   - Fix: use `now()->getTimestamp()` in `TwoFactorAuthenticationService`.
2. **Email-change confirmation used a stale user model**
   - Cause: `actingAs` test model was not refreshed before confirmation.
   - Fix: `$user->refresh()` at the start of `confirmEmailChange`.
3. **Email uniqueness race at confirmation**
   - Cause: address could be claimed between request and confirmation.
   - Fix: uniqueness check inside the confirmation transaction; validation error on `email`.
4. **Avatar resource caused N+1 filesystem checks**
   - Cause: per-row `Storage::exists` call.
   - Fix: removed the check; signed URL generation is storage-independent.
5. **Pre-existing `/tasks` test returned 403**
   - Cause: route lacked authorization.
   - Fix: `->can('viewAny', Task::class)`; Inertia test expectation updated separately.
6. **Avatar upload sent wrong Content-Type**
   - Cause: axios interceptor forced JSON globally.
   - Fix: skip forced JSON header for `FormData`.
7. **`App.test.tsx` intermittent full-suite failure**
   - Cause: likely slow lazy chunk/import under full-suite load hitting default wait timeouts.
   - Fix: increased `findByLabelText` and `waitFor` timeouts in the profile submission test.
   - Verified: full frontend suite passes (174/174); targeted reruns also passed.
8. **Pint failed on a pre-existing pending-email migration**
   - Cause: class formatting/line endings/braces position.
   - Fix: ran Pint on that migration. Style-only change; full Pint now passes.
9. **Avatar PNG decoding via GD risk**
   - Cause: previously considered parsing untrusted PNG chunks manually.
   - Fix: switched to `imagecreatefromstring` with validation and safe failure handling.
10. **Admin privacy regression test authenticated as the previous user**
    - Cause: Sanctum guard state persisted between two bearer-token requests in the same test.
    - Symptom: admin request received the member's `pending_email`; test dumped `auth('sanctum')->id()` as the member while a member token had been used earlier.
    - Fix: call `$this->app['auth']->forgetGuards()` before the admin request, consistent with existing tests.
    - Verified: targeted test and full suite pass.
11. **`/profile` rendered blank in browser**
    - Cause: stale production `public/build` assets did not contain the `AccountSettings` Inertia page; runtime error was `Unknown Inertia page: AccountSettings`.
    - Fix: ran root `npm run build`; manifest now references `public/build/assets/AccountSettings-CIJHoUcT.js`.
    - Verified: `/profile` loads all account sections in headless Chrome.
12. **User dropdown appeared not to open during automated QA**
    - Cause: CDP `Input.dispatchMouseEvent` did not trigger the Radix `pointerdown` handler in this headless session; this was an automation limitation, not an app defect.
    - Fix: dispatched a bubbling `PointerEvent('pointerdown')`; menu opened and all links/sign-out worked.
    - Verified: 7/7 menu navigation checks passed; no application code change needed.
13. **Avatar upload returned 422 on port `8000`**
    - Cause: PHP could not create temporary upload files (`File upload error - unable to create a temporary file`).
    - Fix: started direct server on `8001` with an explicit `upload_tmp_dir`; upload succeeded.
    - Status: environment configuration issue, not application code.

### Known non-blocking warnings
- Frontend lint exits 0 but may report `react(set-state-in-effect)` warnings in account components. These are warnings, not errors, and do not fail lint.
- A PHP server without a writable `upload_tmp_dir` will reject avatar uploads. This is environment-dependent.

### Unresolved
- None confirmed. All in-scope application behavior is implemented and verified.
- Real authenticator confirmation, real session revocation, and destructive account actions remain optional NOT TESTED checks.

---

## 6. Resume Instructions

### First files to open
1. `app/Http/Resources/Api/V1/UserResource.php` to confirm the owner-only guard.
2. `tests/Feature/Users/UserManagementTest.php` around `test_account_owner_only_fields_are_not_exposed_to_other_users`.
3. This checkpoint for the remaining reporting/manual-verification status.

### Section to continue from
`UserResource::toArray()`:
```php
$isOwner = $request->user()?->is($this->resource) ?? false;

'pending_email' => $this->when($isOwner, fn (): ?string => $this->pending_email),
'two_factor_enabled' => $this->hasTwoFactorAuthentication(),
'recovery_codes_remaining' => $this->when(
    $isOwner,
    fn (): int => count($this->two_factor_recovery_codes ?? [])
),
```

### Next action
1. Prepare and send the final delivery report. Do not repeat implementation work.
2. Report the current verified results:
   - Backend: 456 tests, 2589 assertions passed; Pint passed.
   - Frontend: 26 files / 174 tests passed; typecheck and lint exit 0; root `npm run build` succeeded and refreshed the Inertia manifest.
   - Browser QA: PASS for navigation, profile persistence, avatar upload/remove, 2FA QR/cancel, notifications persistence, export, privacy guards, user menu links/sign-out/re-login.
   - NOT TESTED: real authenticator confirmation, actual session revocation, destructive deactivate/delete, comprehensive responsive audit.
   - Owner-only fields: implemented and regression-tested.
   - Deferred: Passkeys/WebAuthn, additional languages.
   - No commit/push performed.
3. Do not add browser automation dependencies unless explicitly authorized; none were needed for the QA performed.

### Commands to verify again if needed
```powershell
vendor/bin/pint --test --format agent
php artisan test --compact tests/Feature/Users/UserManagementTest.php --filter=account_owner_only_fields
php artisan test --compact
npm run typecheck --prefix frontend
npm run test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
npm run build
```

### Decisions/details to preserve
- `pending_email` and `recovery_codes_remaining` are owner-only; `two_factor_enabled` remains visible to authorized viewers.
- Use `$this->app['auth']->forgetGuards()` between multiple bearer-token authentications in one feature test.
- User approved `qrcode@1.5.4` and `@types/qrcode@1.5.5`; do not remove.
- Avatar signed route must remain outside the auth middleware group and retain the `version` regex constraint.
- 2FA replay protection depends on `two_factor_last_used_step`.
- Security/login alert notification preferences are forced on server-side.
- Account deletion is soft delete; ownership safeguards must remain.
- A blank `/profile` with `Unknown Inertia page: AccountSettings` indicates stale `public/build`; run root `npm run build`, not only the frontend build.
- Headless Radix dropdown checks need a real bubbling `pointerdown`; CDP mouse events alone may not open the menu.
- Avatar QA requires a writable PHP `upload_tmp_dir`; use port `8001` with an explicit temp directory if port `8000` returns a temp-file upload error.
- Do not commit or push without explicit instruction.
- Do not create additional documentation files beyond this requested checkpoint.

---

## 7. Important Project Context

### Stack and environment
- Laravel 13.39.0, PHP 8.4.26, Sanctum, Inertia v3.
- React 19, TypeScript, Tailwind 4, Radix UI, TanStack Query 5, react-router-dom 7, zod, Vitest, oxlint.
- Windows PowerShell 5.1; repository root `C:\Users\Muniir\Herd\Hirgal`.
- Backend tests use SQLite `:memory:`; seeders: `RoleSeeder`, `PermissionSeeder`, `RolePermissionSeeder`.
- Current local dev database has both account migrations applied.

### Constraints and conventions
- Follow Laravel Boost rules in `AGENTS.md`.
- PHP: explicit types, constructor property promotion, braces for control structures, TitleCase enum keys, PHPDoc blocks.
- Use existing components/patterns; no new base folders without approval.
- Do not change dependencies without approval.
- No documentation files unless explicitly requested; this checkpoint was explicitly requested.
- No commit, amend, push, or PR unless explicitly requested.
- Frontend build assets (`dist/`) are generated but not listed by `git status` (ignored).

### Relevant files
- Backend core:
  - `app/Http/Controllers/Api/V1/Auth/AccountSettingsController.php`
  - `app/Services/User/AccountSettingsService.php`
  - `app/Services/Security/TwoFactorAuthenticationService.php`
  - `app/Support/AccountAvatar.php`
  - `app/Models/User.php`
  - `app/Models/UserProfile.php`
  - `routes/api.php`
  - `routes/web.php`
- Frontend core:
  - `frontend/src/features/account/`
  - `frontend/src/pages/AccountSettings.tsx`
  - `frontend/src/app/router/router.tsx`
  - `frontend/src/components/navigation/user-menu.tsx`
  - `frontend/src/services/api/accountApi.ts`
  - `frontend/src/services/api/contracts.ts`
- Tests:
  - `tests/Feature/Auth/AccountSettingsTest.php`
  - `tests/Feature/InertiaAccountTest.php`
  - `frontend/src/features/account/AccountSettings.test.tsx`
  - `frontend/src/features/auth/pages/LoginRoute.test.tsx`
  - `frontend/src/features/auth/password-strength.test.ts`
- Migrations:
  - `database/migrations/2026_11_17_162646_add_two_factor_and_account_preferences.php`
  - `database/migrations/2026_11_17_152657_add_pending_email_change_to_users_table.php`
- Build/QA artifacts:
  - `public/build/manifest.json`
  - `public/build/assets/AccountSettings-CIJHoUcT.js`
  - `C:\Users\Muniir\AppData\Local\Temp\opencode\hirgal-qa-lib.mjs`
  - `C:\Users\Muniir\AppData\Local\Temp\opencode\hirgal-qa-full-8001.mjs`
  - `C:\Users\Muniir\AppData\Local\Temp\opencode\hirgal-qa-menu-nav.mjs`
  - `C:\Users\Muniir\AppData\Local\Temp\opencode\qa-menu-final.png`

---

## 8. Save the Checkpoint

Checkpoint saved at:

`C:\Users\Muniir\Herd\Hirgal\docs\WORK_CHECKPOINT.md`

This checkpoint was updated after final headless-browser QA. All prior work is preserved. No commit or push was performed.
