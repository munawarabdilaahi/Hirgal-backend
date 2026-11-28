# Hirgal

Hirgal is an API-first project management and team collaboration backend built with Laravel. Its versioned REST API is served under `/api/v1`.

The canonical Laravel application root is this repository directory. Application code, configuration, dependencies, documentation, and tests are kept together here; do not create or maintain a nested copy of the project.

## Project status

The application includes authentication, user administration, projects, teams, tasks, appointments, habits, activity, and notifications. Laravel serves an Inertia/React workspace alongside the versioned API. Features and operational readiness should be verified in staging before public use.

The React frontend contains workspace screens and API integrations; the root Vite build produces the assets served by Laravel.

See [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the architecture, security and authorization decisions, implemented modules, completed phases, known issues, and roadmap.

## Requirements

- PHP 8.4
- Composer
- Node.js and npm for the configured Vite build
- SQLite for the PHPUnit in-memory test suite; MySQL 8 for production and MySQL-specific database tests

## Local setup

From the repository root:

```sh
composer install
```

Create a local `.env` from `.env.example` if needed, configure its database and mail settings, then generate the application key:

```sh
php artisan key:generate
```

Run migrations only against a new or intentionally selected development database:

```sh
php artisan migrate
```

The [frontend/](frontend/) directory contains the independent React/TypeScript application. It contains the workspace, shared components, and API integrations. See [frontend/README.md](frontend/README.md) and [frontend/docs/DESIGN_SYSTEM.md](frontend/docs/DESIGN_SYSTEM.md).

## Verification

Run the PHPUnit suite:

```sh
php artisan test --compact
```

Inspect registered application routes:

```sh
php artisan route:list --except-vendor
```

Build the configured Vite assets when the Node dependencies are installed:

```sh
npm run build
```

## Project documentation

- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — authoritative project and architecture context
- [AGENTS.md](AGENTS.md) — Laravel and agent development instructions
- [CLAUDE.md](CLAUDE.md) — compatible copy of the agent instructions
- [docs/](docs/) — API and database specifications
- [frontend/README.md](frontend/README.md) — frontend setup, architecture, API contracts, and authentication strategy

## Staging deployment

Use a private staging environment with a separate database and credentials. Never copy production data or secrets into staging without an approved process. The web server's document root must be `public/`; terminate HTTPS at the trusted proxy or web server.

1. Install PHP 8.4 with the required Composer extensions, Composer, Node.js, and MySQL 8. Install PHP packages with `composer install --no-dev --optimize-autoloader`, both locked Node dependency sets with `npm ci --ignore-scripts` and `npm ci --prefix frontend`, then configure the build-time Vite variables described below and run the **root** `npm run build` to generate Laravel's Vite manifest. Run the full test suites in CI before installing production-only dependencies.
2. Supply secrets using the host's secret manager. Set `APP_ENV=staging`, `APP_DEBUG=false`, the HTTPS `APP_URL` and `FRONTEND_URL`, an independent `APP_KEY`, MySQL credentials, `SESSION_SECURE_COOKIE=true`, and `SANCTUM_STATEFUL_DOMAINS` for the actual browser hosts and ports. Generate the key only on initial setup and preserve it across releases and restores. Before building, set `VITE_API_BASE_URL` to the public HTTPS API URL ending in `/api/v1`; these values are embedded at build time and must not contain secrets. Set `VITE_REVERB_APP_KEY`, `VITE_REVERB_HOST`, `VITE_REVERB_PORT`, and `VITE_REVERB_SCHEME` when using realtime notifications. Configure a real mail transport and sender; `MAIL_MAILER=log` does not deliver invitations or password resets. Configure trusted proxies for the actual infrastructure when TLS terminates upstream.
3. Run `php artisan migrate --force`, then the three core seeders individually with `php artisan db:seed --class=RoleSeeder --force`, `php artisan db:seed --class=PermissionSeeder --force`, and `php artisan db:seed --class=RolePermissionSeeder --force`. Demo seeders are restricted to local and testing environments. For a new empty installation, run `php artisan hirgal:bootstrap-admin` from an interactive trusted terminal, then sign in and enable two-factor authentication. The command refuses to create an administrator if an admin role assignment or matching email already exists.
4. Configure a supervised `php artisan queue:work --tries=3 --timeout=60` worker and invoke `php artisan schedule:run` every minute. Set the queue retry interval above the worker timeout; alert on failed jobs and worker or scheduler failures. Configure Reverb only if realtime notifications are enabled: set its credentials, `BROADCAST_CONNECTION=reverb`, the Vite Reverb settings, and `REVERB_ALLOWED_ORIGINS` to a comma-separated list of browser hostnames without schemes or ports. Proxy WebSocket connections over TLS and supervise the Reverb process.
5. After environment configuration, run `php artisan optimize` on the release. Preserve writable `storage/` and `bootstrap/cache/` as needed. Keep application files, `.env`, and private storage outside the public document root; provide persistent storage for uploads. Use a shared cache/lock store when running multiple servers.
6. Configure off-host database and uploaded-file backups, test restoration, and set up application error, health, queue, and uptime monitoring. Verify a rollback and restoration in staging before accepting real data.
7. On the real staging domain verify login, two-factor recovery, invitations and password-reset email, role boundaries, uploads, reminders, realtime connections if enabled, and a deploy/rollback. Run the MySQL-specific constraint and concurrency tests against a dedicated disposable MySQL test database; the default PHPUnit suite uses SQLite and may skip MySQL-only checks.

Treat `APP_ENV=staging` as production-like: demo seed data and raw invitation tokens are restricted to `local` and `testing`. Staging is not ready until these infrastructure-dependent checks pass.
