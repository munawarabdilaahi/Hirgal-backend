# Hirgal Detailed Table and Column Specifications (32 Tables)

This document defines every table, column, data type, nullability constraint, default value, and architectural rationale across all **32 tables** in the Hirgal database, explicitly distinguishing **23 Core Business Domain Tables** from **9 Laravel Framework Infrastructure Tables**.

---

# SECTION 1: CORE BUSINESS DOMAIN TABLES (23 Tables)

## Domain 1: Identity & Profiles (3 Tables)

### 1. `users`
Core user identity and authentication credentials.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Internal clustered primary key |
| `name` | `VARCHAR(255)` | NOT NULL | None | None | Full display name |
| `email` | `VARCHAR(255)` | NOT NULL | None | UNIQUE (`users_email_unique`) | Unique user login email address |
| `email_verified_at` | `TIMESTAMP` | NULL | NULL | None | Email verification timestamp |
| `password` | `VARCHAR(255)` | NOT NULL | None | None | Bcrypt/Argon2id hashed password string |
| `account_status` | `VARCHAR(50)` | NOT NULL | `'active'` | INDEX (`users_status_idx`) | Status: `active`, `suspended`, `pending` |
| `avatar_url` | `VARCHAR(1024)` | NULL | NULL | None | Profile avatar image location URL |
| `timezone` | `VARCHAR(50)` | NOT NULL | `'UTC'` | None | IANA timezone identifier for appointments & habits |
| `last_login_at` | `TIMESTAMP` | NULL | NULL | None | Most recent authenticated session timestamp |
| `remember_token` | `VARCHAR(100)` | NULL | NULL | None | Laravel standard remember me token |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| `deleted_at` | `TIMESTAMP` | NULL | NULL | INDEX (`users_deleted_at_idx`) | Soft delete timestamp for account deactivation |

---

### 2. `user_profiles`
Extended user biography and application preferences (1:1 with `users`).

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Profile record primary key |
| `user_id` | `BIGINT UNSIGNED` | NOT NULL | None | UNIQUE, FK -> `users(id)` ON DELETE CASCADE | Parent user relationship |
| `phone` | `VARCHAR(30)` | NULL | NULL | None | Contact phone number |
| `job_title` | `VARCHAR(100)` | NULL | NULL | None | Professional job title |
| `department` | `VARCHAR(100)` | NULL | NULL | None | Organization department |
| `bio` | `TEXT` | NULL | NULL | None | Biography or professional summary |
| `notification_preferences` | `JSON` | NULL | NULL | None | Channels & event notification settings |
| `theme_preference` | `VARCHAR(30)` | NOT NULL | `'system'` | None | UI theme: `system`, `light`, `dark` |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |

---

### 3. `user_invitations`
Out-of-band email invitations to onboard new users with pre-assigned global roles.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Invitation record primary key |
| `email` | `VARCHAR(255)` | NOT NULL | None | INDEX (`user_invitations_email_idx`) | Target recipient email address |
| `role_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `roles(id)` ON DELETE RESTRICT | Global role to assign upon acceptance |
| `token_hash` | `CHAR(64)` | NOT NULL | None | UNIQUE (`user_invitations_token_hash_unique`) | SHA-256 hash of the invitation acceptance token |
| `status` | `VARCHAR(50)` | NOT NULL | `'pending'` | INDEX (`user_invitations_status_idx`) | Status: `pending`, `accepted`, `declined`, `revoked`, `expired` |
| `invited_by` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE CASCADE | Inviting administrator user ID |
| `expires_at` | `TIMESTAMP` | NOT NULL | None | INDEX (`user_invitations_expires_at_idx`) | Invitation token expiry cutoff |
| `accepted_at` | `TIMESTAMP` | NULL | NULL | None | Timestamp when invitation was redeemed |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |

---

## Domain 2: Global Roles and Permissions (RBAC) (4 Tables)

### 4. `roles`
Global system roles.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Role record primary key |
| `name` | `VARCHAR(100)` | NOT NULL | None | UNIQUE (`roles_name_unique`) | Human-readable role name (e.g., 'System Admin') |
| `slug` | `VARCHAR(100)` | NOT NULL | None | UNIQUE (`roles_slug_unique`) | Immutable machine identifier (e.g., 'system-admin') |
| `description` | `VARCHAR(255)` | NULL | NULL | None | Scope and purpose description |
| `is_system` | `BOOLEAN` | NOT NULL | `FALSE` | None | Flag protecting core roles from deletion |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |

---

### 5. `permissions`
Granular systemic capabilities.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Permission record primary key |
| `name` | `VARCHAR(100)` | NOT NULL | None | UNIQUE (`permissions_name_unique`) | Human-readable permission name |
| `slug` | `VARCHAR(100)` | NOT NULL | None | UNIQUE (`permissions_slug_unique`) | Dot-notated capability (e.g., 'projects.create') |
| `module` | `VARCHAR(50)` | NOT NULL | None | INDEX (`permissions_module_idx`) | Module grouping (e.g., 'projects', 'users') |
| `description` | `VARCHAR(255)` | NULL | NULL | None | Explanation of capability granted |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |

---

### 6. `role_permissions`
Many-to-many pivot associating roles with granular permissions.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Pivot primary key |
| `role_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `roles(id)` ON DELETE CASCADE | Associated role ID |
| `permission_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `permissions(id)` ON DELETE CASCADE | Associated permission ID |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Association timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Association timestamp |
| *Constraint* | `UNIQUE` | — | — | UNIQUE (`role_permission_unique`: `role_id`, `permission_id`) | Prevents duplicate permission assignment |

---

### 7. `user_roles`
Many-to-many pivot associating users with global system roles.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Pivot primary key |
| `user_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE CASCADE | Associated user ID |
| `role_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `roles(id)` ON DELETE CASCADE | Associated role ID |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Assignment timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Assignment timestamp |
| *Constraint* | `UNIQUE` | — | — | UNIQUE (`user_role_unique`: `user_id`, `role_id`) | Prevents duplicate role assignment |

---

## Domain 3: Projects and Project Membership (3 Tables)

### 8. `projects`
Work management container and tenancy boundary.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Internal clustered primary key |
| `uuid` | `CHAR(36)` | NOT NULL | None | UNIQUE (`projects_uuid_unique`) | Public UUID for external API routing |
| `name` | `VARCHAR(255)` | NOT NULL | None | None | Display title of the project |
| `slug` | `VARCHAR(255)` | NOT NULL | None | UNIQUE (`projects_slug_unique`) | Human-readable URL identifier |
| `description` | `TEXT` | NULL | NULL | None | Detailed project charter or overview |
| `status` | `VARCHAR(50)` | NOT NULL | `'planning'` | INDEX (`projects_status_idx`) | Status: `planning`, `active`, `paused`, `completed`, `archived` |
| `priority` | `VARCHAR(50)` | NOT NULL | `'medium'` | INDEX (`projects_priority_idx`) | Priority: `urgent`, `high`, `medium`, `low` |
| `owner_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE RESTRICT | Project creator and primary administrator |
| `start_date` | `DATE` | NULL | NULL | None | Scheduled start date |
| `due_date` | `DATE` | NULL | NULL | INDEX (`projects_due_date_idx`) | Deadline date |
| `completed_at` | `TIMESTAMP` | NULL | NULL | None | Actual completion timestamp |
| `settings` | `JSON` | NULL | NULL | None | Module toggles, feature flags, integrations |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| `deleted_at` | `TIMESTAMP` | NULL | NULL | INDEX (`projects_deleted_at_idx`) | Soft delete for archival retention |

---

### 9. `project_members`
Contextual membership and role definitions inside a specific project.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Membership record primary key |
| `project_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `projects(id)` ON DELETE CASCADE | Associated project |
| `user_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE CASCADE | Member user |
| `role` | `VARCHAR(50)` | NOT NULL | `'member'` | INDEX (`project_members_role_idx`) | Project role: `owner`, `lead`, `member`, `viewer` |
| `joined_at` | `TIMESTAMP` | NOT NULL | CURRENT_TIMESTAMP | None | When member joined or was added |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| *Constraint* | `UNIQUE` | — | — | UNIQUE (`proj_mem_unique`: `project_id`, `user_id`) | Prevents duplicate user membership in project |

---

### 10. `project_invitations`
Invitations for users to join a specific project with an assigned contextual role.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Invitation record primary key |
| `project_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `projects(id)` ON DELETE CASCADE | Associated project |
| `email` | `VARCHAR(255)` | NOT NULL | None | INDEX (`proj_inv_email_idx`) | Recipient email address |
| `role` | `VARCHAR(50)` | NOT NULL | `'member'` | None | Target role: `lead`, `member`, `viewer` |
| `token_hash` | `CHAR(64)` | NOT NULL | None | UNIQUE (`proj_inv_token_unique`) | SHA-256 hash of project invite token |
| `status` | `VARCHAR(50)` | NOT NULL | `'pending'` | INDEX (`proj_inv_status_idx`) | Status: `pending`, `accepted`, `declined`, `revoked`, `expired` |
| `invited_by` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE CASCADE | Sender user ID |
| `expires_at` | `TIMESTAMP` | NOT NULL | None | INDEX (`proj_inv_expires_at_idx`) | Token expiration deadline |
| `accepted_at` | `TIMESTAMP` | NULL | NULL | None | Token redemption timestamp |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| *Constraint* | `UNIQUE` | — | — | UNIQUE (`proj_inv_active_unique`: `project_id`, `email`, `status`) | Prevents duplicate active pending invitations |

---

## Domain 4: Teams (3 Tables)

### 11. `teams`
Cross-functional groups and organizational departments.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Clustered primary key |
| `uuid` | `CHAR(36)` | NOT NULL | None | UNIQUE (`teams_uuid_unique`) | Public UUID for external API routing |
| `name` | `VARCHAR(255)` | NOT NULL | None | None | Team name (e.g. 'Backend Engineering') |
| `slug` | `VARCHAR(255)` | NOT NULL | None | UNIQUE (`teams_slug_unique`) | URL identifier |
| `description` | `TEXT` | NULL | NULL | None | Purpose and charter description |
| `leader_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE RESTRICT | Designated team leader |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| `deleted_at` | `TIMESTAMP` | NULL | NULL | INDEX (`teams_deleted_at_idx`) | Soft delete for retention |

---

### 12. `team_members`
Team member rosters.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Membership record primary key |
| `team_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `teams(id)` ON DELETE CASCADE | Associated team |
| `user_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE CASCADE | Member user |
| `role` | `VARCHAR(50)` | NOT NULL | `'member'` | None | Role inside team: `leader`, `member` |
| `joined_at` | `TIMESTAMP` | NOT NULL | CURRENT_TIMESTAMP | None | Timestamp user was added to team |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| *Constraint* | `UNIQUE` | — | — | UNIQUE (`team_mem_unique`: `team_id`, `user_id`) | Prevents duplicate user membership in team |

---

### 13. `project_teams`
Many-to-many pivot allocating entire teams to a project.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Allocation primary key |
| `project_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `projects(id)` ON DELETE CASCADE | Associated project |
| `team_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `teams(id)` ON DELETE CASCADE | Associated team |
| `assigned_at` | `TIMESTAMP` | NOT NULL | CURRENT_TIMESTAMP | None | Allocation timestamp |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| *Constraint* | `UNIQUE` | — | — | UNIQUE (`proj_team_unique`: `project_id`, `team_id`) | Prevents duplicate team assignment to project |

---

## Domain 5: Tasks and Work Management (4 Tables)

### 14. `tasks`
Core task work items supporting subtasks and Kanban ordering.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Internal clustered primary key |
| `uuid` | `CHAR(36)` | NOT NULL | None | UNIQUE (`tasks_uuid_unique`) | Public UUID for external API routing |
| `project_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `projects(id)` ON DELETE CASCADE | Mandatory parent project boundary |
| `parent_id` | `BIGINT UNSIGNED` | NULL | NULL | FK -> `tasks(id)` ON DELETE CASCADE | Self-referencing FK for subtasks |
| `title` | `VARCHAR(255)` | NOT NULL | None | None | Concise task summary |
| `description` | `LONGTEXT` | NULL | NULL | None | Detailed specifications / Markdown |
| `status` | `VARCHAR(50)` | NOT NULL | `'todo'` | INDEX (`tasks_status_idx`) | Status: `backlog`, `todo`, `in_progress`, `in_review`, `done`, `cancelled` |
| `priority` | `VARCHAR(50)` | NOT NULL | `'medium'` | INDEX (`tasks_priority_idx`) | Priority: `urgent`, `high`, `medium`, `low` |
| `creator_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE RESTRICT | Task author user ID |
| `due_date` | `DATETIME` | NULL | NULL | INDEX (`tasks_due_date_idx`) | Deadline timestamp |
| `estimated_hours` | `DECIMAL(5,2)` | NULL | NULL | None | Planned effort estimation |
| `actual_hours` | `DECIMAL(5,2)` | NULL | NULL | None | Logged effort |
| `order_column` | `INT UNSIGNED` | NOT NULL | `0` | INDEX (`tasks_order_idx`) | Position integer for Kanban column ordering |
| `completed_at` | `TIMESTAMP` | NULL | NULL | None | Status transition to 'done' timestamp |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| `deleted_at` | `TIMESTAMP` | NULL | NULL | INDEX (`tasks_deleted_at_idx`) | Soft delete for trash recovery |
| *Composite* | `INDEX` | — | — | INDEX (`tasks_proj_status_idx`: `project_id`, `status`, `order_column`) | Optimizes Kanban board queries |
| *Composite* | `INDEX` | — | — | INDEX (`tasks_proj_due_idx`: `project_id`, `due_date`) | Optimizes calendar & deadline queries |

---

### 15. `task_assignments`
Many-to-many relationship assigning users to tasks.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Assignment record primary key |
| `task_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `tasks(id)` ON DELETE CASCADE | Associated task ID |
| `user_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE CASCADE | Assignee user ID |
| `assigned_by` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE RESTRICT | User who performed the assignment |
| `assigned_at` | `TIMESTAMP` | NOT NULL | CURRENT_TIMESTAMP | None | Timestamp of delegation |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| *Constraint* | `UNIQUE` | — | — | UNIQUE (`task_assign_unique`: `task_id`, `user_id`) | Prevents duplicate user assignment to task |

---

### 16. `task_comments`
Discussion threads on tasks supporting nested replies.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Comment primary key |
| `task_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `tasks(id)` ON DELETE CASCADE | Associated task ID |
| `user_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE RESTRICT | Comment author ID |
| `parent_id` | `BIGINT UNSIGNED` | NULL | NULL | FK -> `task_comments(id)` ON DELETE CASCADE | Nested comment reply thread parent |
| `body` | `TEXT` | NOT NULL | None | None | Comment text content (supports @mentions) |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| `deleted_at` | `TIMESTAMP` | NULL | NULL | None | Soft delete for comment moderation |
| *Composite* | `INDEX` | — | — | INDEX (`comments_task_time_idx`: `task_id`, `created_at`) | Fast sequential comment stream retrieval |

---

### 17. `task_attachments`
File attachments uploaded to tasks.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Attachment primary key |
| `task_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `tasks(id)` ON DELETE CASCADE | Associated task ID |
| `user_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE RESTRICT | Uploader user ID |
| `file_name` | `VARCHAR(255)` | NOT NULL | None | None | Original upload filename |
| `file_path` | `VARCHAR(1024)` | NOT NULL | None | None | Storage disk relative path |
| `mime_type` | `VARCHAR(100)` | NOT NULL | None | None | IANA MIME type (e.g., `'application/pdf'`) |
| `file_size` | `BIGINT UNSIGNED` | NOT NULL | None | None | File size in bytes |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |

---

## Domain 6: Appointments and Scheduling (2 Tables)

### 18. `appointments`
Calendar events, team syncs, and client consultations.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Clustered primary key |
| `uuid` | `CHAR(36)` | NOT NULL | None | UNIQUE (`appointments_uuid_unique`) | Public UUID for external API routing |
| `organizer_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE RESTRICT | Meeting host user ID |
| `title` | `VARCHAR(255)` | NOT NULL | None | None | Event title |
| `description` | `TEXT` | NULL | NULL | None | Meeting agenda or notes |
| `start_time` | `DATETIME` | NOT NULL | None | INDEX (`appointments_start_idx`) | Event commencement timestamp |
| `end_time` | `DATETIME` | NOT NULL | None | INDEX (`appointments_end_idx`) | Event conclusion timestamp |
| `location_type` | `VARCHAR(50)` | NOT NULL | `'virtual'` | None | Location: `virtual`, `in_person` |
| `meeting_link` | `VARCHAR(1024)` | NULL | NULL | None | Video call URL (e.g. Google Meet, Zoom) |
| `location_address` | `VARCHAR(255)` | NULL | NULL | None | Physical meeting room or office address |
| `status` | `VARCHAR(50)` | NOT NULL | `'scheduled'` | INDEX (`appointments_status_idx`) | Status: `scheduled`, `confirmed`, `completed`, `cancelled` |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| `deleted_at` | `TIMESTAMP` | NULL | NULL | None | Soft delete |
| *Composite* | `INDEX` | — | — | INDEX (`appt_organizer_overlap_idx`: `organizer_id`, `status`, `start_time`, `end_time`) | Organizer conflict & overlap check |
| *Composite* | `INDEX` | — | — | INDEX (`appt_timeline_idx`: `start_time`, `end_time`, `status`) | Calendar range queries |

---

### 19. `appointment_participants`
Invitees and RSVP response status for appointments.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Participant record primary key |
| `appointment_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `appointments(id)` ON DELETE CASCADE | Associated appointment ID |
| `user_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE CASCADE | Invited user ID |
| `status` | `VARCHAR(50)` | NOT NULL | `'pending'` | INDEX (`appt_part_status_idx`) | RSVP: `pending`, `accepted`, `declined`, `tentative` |
| `response_notes` | `TEXT` | NULL | NULL | None | Optional participant comment or decline reason |
| `responded_at` | `TIMESTAMP` | NULL | NULL | None | Timestamp of RSVP submission |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| *Constraint* | `UNIQUE` | — | — | UNIQUE (`appt_user_unique`: `appointment_id`, `user_id`) | Prevents duplicate participant invitation |
| *Composite* | `INDEX` | — | — | INDEX (`appt_part_user_status_idx`: `user_id`, `status`, `appointment_id`) | User schedule & active RSVP query |

---

## Domain 7: Follow-Up Inbox (1 Table)

### 20. `user_mentions`
Dedicated index table for Follow-Up Inbox tracking `@mentions` across tasks and comments.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Mention record primary key |
| `mentionable_type` | `VARCHAR(255)` | NOT NULL | None | INDEX (`mentionable_idx`, 1) | Origin class: `'App\Models\Task'`, `'App\Models\TaskComment'` |
| `mentionable_id` | `BIGINT UNSIGNED` | NOT NULL | None | INDEX (`mentionable_idx`, 2) | Origin record ID |
| `mentioned_user_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE CASCADE | Targeted user ID |
| `author_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE CASCADE | Author who typed the mention |
| `context_excerpt` | `VARCHAR(500)` | NULL | NULL | None | Short snippet of surrounding text |
| `read_at` | `TIMESTAMP` | NULL | NULL | None | Follow-up acknowledgement timestamp |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Mention creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Mention modification timestamp |
| *Composite* | `INDEX` | — | — | INDEX (`mentions_inbox_idx`: `mentioned_user_id`, `read_at`, `created_at`) | Ultra-fast follow-up inbox querying |

---

## Domain 8: Habit Tracker (2 Tables)

### 21. `habits`
Habits and recurring personal or team routines.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Clustered primary key |
| `uuid` | `CHAR(36)` | NOT NULL | None | UNIQUE (`habits_uuid_unique`) | Public UUID for external API routing |
| `user_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE CASCADE | Owner user ID |
| `title` | `VARCHAR(255)` | NOT NULL | None | None | Habit title (e.g. 'Daily Standup', 'Code Review') |
| `description` | `TEXT` | NULL | NULL | None | Habit goals and instructions |
| `frequency` | `VARCHAR(50)` | NOT NULL | `'daily'` | INDEX (`habits_freq_idx`) | Frequency: `daily`, `weekly`, `custom` |
| `target_days` | `JSON` | NULL | NULL | None | Days of week array (e.g., `["mon","wed","fri"]`) |
| `color` | `VARCHAR(20)` | NOT NULL | `'#3B82F6'` | None | Hex color code for UI visualization |
| `is_archived` | `BOOLEAN` | NOT NULL | `FALSE` | INDEX (`habits_archived_idx`) | Archive status flag |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| `deleted_at` | `TIMESTAMP` | NULL | NULL | None | Soft delete |
| *Composite* | `UNIQUE` | — | — | UNIQUE (`habits_id_user_id`: `id`, `user_id`) | Composite key enabling storage-level ownership FK |

---

### 22. `habit_logs`
Daily or periodic completion records for habits with storage-engine ownership enforcement.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Log primary key |
| `habit_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `habits(id)` ON DELETE CASCADE | Associated habit ID |
| `user_id` | `BIGINT UNSIGNED` | NOT NULL | None | FK -> `users(id)` ON DELETE CASCADE | User who completed the habit |
| `logged_date` | `DATE` | NOT NULL | None | INDEX (`habit_logs_date_idx`) | Date of the habit record |
| `status` | `VARCHAR(50)` | NOT NULL | `'completed'` | INDEX (`habit_logs_status_idx`) | Status: `completed`, `skipped`, `failed` |
| `notes` | `TEXT` | NULL | NULL | None | Optional daily reflection notes |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Record modification timestamp |
| *Composite FK* | `FOREIGN KEY` | — | — | FK (`habit_id`, `user_id`) -> `habits(`id`, `user_id`)` ON DELETE CASCADE | Storage-level ownership integrity constraint |
| *Constraint* | `UNIQUE` | — | — | UNIQUE (`habit_date_unique`: `habit_id`, `logged_date`) | Prevents duplicate log for same habit on same date |

---

## Domain 9: Activity Logs and System Auditing (1 Table)

### 23. `activity_logs`
Polymorphic append-only audit trail capturing user and system actions.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Clustered primary key |
| `user_id` | `BIGINT UNSIGNED` | NULL | NULL | FK -> `users(id)` ON DELETE SET NULL | Performing user (NULL for system/cron events) |
| `action` | `VARCHAR(100)` | NOT NULL | None | INDEX (`activity_action_idx`) | Event action (e.g. `'task.status_changed'`) |
| `subject_type` | `VARCHAR(255)` | NOT NULL | None | INDEX (`activity_subject_idx`, 1) | Subject model class (e.g. `'App\Models\Task'`) |
| `subject_id` | `BIGINT UNSIGNED` | NULL | NULL | INDEX (`activity_subject_idx`, 2) | Subject record ID |
| `description` | `VARCHAR(500)` | NULL | NULL | None | Human-readable event description |
| `properties` | `JSON` | NULL | NULL | None | Structured payload (old/new diffs, metadata) |
| `ip_address` | `VARCHAR(45)` | NULL | NULL | None | IPv4 or IPv6 client address |
| `user_agent` | `TEXT` | NULL | NULL | None | Client browser/HTTP client user agent |
| `created_at` | `TIMESTAMP` | NOT NULL | CURRENT_TIMESTAMP | INDEX (`activity_created_at_idx`) | Audit event timestamp |
| *Composite* | `INDEX` | — | — | INDEX (`activity_user_time_idx`: `user_id`, `created_at`) | Actor timeline retrieval |

---

# SECTION 2: LARAVEL FRAMEWORK INFRASTRUCTURE TABLES (9 Tables)

## Category A: Authentication & Sessions Infrastructure (3 Tables)

### 24. `sessions`
Database-backed session driver storage for web and SPA stateful authentication.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(255)` | NOT NULL | None | PRIMARY KEY | Unique session identifier |
| `user_id` | `BIGINT UNSIGNED` | NULL | NULL | INDEX (`sessions_user_id_idx`), FK -> `users(id)` ON DELETE CASCADE | Authenticated user ID (NULL for guests) |
| `ip_address` | `VARCHAR(45)` | NULL | NULL | None | Client IPv4 or IPv6 address |
| `user_agent` | `TEXT` | NULL | NULL | None | Client browser user agent string |
| `payload` | `LONGTEXT` | NOT NULL | None | None | Serialized session data |
| `last_activity` | `INT UNSIGNED` | NOT NULL | None | INDEX (`sessions_last_activity_idx`) | Unix timestamp of most recent activity |

---

### 25. `password_reset_tokens`
Out-of-band password recovery tokens managed by Laravel password broker.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `email` | `VARCHAR(255)` | NOT NULL | None | PRIMARY KEY | Target recipient email address |
| `token` | `VARCHAR(255)` | NOT NULL | None | None | Bcrypt hashed reset token |
| `created_at` | `TIMESTAMP` | NULL | NULL | None | Token generation timestamp |

---

### 26. `personal_access_tokens`
Laravel Sanctum bearer tokens for API client authentication.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Token record primary key |
| `tokenable_type` | `VARCHAR(255)` | NOT NULL | None | INDEX (`tokenable_idx`, 1) | Polymorphic authenticatable model class |
| `tokenable_id` | `BIGINT UNSIGNED` | NOT NULL | None | INDEX (`tokenable_idx`, 2) | Polymorphic authenticatable model ID |
| `name` | `VARCHAR(255)` | NOT NULL | None | None | Client device or token description |
| `token` | `CHAR(64)` | NOT NULL | None | UNIQUE (`pat_token_unique`) | SHA-256 hash of plaintext bearer token |
| `abilities` | `TEXT` | NULL | NULL | None | JSON array of token permission scopes |
| `last_used_at` | `TIMESTAMP` | NULL | NULL | None | Most recent API request timestamp |
| `expires_at` | `TIMESTAMP` | NULL | NULL | None | Token expiration deadline |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Token creation timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Token update timestamp |

---

## Category B: Notification Infrastructure (1 Table)

### 27. `notifications`
Laravel native polymorphic notification storage table.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NOT NULL | None | PRIMARY KEY | Standard Laravel UUID primary key |
| `type` | `VARCHAR(255)` | NOT NULL | None | None | Fully qualified Notification class name |
| `notifiable_type` | `VARCHAR(255)` | NOT NULL | None | INDEX (`notifiable_idx`, 1) | Target recipient model class (e.g., `'App\Models\User'`) |
| `notifiable_id` | `BIGINT UNSIGNED` | NOT NULL | None | INDEX (`notifiable_idx`, 2) | Target recipient user ID |
| `data` | `JSON` | NOT NULL | None | None | Notification payload, title, action URLs |
| `read_at` | `TIMESTAMP` | NULL | NULL | INDEX (`notif_read_at_idx`) | Read status timestamp (NULL = unread) |
| `created_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP | None | Notification dispatch timestamp |
| `updated_at` | `TIMESTAMP` | NULL | CURRENT_TIMESTAMP ON UPDATE | None | Update timestamp |

---

## Category C: Queue & Asynchronous Jobs Infrastructure (3 Tables)

### 28. `jobs`
Pending asynchronous background jobs for worker processing.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Job primary key |
| `queue` | `VARCHAR(255)` | NOT NULL | None | INDEX (`jobs_queue_idx`) | Queue channel name |
| `payload` | `LONGTEXT` | NOT NULL | None | None | Serialized job command closure |
| `attempts` | `TINYINT UNSIGNED` | NOT NULL | None | None | Attempt counter |
| `reserved_at` | `INT UNSIGNED` | NULL | NULL | None | Worker reservation timestamp |
| `available_at` | `INT UNSIGNED` | NOT NULL | None | None | Scheduling release timestamp |
| `created_at` | `INT UNSIGNED` | NOT NULL | None | None | Job push timestamp |

---

### 29. `job_batches`
Coordinator table tracking batched queue executions.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(255)` | NOT NULL | None | PRIMARY KEY | Unique batch UUID |
| `name` | `VARCHAR(255)` | NOT NULL | None | None | Batch name |
| `total_jobs` | `INT` | NOT NULL | None | None | Total jobs in batch |
| `pending_jobs` | `INT` | NOT NULL | None | None | Remaining jobs count |
| `failed_jobs` | `INT` | NOT NULL | None | None | Failed jobs count |
| `failed_job_ids` | `LONGTEXT` | NOT NULL | None | None | JSON array of failed job IDs |
| `options` | `MEDIUMTEXT` | NULL | NULL | None | Serialized batch callbacks |
| `cancelled_at` | `INT` | NULL | NULL | None | Cancellation timestamp |
| `created_at` | `INT` | NOT NULL | None | None | Creation timestamp |
| `finished_at` | `INT` | NULL | NULL | None | Completion timestamp |

---

### 30. `failed_jobs`
Dead-letter queue table for failed asynchronous jobs.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | NOT NULL, AUTO_INCREMENT | None | PRIMARY KEY | Failed job record primary key |
| `uuid` | `VARCHAR(255)` | NOT NULL | None | UNIQUE (`failed_jobs_uuid_unique`) | Unique failed job UUID |
| `connection` | `TEXT` | NOT NULL | None | None | Queue connection name |
| `queue` | `TEXT` | NOT NULL | None | None | Queue channel name |
| `payload` | `LONGTEXT` | NOT NULL | None | None | Job payload data |
| `exception` | `LONGTEXT` | NOT NULL | None | None | Exception stack trace |
| `failed_at` | `TIMESTAMP` | NOT NULL | CURRENT_TIMESTAMP | None | Failure timestamp |

---

## Category D: Cache & Mutex Lock Infrastructure (2 Tables)

### 31. `cache`
Database-backed key-value cache store.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `key` | `VARCHAR(255)` | NOT NULL | None | PRIMARY KEY | Unique cache key |
| `value` | `MEDIUMTEXT` | NOT NULL | None | None | Serialized cached value |
| `expiration` | `INT` | NOT NULL | None | None | Expiration Unix timestamp |

---

### 32. `cache_locks`
Distributed atomic mutex lock storage for cache/job concurrency control.

| Column | Data Type | Attributes | Default | Indexes / Keys | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `key` | `VARCHAR(255)` | NOT NULL | None | PRIMARY KEY | Mutex lock key |
| `owner` | `VARCHAR(255)` | NOT NULL | None | None | Process lock owner identifier |
| `expiration` | `INT` | NOT NULL | None | None | Lock expiration Unix timestamp |
