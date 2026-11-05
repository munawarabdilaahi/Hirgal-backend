# Hirgal Frontend

The independent React frontend for Hirgal. The Laravel API remains at the repository root; this directory is a separate Vite application and does not change or replace backend files.

## Architecture

- React 19 and strict TypeScript for the application.
- Vite for development and production bundling.
- Tailwind CSS 4 and shadcn/ui-compatible components and configuration.
- Radix UI primitives for accessible interactive components; Sonner for transient notifications.
- React Router for the route foundation.
- TanStack Query for future server-state integration.
- Axios for a centralized JSON API client.
- React Hook Form and Zod are available for future feature forms.
- Lucide React for icons.

`src/features/` is organized by backend domain. Frontend Phases 1 and 2 provide infrastructure and design-system components. Phase 3 adds authentication, account profile, and password flows. Phase 4 adds the authenticated dashboard, permission-aware people directory, and administrative user listing/details and account actions. Projects, teams, and tasks remain deferred placeholders.

## Structure

```text
frontend/
├── public/
├── src/
│   ├── app/                 # Application configuration, providers, and routes
│   │   └── router/routes/design-system/ # Development showcase sections
│   ├── assets/
│   ├── components/
│   │   ├── feedback/        # Error, loading, and empty states
│   │   ├── layout/          # App shell and responsive layout primitives
│   │   ├── navigation/      # Theme and account menu foundations
│   │   └── ui/              # Reusable accessible design-system components
│   ├── features/            # Future domain-specific features
│   ├── hooks/
│   ├── lib/
│   ├── services/api/        # Axios client, contracts, and error normalization
│   ├── styles/
│   ├── test/
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── components.json
├── docs/DESIGN_SYSTEM.md
├── package.json
├── tsconfig*.json
└── vite.config.ts
```

## Installation and commands

From `frontend/`:

```sh
npm ci
npm run dev
```

The development server exposes the component showcase at `http://localhost:5173/dev/design-system`. The route is not registered in production builds. See [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) for design tokens, theme behavior, component inventory, and accessibility conventions.

Quality checks:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

## Environment

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the Laravel API root, including `/api/v1`. The default is `http://127.0.0.1:8000/api/v1`. `VITE_APP_NAME` defaults to `Hirgal`.

Vite exposes every `VITE_*` value to browser code. Do not put credentials, private API keys, or other secrets in these variables.

The backend's current CORS configuration allows local Vite origins on port 5173 and Laravel's configured frontend origin. If Vite selects another port or the frontend uses a different origin, the backend CORS allowlist must be configured by a separately authorized backend change.

## API contracts and errors

The Laravel API wraps successful results as `{ success: true, message, data }`, optionally with pagination `meta`. Error responses use `{ success: false, message, errors, error_code? }`; validation failures use HTTP 422 and field errors, while authorization, missing resources, and server failures use HTTP 403, 404, and 500 respectively. Missing/invalid authentication is HTTP 401.

The shared Axios client sends JSON headers, normalizes these errors to `ApiError`, distinguishes network failures, and clears the in-memory bearer token after HTTP 401. Feature services should unwrap `response.data` and use the shared response types rather than redefining envelopes.

## Authentication strategy

The frontend implements the Laravel Sanctum auth contracts: login, current-user retrieval, logout, profile update, forgot/reset password, and change password. See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) for request/response details, route behavior, the coverage matrix, and audited limitations. Authenticated requests from an inactive account receive HTTP 403 with `ACCOUNT_NOT_ACTIVE`; inactive login attempts receive generic HTTP 403 `FORBIDDEN`.

The token store remains memory-only. No bearer credentials are persisted to `localStorage` or `sessionStorage`; a page reload clears the token and signs the user out. No automatic restoration is possible with this design. A future persistence change should assess a backend-supported HttpOnly cookie/session design before implementation.

## Testing and limitations

Vitest and Testing Library are configured. Tests cover authentication routes and forms, permission helpers, redirect safety, 401/403/inactive token handling, API error normalization, theme persistence, showcase rendering, and design-system interactions. Frontend auth tests use mocked API responses; no real HTTP integration is claimed. See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md).

The dashboard has no aggregate/activity API and displays authenticated account data only. The directory and user administration integrations and their exact backend limitations are documented in [DASHBOARD.md](docs/DASHBOARD.md), [USER_DIRECTORY.md](docs/USER_DIRECTORY.md), and [USER_ADMINISTRATION.md](docs/USER_ADMINISTRATION.md). In particular, global role assignment is not exposed because there is no roles-list endpoint. Route-level lazy loading splits authenticated and user feature pages; the Phase 4.1 build's main chunk is 369.22 kB (114.68 kB gzip) across 27 emitted JavaScript chunks, with no Vite large-chunk warning. Projects, teams, tasks, appointments, habits, mentions/follow-up, and activity-log routes remain outside this frontend phase; absent APIs have no frontend integrations.

The application shell and design-system showcase are not business feature pages. Planned navigation entries remain marked and disabled where applicable; illustrative showcase content is static and never presented as live account or workspace data.
