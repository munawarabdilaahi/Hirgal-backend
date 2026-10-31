# Hirgal Database Architecture & Data Dictionary

## 1. Executive Overview

This directory contains the complete, production-grade database design and relationship architecture for **Hirgal** — a modern Project Management and Team Collaboration Platform built on **Laravel 13**, **PHP 8.4**, and **MySQL 8.0+**.

The database architecture is designed with a strict normalized relational model (3NF), fine-grained multi-tenancy boundaries, defensive referential integrity, and high-performance composite indexing.

## 2. Architectural Principles

1. **Dual Identification Strategy (BIGINT PK + Public UUID):**
   - **Internal Joins:** Clustered Primary Keys use `BIGINT UNSIGNED AUTO_INCREMENT` for maximum B-tree indexing efficiency, foreign key performance, and storage compactness.
   - **External Routing:** Client-facing resources (`projects`, `tasks`, `teams`, `appointments`, `habits`) maintain an indexed `uuid` (CHAR 36) to prevent sequential resource enumeration attacks.
   - **Security Distinction:** A UUID is **solely an unpredictable identifier**. It does NOT provide authentication, authorization, or project membership verification. Every endpoint must validate access through Laravel Policies and explicit tenant-scoped queries.
2. **Explicit Query Scoping Over Global Scopes:**
   - Multi-tenant data isolation is enforced via **explicit project-scoped queries** and **Laravel Policies**, avoiding hidden global Eloquent scopes that can silently corrupt background queue jobs, CLI commands, reporting aggregations, or system administration views.
3. **Strict Referential Integrity & Relational Ownership Constraints:**
   - Explicit Foreign Key constraints define cascading deletions (`CASCADE`), protective restrictions (`RESTRICT`), or disassociations (`SET NULL`).
   - Habit log ownership integrity is enforced directly at the storage engine level via composite foreign keys `(habit_id, user_id)` referencing `habits(id, user_id)`.
4. **Application-Level Enums over MySQL ENUMs:**
   - Categorical fields (`status`, `priority`, `role`, `frequency`) use `VARCHAR(50)` backed by strongly-typed PHP 8.4 Enums.
   - Modifying statuses or adding new workflow stages requires zero database migration downtime, avoiding MySQL `ALTER TABLE` exclusive metadata table locks.
5. **Defensive Token Security:**
   - User and project invitation tokens are never stored in plaintext. Only SHA-256 hashes (`token_hash` CHAR 64) are persisted to protect against credential harvesting during database backups or breaches.
6. **Clear Separation of Business Domain vs Framework Infrastructure Tables:**
   - The schema cleanly differentiates Hirgal's proprietary business domain models from Laravel framework-managed infrastructure tables (authentication tokens, sessions, notifications, queues, cache).

## 3. Database Table Classification & Inventory (32 Total Tables)

The database schema comprises **32 total tables**, cleanly partitioned into **23 Core Business Domain Tables** and **9 Laravel Framework Infrastructure Tables**:

### A. Core Business Domain Tables (23 Tables)
These tables model the proprietary business domains and entities of the Hirgal platform, directly corresponding to the 23 Eloquent models in `app/Models/`:

| Domain | Tables | Count | Responsibilities |
| :--- | :--- | :---: | :--- |
| **1. Identity & Profiles** | `users`, `user_profiles`, `user_invitations` | 3 | User credentials, extended profile, and onboarding invitations. |
| **2. Global RBAC** | `roles`, `permissions`, `role_permissions`, `user_roles` | 4 | System-wide administrative permissions, capabilities, and role assignments. |
| **3. Projects & Tenancy** | `projects`, `project_members`, `project_invitations` | 3 | Workspace boundaries, contextual project roles, and project invitations. |
| **4. Teams** | `teams`, `team_members`, `project_teams` | 3 | Cross-functional squads, member rosters, and multi-team allocations. |
| **5. Tasks & Work Management** | `tasks`, `task_assignments`, `task_comments`, `task_attachments` | 4 | Kanban items, subtasks, task delegations, threaded discussions, attachments. |
| **6. Appointments** | `appointments`, `appointment_participants` | 2 | Calendar syncs, video meeting links, and RSVP attendance tracking. |
| **7. Follow-Up Inbox** | `user_mentions` | 1 | High-speed index table for `@mentions` across tasks and comments. |
| **8. Habit Tracker** | `habits`, `habit_logs` | 2 | Habit definitions, frequency schedules, and daily completion records. |
| **9. Auditing & Logs** | `activity_logs` | 1 | Polymorphic audit trail capturing actor, IP, subject, and JSON diffs. |
| **Subtotal (Core Domain)** | | **23** | |

### B. Laravel Framework Infrastructure Tables (9 Tables)
These tables are managed by Laravel internal drivers and first-party packages:

| Category | Tables | Count | Management Subsystem |
| :--- | :--- | :---: | :--- |
| **Authentication & Sessions** | `sessions`, `password_reset_tokens`, `personal_access_tokens` | 3 | Laravel session driver, password broker, and Laravel Sanctum bearer tokens. |
| **Notifications** | `notifications` | 1 | Laravel native database notification driver (`DatabaseNotification`). |
| **Queue & Jobs** | `jobs`, `job_batches`, `failed_jobs` | 3 | Laravel queue worker, job batch coordinator, and dead-letter queue. |
| **Cache & Coordination** | `cache`, `cache_locks` | 2 | Laravel database cache driver and distributed atomic mutex locks. |
| **Subtotal (Infrastructure)** | | **9** | |
| **TOTAL DATABASE TABLES** | | **32** | |

## 4. Documentation Index

- [Complete Table & Column Schema (SCHEMA.md)](SCHEMA.md)
- [Eloquent & Foreign Key Relationships (RELATIONSHIPS.md)](RELATIONSHIPS.md)
- [Full Entity Relationship Diagram (ERD.md)](ERD.md)
- [Indexing, Performance & Constraints (INDEXING-STRATEGY.md)](INDEXING-STRATEGY.md)
- [Authorization, IDOR Defense & Data Isolation (SECURITY-AND-ISOLATION.md)](SECURITY-AND-ISOLATION.md)
