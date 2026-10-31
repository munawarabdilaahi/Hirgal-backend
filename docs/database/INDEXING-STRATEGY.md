# Hirgal Database Indexing Strategy & Performance Architecture (27 Tables)

This document details the indexing architecture, composite index rationale, query optimization patterns, and overlap detection mechanics designed for MySQL 8.0+.

---

## 1. Indexing Philosophy

Indexes are structured to support high-throughput RESTful API patterns without overburdening write-heavy tables:
1. **Left-to-Right Composite Indexing:** All composite indexes adhere strictly to MySQL's leftmost prefix rule. Equality columns (`tenant_id`, `user_id`, `status`) precede inequality/range columns (`due_date`, `start_time`, `created_at`).
2. **Covering Queries for Dashboard & List Endpoints:** Where frequent API responses filter by parent entity and sort by status/date (e.g. Kanban columns, appointment timelines), composite indexes eliminate filesort operations and index-to-table random lookups.
3. **Collision-Proof Unique Constraints:** Unique composite constraints enforce relational uniqueness at the storage engine level, preventing concurrency race conditions (e.g. double membership, duplicate habit logs).

---

## 2. Deep Dive: Appointment Overlap Mechanics & Index Evaluation

### The Mathematical Overlap Problem
Two continuous time intervals `[S1, E1]` and `[S2, E2]` overlap if and only if:
```sql
S1 < E2 AND E1 > S2
```

In Hirgal, checking whether a prospective appointment `[$newStart, $newEnd]` conflicts with an existing appointment for an organizer requires:
```sql
SELECT a.id, a.uuid, a.title, a.start_time, a.end_time 
FROM appointments a
WHERE a.organizer_id = ? 
  AND a.status IN ('scheduled', 'confirmed')
  AND a.start_time < ? 
  AND a.end_time > ?;
```

And for a participant invitee:
```sql
SELECT a.id, a.uuid, a.title, a.start_time, a.end_time 
FROM appointments a
JOIN appointment_participants ap ON ap.appointment_id = a.id
WHERE ap.user_id = ? 
  AND ap.status IN ('pending', 'accepted')
  AND a.status IN ('scheduled', 'confirmed')
  AND a.start_time < ? 
  AND a.end_time > ?;
```

### Why a Naive `INDEX (start_time, end_time)` Fails:
If an index is defined only as `INDEX (start_time, end_time)`:
1. **No Equality Filtering:** The database must perform a full range scan across *all* users' appointments in the system before discarding those that do not belong to the organizer!
2. **B-Tree Range Limitation:** A B-tree index can only use one inequality range per index walk. In `start_time < ? AND end_time > ?`, MySQL uses the index for `start_time`, and must filter `end_time` row-by-row.

### The Optimized MySQL 8 Index Solution:
1. **`appointments.appt_organizer_overlap_idx` (`organizer_id`, `status`, `start_time`, `end_time`)**:
   - `organizer_id` (Equality): Instantly narrows the B-tree to that specific organizer.
   - `status` (Equality/IN): Filters out cancelled meetings immediately.
   - `start_time` (Inequality Range): Traverses the sorted time range.
   - `end_time` (Covering): Stored in the B-tree leaf node, allowing MySQL to evaluate `end_time > ?` entirely within the index cache without fetching data pages from disk.
2. **`appointments.appt_timeline_idx` (`start_time`, `end_time`, `status`)**:
   - Dedicated index for system-wide calendar overviews and chronological agenda exports.
3. **`appointment_participants.appt_part_user_status_idx` (`user_id`, `status`, `appointment_id`)**:
   - Eliminates table scans when verifying attendee schedule availability during booking.

---

## 3. Table-by-Table Index Inventory Across All 27 Domain Tables

### Domain 1: Authentication and Identity
1. **`users`**
   - `PRIMARY KEY (`id`)`: Clustered primary key.
   - `UNIQUE INDEX users_email_unique (`email`)`: Fast credential lookup on login.
   - `INDEX users_status_idx (`account_status`)`: Filter active vs suspended accounts.
   - `INDEX users_deleted_at_idx (`deleted_at`)`: Scopes out soft-deleted users.
2. **`user_profiles`**
   - `PRIMARY KEY (`id`)`
   - `UNIQUE INDEX user_profiles_user_id_unique (`user_id`)`: Guarantees strict 1:1 user profile.
3. **`user_invitations`**
   - `PRIMARY KEY (`id`)`
   - `UNIQUE INDEX user_invitations_token_hash_unique (`token_hash`)`: Token redemption lookup.
   - `INDEX user_invitations_email_idx (`email`)`: Checking existing pending invitations by email.
   - `INDEX user_invitations_status_idx (`status`)`: Filter pending vs accepted invites.
   - `INDEX user_invitations_expires_at_idx (`expires_at`)`: Fast expiration pruning.
4. **`password_reset_tokens`**
   - `PRIMARY KEY (`email`)`: Instant lookup on password reset submission.
5. **`personal_access_tokens`**
   - `PRIMARY KEY (`id`)`
   - `UNIQUE INDEX pat_token_unique (`token`)`: Fast bearer token lookup.
   - `INDEX tokenable_idx (`tokenable_type`, `tokenable_id`)`: Polymorphic token owner resolution.
6. **`sessions`**
   - `PRIMARY KEY (`id`)`: Session ID lookup.
   - `INDEX sessions_user_id_idx (`user_id`)`: Fast eviction on password change / logout.
   - `INDEX sessions_last_activity_idx (`last_activity`)`: Garbage collection of expired sessions.

### Domain 2: Global Roles and Permissions (RBAC)
7. **`roles`**
   - `PRIMARY KEY (`id`)`
   - `UNIQUE INDEX roles_name_unique (`name`)`
   - `UNIQUE INDEX roles_slug_unique (`slug`)`: Machine role authorization check.
8. **`permissions`**
   - `PRIMARY KEY (`id`)`
   - `UNIQUE INDEX permissions_name_unique (`name`)`
   - `UNIQUE INDEX permissions_slug_unique (`slug`)`: Gate capability check (`Gate::allows`).
   - `INDEX permissions_module_idx (`module`)`: UI grouping.
9. **`role_permissions`**
   - `PRIMARY KEY (`id`)`
   - `UNIQUE INDEX role_permission_unique (`role_id`, `permission_id`)`: Idempotent permission binding.
   - `INDEX role_permissions_permission_id_fk (`permission_id`)`
10. **`user_roles`**
    - `PRIMARY KEY (`id`)`
    - `UNIQUE INDEX user_role_unique (`user_id`, `role_id`)`: Guarantees single role assignment.
    - `INDEX user_roles_role_id_fk (`role_id`)`

### Domain 3: Projects and Project Membership
11. **`projects`**
    - `PRIMARY KEY (`id`)`
    - `UNIQUE INDEX projects_uuid_unique (`uuid`)`: External API route-model binding.
    - `UNIQUE INDEX projects_slug_unique (`slug`)`: Slug lookups.
    - `INDEX projects_status_idx (`status`)`
    - `INDEX projects_priority_idx (`priority`)`
    - `INDEX projects_due_date_idx (`due_date`)`
    - `INDEX projects_owner_id_fk (`owner_id`)`
    - `INDEX projects_deleted_at_idx (`deleted_at`)`
12. **`project_members`**
    - `PRIMARY KEY (`id`)`
    - `UNIQUE INDEX proj_mem_unique (`project_id`, `user_id`)`: Prevents duplicate memberships.
    - `INDEX project_members_user_id_fk (`user_id`)`: "Find all projects for user".
    - `INDEX project_members_role_idx (`role`)`: Role-based filtering.
13. **`project_invitations`**
    - `PRIMARY KEY (`id`)`
    - `UNIQUE INDEX proj_inv_token_unique (`token_hash`)`: Token redemption.
    - `UNIQUE INDEX proj_inv_active_unique (`project_id`, `email`, `status`)`: Prevents duplicate pending invitations to the same email within a project.
    - `INDEX proj_inv_expires_at_idx (`expires_at`)`: Expiration cleanup.

### Domain 4: Teams
14. **`teams`**
    - `PRIMARY KEY (`id`)`
    - `UNIQUE INDEX teams_uuid_unique (`uuid`)`: External API route-model binding.
    - `UNIQUE INDEX teams_slug_unique (`slug`)`
    - `INDEX teams_leader_id_fk (`leader_id`)`
    - `INDEX teams_deleted_at_idx (`deleted_at`)`
15. **`team_members`**
    - `PRIMARY KEY (`id`)`
    - `UNIQUE INDEX team_mem_unique (`team_id`, `user_id`)`: Prevents duplicate team memberships.
    - `INDEX team_members_user_id_fk (`user_id`)`
16. **`project_teams`**
    - `PRIMARY KEY (`id`)`
    - `UNIQUE INDEX proj_team_unique (`project_id`, `team_id`)`: Prevents duplicate team assignments.
    - `INDEX project_teams_team_id_fk (`team_id`)`

### Domain 5: Tasks and Work Management
17. **`tasks`**
    - `PRIMARY KEY (`id`)`
    - `UNIQUE INDEX tasks_uuid_unique (`uuid`)`: External API route-model binding.
    - `INDEX tasks_parent_id_fk (`parent_id`)`: Subtask retrieval.
    - `INDEX tasks_creator_id_fk (`creator_id`)`
    - **`COMPOSITE INDEX tasks_proj_status_idx (`project_id`, `status`, `order_column`)`**:  
      *Optimizes:* Primary Kanban query: `WHERE project_id = ? AND status = ? ORDER BY order_column ASC`.
    - **`COMPOSITE INDEX tasks_proj_due_idx (`project_id`, `due_date`)`**:  
      *Optimizes:* Calendar and deadline queries.
    - `INDEX tasks_deleted_at_idx (`deleted_at`)`
18. **`task_assignments`**
    - `PRIMARY KEY (`id`)`
    - `UNIQUE INDEX task_assign_unique (`task_id`, `user_id`)`: Prevents duplicate user assignment.
    - `INDEX task_assignments_user_id_fk (`user_id`)`: "My assigned tasks" query.
19. **`task_comments`**
    - `PRIMARY KEY (`id`)`
    - `INDEX task_comments_parent_id_fk (`parent_id`)`: Threaded replies.
    - **`COMPOSITE INDEX comments_task_time_idx (`task_id`, `created_at`)`**:  
      *Optimizes:* Sequential comment stream retrieval.
20. **`task_attachments`**
    - `PRIMARY KEY (`id`)`
    - `INDEX task_attachments_task_id_fk (`task_id`)`: Fast file listing for tasks.

### Domain 6: Appointments
21. **`appointments`**
    - `PRIMARY KEY (`id`)`
    - `UNIQUE INDEX appointments_uuid_unique (`uuid`)`: External API binding.
    - **`COMPOSITE INDEX appt_organizer_overlap_idx (`organizer_id`, `status`, `start_time`, `end_time`)`**: Conflict and overlap detection.
    - **`COMPOSITE INDEX appt_timeline_idx (`start_time`, `end_time`, `status`)`**: Calendar range queries.
22. **`appointment_participants`**
    - `PRIMARY KEY (`id`)`
    - `UNIQUE INDEX appt_user_unique (`appointment_id`, `user_id`)`: Prevents duplicate attendee records.
    - **`COMPOSITE INDEX appt_part_user_status_idx (`user_id`, `status`, `appointment_id`)`**: Active attendee schedule queries.

### Domain 7: Notifications and Follow-Up Inbox
23. **`notifications`**
    - `PRIMARY KEY (`id`)` (CHAR 36 UUID)
    - `INDEX notifiable_idx (`notifiable_type`, `notifiable_id`)`: Core Laravel notification queries.
    - `INDEX notif_read_at_idx (`read_at`)`: Unread notification badge count.
24. **`user_mentions`**
    - `PRIMARY KEY (`id`)`
    - `INDEX mentionable_idx (`mentionable_type`, `mentionable_id`)`
    - **`COMPOSITE INDEX mentions_inbox_idx (`mentioned_user_id`, `read_at`, `created_at`)`**:  
      *Optimizes:* Follow-up inbox query: `WHERE mentioned_user_id = ? AND read_at IS NULL ORDER BY created_at DESC`.

### Domain 8: Habit Tracker
25. **`habits`**
    - `PRIMARY KEY (`id`)`
    - `UNIQUE INDEX habits_uuid_unique (`uuid`)`: External API binding.
    - **`UNIQUE INDEX habits_id_user_id (`id`, `user_id`)`**: Enables storage-level composite foreign key enforcement.
    - `INDEX habits_user_archived_idx (`user_id`, `is_archived`)`: Active habits dashboard.
26. **`habit_logs`**
    - `PRIMARY KEY (`id`)`
    - **`COMPOSITE FK INDEX habit_logs_user_habit_idx (`habit_id`, `user_id`)`**: Backs the composite foreign key.
    - **`UNIQUE INDEX habit_date_unique (`habit_id`, `logged_date`)`**: Prevents duplicate log on the same calendar day.
    - `INDEX habit_logs_user_date_idx (`user_id`, `logged_date`)`: Cross-habit streak calculations.

### Domain 9: Activity and Auditing
27. **`activity_logs`**
    - `PRIMARY KEY (`id`)`
    - `INDEX activity_subject_idx (`subject_type`, `subject_id`)`: Entity audit trail.
    - `INDEX activity_action_idx (`action`)`: Event filtering.
    - **`COMPOSITE INDEX activity_user_time_idx (`user_id`, `created_at`)`**: Actor audit timeline queries.
