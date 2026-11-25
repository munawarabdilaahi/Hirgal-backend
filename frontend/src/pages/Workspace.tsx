import { router } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { workspaceBreadcrumb } from '@/components/layout/workspace-breadcrumb';
import { AuthContext } from '@/features/auth/auth-context-state';
import { RequireAnyPermission, RequirePermission } from '@/features/auth/components/AuthRouteGuards';
import { ProjectDetailsRoute, ProjectFormRoute, ProjectsRoute } from '@/features/projects/ProjectsRoutes';
import { TeamDetailsRoute, TeamFormRoute, TeamsRoute } from '@/features/teams/TeamsRoutes';
import { TasksRoute } from '@/features/tasks/TasksRoute';
import { AppointmentsRoute } from '@/features/appointments/AppointmentsRoute';
import { HabitsRoute } from '@/features/habits/pages/HabitsRoute';
import { HabitFormRoute } from '@/features/habits/pages/HabitFormRoute';
import { HabitDetailsRoute } from '@/features/habits/pages/HabitDetailsRoute';
import { ActivityRoute, NotificationsRoute } from '@/features/follow-up/FollowUpRoutes';
import { UsersRoute } from '@/features/users/pages/UsersRoute';
import { UserDetailsRoute } from '@/features/users/pages/UserDetailsRoute';
import { enableWebSession } from '@/services/api/apiClient';
import { authApi, authQueryKey } from '@/services/api/authApi';
import type { ApiUser } from '@/services/api/contracts';

enableWebSession();

export default function Workspace({ user, frontendUrl }: { user: ApiUser; frontendUrl: string }) {
  const { data: cachedUser } = useQuery({
    queryKey: authQueryKey,
    queryFn: authApi.getCurrentUser,
    enabled: false,
    initialData: user,
  });
  const currentUser = cachedUser.id === user.id ? cachedUser : user;
  const logout = () => router.post('/logout', {}, { replace: true });
  const session = { user: currentUser, frontendUrl, logout };
  const auth = {
    user: currentUser,
    hasSession: true,
    isAuthenticated: true,
    isInitializing: false,
    sessionError: null,
    sessionMessage: null,
    login: async () => ({ two_factor_required: false, user: currentUser }),
    verifyTwoFactor: async () => currentUser,
    cancelTwoFactor: async () => {},
    logout: async () => { logout(); },
    retrySession: async () => currentUser,
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
  return (
    <AppShell breadcrumb={workspaceBreadcrumb(pathname)} session={session} wide={pathname === '/tasks' || pathname === '/my-work'}>
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
        <Route path="/users" element={<RequireAnyPermission permissions={['users.view_directory', 'users.view']}><UsersRoute /></RequireAnyPermission>} />
        <Route path="/users/:userId" element={<RequirePermission permission="users.view"><UserDetailsRoute /></RequirePermission>} />
      </Routes>
    </AppShell>
  );
}
