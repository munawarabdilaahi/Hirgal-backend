import { router } from '@inertiajs/react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { AuthContext } from '@/features/auth/auth-context-state';
import { ProjectDetailsRoute, ProjectFormRoute, ProjectsRoute } from '@/features/projects/ProjectsRoutes';
import { TeamDetailsRoute, TeamFormRoute, TeamsRoute } from '@/features/teams/TeamsRoutes';
import { TasksRoute } from '@/features/tasks/TasksRoute';
import { AppointmentsRoute } from '@/features/appointments/AppointmentsRoute';
import { HabitsRoute } from '@/features/habits/pages/HabitsRoute';
import { HabitFormRoute } from '@/features/habits/pages/HabitFormRoute';
import { HabitDetailsRoute } from '@/features/habits/pages/HabitDetailsRoute';
import { ActivityRoute, NotificationsRoute } from '@/features/follow-up/FollowUpRoutes';
import { enableWebSession } from '@/services/api/apiClient';
import type { ApiUser } from '@/services/api/contracts';

enableWebSession();

export default function Workspace({ user, frontendUrl }: { user: ApiUser; frontendUrl: string }) {
  const logout = () => router.post('/logout', {}, { replace: true });
  const session = { user, frontendUrl, logout };
  const auth = {
    user,
    hasSession: true,
    isAuthenticated: true,
    isInitializing: false,
    sessionError: null,
    sessionMessage: null,
    login: async () => user,
    logout: async () => { logout(); },
    retrySession: async () => user,
  };

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <WorkspaceRoutes session={session} />
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

function WorkspaceRoutes({ session }: { session: { user: ApiUser; frontendUrl: string; logout: () => void } }) {
  const { pathname } = useLocation();
  const breadcrumb = pathname.startsWith('/projects') ? 'Projects'
    : pathname.startsWith('/teams') ? 'Teams'
      : pathname.startsWith('/habits') ? 'Habits'
        : pathname === '/appointments' ? 'Appointments'
          : pathname === '/notifications' ? 'Follow-up inbox'
            : pathname === '/activity' ? 'Activity'
              : pathname === '/my-work' ? 'My work' : 'Tasks';

  return (
    <AppShell breadcrumb={breadcrumb} session={session}>
      <Routes>
        <Route path="/projects" element={<ProjectsRoute />} />
        <Route path="/projects/new" element={<ProjectFormRoute />} />
        <Route path="/projects/:projectUuid/edit" element={<ProjectFormRoute />} />
        <Route path="/projects/:projectUuid" element={<ProjectDetailsRoute />} />
        <Route path="/teams" element={<TeamsRoute />} />
        <Route path="/teams/new" element={<TeamFormRoute />} />
        <Route path="/teams/:teamUuid/edit" element={<TeamFormRoute />} />
        <Route path="/teams/:teamUuid" element={<TeamDetailsRoute />} />
        <Route path="/tasks" element={<TasksRoute />} />
        <Route path="/my-work" element={<TasksRoute assignedToMe />} />
        <Route path="/appointments" element={<AppointmentsRoute />} />
        <Route path="/habits" element={<HabitsRoute />} />
        <Route path="/habits/new" element={<HabitFormRoute />} />
        <Route path="/habits/:habitUuid/edit" element={<HabitFormRoute />} />
        <Route path="/habits/:habitUuid" element={<HabitDetailsRoute />} />
        <Route path="/notifications" element={<NotificationsRoute />} />
        <Route path="/activity" element={<ActivityRoute />} />
      </Routes>
    </AppShell>
  );
}
