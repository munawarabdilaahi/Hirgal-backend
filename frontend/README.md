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

`src/features/` is organized by backend domain. Frontend Phases 1 and 2 provide infrastructure and design-system components only. The login, dashboard, users, projects, teams, and tasks routes remain explicit deferred placeholders and make no API calls.

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
```

## Environment

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the Laravel API root, including `/api/v1`. The default is `http://127.0.0.1:8000/api/v1`. `VITE_APP_NAME` defaults to `Hirgal`.

Vite exposes every `VITE_*` value to browser code. Do not put credentials, private API keys, or other secrets in these variables.

The backend's current CORS configuration allows local Vite origins on port 5173 and Laravel's configured frontend origin. If Vite selects another port or the frontend uses a different origin, the backend CORS allowlist must be configured by a separately authorized backend change.

## API contracts and errors

The Laravel API wraps successful results as `{ success: true, message, data }`, optionally with pagination `meta`. Error responses use `{ success: false, message, errors, error_code? }`; validation failures use HTTP 422 and field errors, while authorization, missing resources, and server failures use HTTP 403, 404, and 500 respectively. Missing/invalid authentication is HTTP 401.

The shared Axios client sends JSON headers, normalizes these errors to `ApiError`, distinguishes network failures, and clears the in-memory bearer token after HTTP 401. Feature services should unwrap `response.data` and use the shared response types rather than redefining envelopes.

## Authentication strategy

The backend issues Laravel Sanctum bearer tokens from `POST /api/v1/auth/login`; `GET /api/v1/auth/me` returns the authenticated user, roles, permissions, and profile. `POST /api/v1/auth/logout` revokes the current token, while `/auth/logout-all` revokes all tokens. Authenticated requests from an inactive account receive HTTP 403 with `ACCOUNT_NOT_ACTIVE`; login for an inactive account currently returns HTTP 403 with `FORBIDDEN`.

The Phase 1 token store is memory-only. This avoids persisting bearer credentials in `localStorage` or `sessionStorage`, but a page reload clears the token and signs the user out; the token remains accessible to JavaScript while the app is running. No login flow or authentication UI is implemented. A later authentication phase should assess a backend-supported HttpOnly cookie/session design against this trade-off before choosing persistence.

## Testing and limitations

Vitest and Testing Library are configured. Tests cover API client configuration, bearer-header injection, 401 token clearing, backend error normalization, network failures, theme persistence, showcase rendering, and dialog/mobile navigation interactions.

Appointments, habits, mentions/follow-up, and activity-log APIs are not implemented by the backend and have no frontend integrations. User administration, projects, teams, and task routes remain placeholders until their feature phases are authorized.

The application shell and design-system showcase are not business feature pages. Planned navigation entries remain marked and disabled where applicable; illustrative showcase content is static and never presented as live account or workspace data.
