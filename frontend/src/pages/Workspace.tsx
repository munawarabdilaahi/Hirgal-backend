import { router } from '@inertiajs/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { AuthContext } from '@/features/auth/auth-context-state';
import { ProjectDetailsRoute, ProjectFormRoute, ProjectsRoute } from '@/features/projects/ProjectsRoutes';
import { TeamDetailsRoute, TeamFormRoute, TeamsRoute } from '@/features/teams/TeamsRoutes';
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
        <AppShell breadcrumb={window.location.pathname.startsWith('/projects') ? 'Projects' : 'Teams'} session={session}>
          <Routes>
            <Route path="/projects" element={<ProjectsRoute />} />
            <Route path="/projects/new" element={<ProjectFormRoute />} />
            <Route path="/projects/:projectUuid/edit" element={<ProjectFormRoute />} />
            <Route path="/projects/:projectUuid" element={<ProjectDetailsRoute />} />
            <Route path="/teams" element={<TeamsRoute />} />
            <Route path="/teams/new" element={<TeamFormRoute />} />
            <Route path="/teams/:teamUuid/edit" element={<TeamFormRoute />} />
            <Route path="/teams/:teamUuid" element={<TeamDetailsRoute />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
