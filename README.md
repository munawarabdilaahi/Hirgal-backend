# Hirgal

Hirgal is an API-first project management and team collaboration backend built with Laravel. Its versioned REST API is served under `/api/v1`.

The canonical Laravel application root is this repository directory. Application code, configuration, dependencies, documentation, and tests are kept together here; do not create or maintain a nested copy of the project.

## Project status

Phase 6.2 is complete. Authentication, user administration, projects, teams, tasks, and task assignments are implemented. The database foundations for appointments, habits, mentions, and activity logs are retained for planned future phases; their APIs are not yet implemented.

The separate React frontend has completed its Phase 1 infrastructure and Phase 2 design-system foundations. Business screens and integrations remain deferred.

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

The [frontend/](frontend/) directory contains the independent React/TypeScript application. It currently provides architecture, shared design-system components, and a development-only showcase; no business feature screens or integrations are implemented yet. See [frontend/README.md](frontend/README.md) and [frontend/docs/DESIGN_SYSTEM.md](frontend/docs/DESIGN_SYSTEM.md).

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
