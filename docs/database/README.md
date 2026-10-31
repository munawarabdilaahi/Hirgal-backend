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
6. **Laravel Native Interoperability:**
   - The notification infrastructure adheres directly to Laravel's native UUID-based polymorphic notification schema, enabling seamless integration with `Illuminate\Notifications\DatabaseNotification`.

## 3. Database Domain Inventory (Exactly 27 Domain Tables)

The **27 normalized domain tables** are distributed across 9 core business domains:

| Domain | Tables | Count | Key Responsibilities |
| :--- | :--- | :---: | :--- |
| **1. Authentication & Identity** | `users`, `user_profiles`, `user_invitations`, `password_reset_tokens`, `personal_access_tokens`, `sessions` | 6 | Credentials, sessions, user metadata, onboarding tokens. |
| **2. Global RBAC** | `roles`, `permissions`, `role_permissions`, `user_roles` | 4 | System-wide administrative permissions and role definitions. |
| **3. Projects & Tenancy** | `projects`, `project_members`, `project_invitations` | 3 | Project boundary definitions, project-level roles, and project invitations. |
| **4. Teams** | `teams`, `team_members`, `project_teams` | 3 | Cross-functional squads, member rosters, and multi-team project allocations. |
| **5. Tasks & Work Management** | `tasks`, `task_assignments`, `task_comments`, `task_attachments` | 4 | Kanban/list work items, subtasks, multi-user assignment, threading, file records. |
| **6. Appointments** | `appointments`, `appointment_participants` | 2 | Meeting schedules, video links, calendar RSVPs, participant statuses. |
| **7. Follow-Up Inbox** | `notifications`, `user_mentions` | 2 | Laravel database notifications and high-speed `@mentions` indexing. |
| **8. Habit Tracker** | `habits`, `habit_logs` | 2 | Daily/weekly habit definitions, target day schedules, and daily completion logs. |
| **9. Auditing & Logs** | `activity_logs` | 1 | Polymorphic audit trails capturing actor, IP, subject, and old/new attribute diffs. |
| **TOTAL** | | **27** | |

*(Note: Framework-level queue and cache tables `jobs`, `job_batches`, `failed_jobs`, `cache`, `cache_locks` are managed by Laravel and are auxiliary to the 27 domain tables above).*

## 4. Documentation Index

- [Complete Table & Column Schema (SCHEMA.md)](SCHEMA.md)
- [Eloquent & Foreign Key Relationships (RELATIONSHIPS.md)](RELATIONSHIPS.md)
- [Full Entity Relationship Diagram (ERD.md)](ERD.md)
- [Indexing, Performance & Constraints (INDEXING-STRATEGY.md)](INDEXING-STRATEGY.md)
- [Authorization, IDOR Defense & Data Isolation (SECURITY-AND-ISOLATION.md)](SECURITY-AND-ISOLATION.md)
