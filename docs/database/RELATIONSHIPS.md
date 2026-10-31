# Hirgal Database Relationships & Referential Integrity (23 Domain + 9 Infrastructure Tables)

This document details all Eloquent relationships, foreign key constraints, cascade rules, referential integrity strategies, and ownership constraints across the 23 core business domain tables and 9 Laravel framework infrastructure tables (totaling 32 tables) in the Hirgal platform.

---

## 1. Referential Integrity & Deletion Strategy

Each relationship employs an explicit deletion strategy based on business rules:

| Deletion Strategy | Applied When | Example | Rationale |
| :--- | :--- | :--- | :--- |
| **`CASCADE`** | Child records have no independent semantic meaning without their parent. | `tasks` -> `task_comments`<br>`habits` -> `habit_logs`<br>`projects` -> `project_members`<br>`users` -> `sessions` | Deleting a parent resource (e.g. task or project) must remove all its child items to prevent orphaned records and storage leaks. |
| **`RESTRICT`** | Deleting the parent would corrupt historical business accountability. | `users` -> `projects.owner_id`<br>`users` -> `tasks.creator_id`<br>`roles` -> `user_invitations.role_id` | You cannot delete a user if they own active projects or created existing tasks. The project/task ownership must first be explicitly transferred. |
| **`SET NULL`** | The child record must persist for audit purposes, but the parent actor is optional. | `users` -> `activity_logs.user_id` | Audit trails must be permanent. If a user account is purged, historical activity records remain intact with `user_id = NULL`. |

---

## 2. Cross-Table Relational Ownership Constraint: Habit Logs

To mathematically eliminate the risk of a user logging against another user's habit, the database employs a **Composite Foreign Key**:

```
HABITS (id, user_id) [UNIQUE KEY: habits_id_user_id]
   ▲
   │ Foreign Key: (habit_id, user_id) -> habits(id, user_id) ON DELETE CASCADE
   │
HABIT_LOGS (habit_id, user_id)
```

### Relational Guarantee:
Because `habit_logs (habit_id, user_id)` references the unique composite tuple `habits (id, user_id)`, the MySQL 8 InnoDB engine will physically reject any `INSERT` or `UPDATE` where the `user_id` in `habit_logs` does not match the owning `user_id` in `habits` (`SQLSTATE[23000]`). This guarantees ownership integrity at the storage engine level, independent of application code.

---

## 3. System Invitations vs Project Invitations Distinction

The platform maintains two distinct invitation lifecycles to prevent permission escalation:

```
┌────────────────────────────────────────────────────────────────────────┐
│ USER_INVITATIONS (Global Platform Onboarding)                          │
│ Target: users without an account yet                                   │
│ Scope: Platform-wide registration                                      │
│ Grants: Global System Role (role_id -> roles.id)                       │
│ Authorized Actors: System Admin only                                   │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ PROJECT_INVITATIONS (Contextual Project Tenancy Invitation)             │
│ Target: New or existing users invited to a specific project            │
│ Scope: Bound strictly to project_id -> projects.id                     │
│ Grants: Contextual Project Role (role: owner, lead, member, viewer)    │
│ Authorized Actors: Project Owner or Project Lead                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Domain-by-Domain Eloquent Relationships

### Domain 1: Authentication & Identity

#### User Model (`App\Models\User`)
- `hasOne(UserProfile::class)`: User's extended profile.
- `hasMany(Session::class)`: Active database sessions.
- `hasMany(UserRole::class)`: Pivot linking user to global roles.
- `belongsToMany(Role::class, 'user_roles')`: Global system roles assigned to the user.
- `hasMany(ProjectMember::class)`: Contextual memberships across all projects.
- `belongsToMany(Project::class, 'project_members')->withPivot('role', 'joined_at')`: Projects the user belongs to.
- `hasMany(Project::class, 'owner_id')`: Projects created and owned by this user.
- `hasMany(TeamMember::class)`: Contextual memberships across teams.
- `belongsToMany(Team::class, 'team_members')->withPivot('role', 'joined_at')`: Teams the user belongs to.
- `hasMany(Team::class, 'leader_id')`: Teams led by this user.
- `hasMany(TaskAssignment::class)`: Task assignments delegated to this user.
- `belongsToMany(Task::class, 'task_assignments')->withPivot('assigned_by', 'assigned_at')`: Tasks assigned to the user.
- `hasMany(Task::class, 'creator_id')`: Tasks authored by this user.
- `hasMany(TaskComment::class)`: Comments written by this user.
- `hasMany(AppointmentParticipant::class)`: Meeting RSVPs.
- `belongsToMany(Appointment::class, 'appointment_participants')->withPivot('status', 'response_notes')`: Appointments invited to.
- `hasMany(Appointment::class, 'organizer_id')`: Appointments organized by this user.
- `hasMany(Habit::class)`: Habits owned and tracked by this user.
- `hasMany(HabitLog::class)`: Habit completion logs.
- `hasMany(UserMention::class, 'mentioned_user_id')`: In-app mentions targeted at this user.
- `morphMany(DatabaseNotification::class, 'notifiable')`: Polymorphic in-app notifications.
- `hasMany(ActivityLog::class)`: Audit logs triggered by this user.

#### Session Model (`App\Models\Session`)
- `belongsTo(User::class)`: Authenticated user (nullable for guests).

---

### Domain 2: Global Roles and Permissions (RBAC)

#### Role Model (`App\Models\Role`)
- `hasMany(UserRole::class)`: Pivot to users.
- `belongsToMany(User::class, 'user_roles')`: Users holding this role.
- `hasMany(RolePermission::class)`: Pivot to permissions.
- `belongsToMany(Permission::class, 'role_permissions')`: Granular permissions granted to this role.
- `hasMany(UserInvitation::class)`: Pending invitations configured with this role.

#### Permission Model (`App\Models\Permission`)
- `hasMany(RolePermission::class)`: Pivot to roles.
- `belongsToMany(Role::class, 'role_permissions')`: Roles possessing this permission.

---

### Domain 3: Projects and Project Membership

#### Project Model (`App\Models\Project`)
- `belongsTo(User::class, 'owner_id')`: Project owner/creator.
- `hasMany(ProjectMember::class)`: Contextual members.
- `belongsToMany(User::class, 'project_members')->withPivot('role', 'joined_at')`: Member users.
- `hasMany(ProjectInvitation::class)`: Outstanding invitations for this project.
- `hasMany(ProjectTeam::class)`: Pivot for team allocations.
- `belongsToMany(Team::class, 'project_teams')->withPivot('assigned_at')`: Reusable teams assigned to work on this project.
- `hasMany(Task::class)`: All tasks inside this project boundary.

#### ProjectMember Model (`App\Models\ProjectMember`)
- `belongsTo(Project::class)`: Parent project.
- `belongsTo(User::class)`: Member user.

#### ProjectInvitation Model (`App\Models\ProjectInvitation`)
- `belongsTo(Project::class)`: Target project.
- `belongsTo(User::class, 'invited_by')`: Inviting administrator.

---

### Domain 4: Teams

#### Team Model (`App\Models\Team`)
- `belongsTo(User::class, 'leader_id')`: Team lead.
- `hasMany(TeamMember::class)`: Members of this team.
- `belongsToMany(User::class, 'team_members')->withPivot('role', 'joined_at')`: Member users.
- `hasMany(ProjectTeam::class)`: Project allocation records.
- `belongsToMany(Project::class, 'project_teams')->withPivot('assigned_at')`: Projects this team is allocated to.

#### TeamMember Model (`App\Models\TeamMember`)
- `belongsTo(Team::class)`: Parent team.
- `belongsTo(User::class)`: Member user.

#### ProjectTeam Model (`App\Models\ProjectTeam`)
- `belongsTo(Project::class)`: Parent project.
- `belongsTo(Team::class)`: Associated team.

---

### Domain 5: Tasks and Work Management

#### Task Model (`App\Models\Task`)
- `belongsTo(Project::class)`: Mandatory parent project tenancy boundary.
- `belongsTo(Task::class, 'parent_id')`: Parent task (if this is a subtask).
- `hasMany(Task::class, 'parent_id')`: Child subtasks.
- `belongsTo(User::class, 'creator_id')`: Task author.
- `hasMany(TaskAssignment::class)`: Assignments.
- `belongsToMany(User::class, 'task_assignments')->withPivot('assigned_by', 'assigned_at')`: Assigned members.
- `hasMany(TaskComment::class)`: Discussion comments.
- `hasMany(TaskAttachment::class)`: Attached files.
- `morphMany(UserMention::class, 'mentionable')`: Mentions extracted from task descriptions.

#### TaskAssignment Model (`App\Models\TaskAssignment`)
- `belongsTo(Task::class)`: Associated task.
- `belongsTo(User::class)`: Assigned member.
- `belongsTo(User::class, 'assigned_by')`: Allocating user.

#### TaskComment Model (`App\Models\TaskComment`)
- `belongsTo(Task::class)`: Associated task.
- `belongsTo(User::class)`: Comment author.
- `belongsTo(TaskComment::class, 'parent_id')`: Parent comment (for nested replies).
- `hasMany(TaskComment::class, 'parent_id')`: Threaded reply comments.
- `morphMany(UserMention::class, 'mentionable')`: Mentions extracted from comment body.

#### TaskAttachment Model (`App\Models\TaskAttachment`)
- `belongsTo(Task::class)`: Associated task.
- `belongsTo(User::class)`: Uploader user.

---

### Domain 6: Appointments

#### Appointment Model (`App\Models\Appointment`)
- `belongsTo(User::class, 'organizer_id')`: Meeting organizer.
- `hasMany(AppointmentParticipant::class)`: Meeting RSVPs.
- `belongsToMany(User::class, 'appointment_participants')->withPivot('status', 'response_notes')`: Invited users.

#### AppointmentParticipant Model (`App\Models\AppointmentParticipant`)
- `belongsTo(Appointment::class)`: Associated meeting.
- `belongsTo(User::class)`: Participant user.

---

### Domain 7: Notifications & Follow-Up Inbox

#### UserMention Model (`App\Models\UserMention`)
- `morphTo('mentionable')`: Resolves to parent `Task` or `TaskComment`.
- `belongsTo(User::class, 'mentioned_user_id')`: Targeted user.
- `belongsTo(User::class, 'author_id')`: Mention author.

---

### Domain 8: Habit Tracker

#### Habit Model (`App\Models\Habit`)
- `belongsTo(User::class)`: Habit owner.
- `hasMany(HabitLog::class)`: Daily/weekly completion logs.

#### HabitLog Model (`App\Models\HabitLog`)
- `belongsTo(Habit::class)`: Parent habit.
- `belongsTo(User::class)`: Completing user.

---

### Domain 9: Activity & Auditing

#### ActivityLog Model (`App\Models\ActivityLog`)
- `belongsTo(User::class)`: Actor user (nullable for automated system jobs).
- `morphTo('subject')`: Polymorphic target model (e.g. `Project`, `Task`, `Appointment`, `Team`).
