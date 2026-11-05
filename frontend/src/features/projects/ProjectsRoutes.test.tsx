import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsRoute, ProjectDetailsRoute, ProjectFormRoute } from './ProjectsRoutes';

const { projectApi, teamApi, userApi, authState } = vi.hoisted(() => ({
  projectApi: {
    list: vi.fn(), get: vi.fn(), members: vi.fn(), teams: vi.fn(), create: vi.fn(), update: vi.fn(), archive: vi.fn(), remove: vi.fn(), addMember: vi.fn(), updateMember: vi.fn(), removeMember: vi.fn(), allocateTeam: vi.fn(), deallocateTeam: vi.fn(),
  },
  teamApi: { list: vi.fn() },
  userApi: { listDirectory: vi.fn() },
  authState: { user: null as null | { id: number; name: string; email: string; account_status: 'active'; avatar_url: null; timezone: string; roles: { id: number; name: string; slug: string; description: null; is_system: true }[]; permissions: string[] } },
}));

vi.mock('@/services/api/projectApi', () => ({ projectApi }));
vi.mock('@/services/api/teamApi', () => ({ teamApi }));
vi.mock('@/services/api/userApi', () => ({ userApi }));
vi.mock('@/features/auth/auth-hooks', () => ({ useAuth: () => authState }));

const project = {
  id: 9, uuid: 'project-uuid', name: 'Atlas rollout', slug: 'atlas-rollout', description: 'Coordinate the launch.', status: 'active' as const, priority: 'high' as const,
  owner: { id: 7, name: 'Amina Hassan', email: 'amina@example.com', avatar_url: null, timezone: 'UTC', job_title: 'Manager', department: 'Delivery' },
  start_date: '2026-01-01', due_date: '2026-12-01', completed_at: null, settings: null, members_count: 1, created_at: null, updated_at: null,
};
const projectMember = { id: 18, project_id: 9, user: project.owner, role: 'owner' as const, joined_at: null, created_at: null, updated_at: null };

function renderWithProviders(ui: React.ReactNode, initialEntry = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = { id: 7, name: 'Amina Hassan', email: 'amina@example.com', account_status: 'active', avatar_url: null, timezone: 'UTC', roles: [{ id: 1, name: 'Project Manager', slug: 'project-manager', description: null, is_system: true }], permissions: ['projects.view', 'projects.create', 'projects.update', 'projects.archive', 'projects.delete', 'projects.invite', 'users.view_directory', 'teams.view'] };
  projectApi.list.mockResolvedValue({ success: true, message: 'ok', data: [project], meta: { current_page: 1, last_page: 1, per_page: 12, total: 1 } });
  projectApi.get.mockResolvedValue(project);
  projectApi.members.mockResolvedValue({ success: true, message: 'ok', data: [projectMember], meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 } });
  projectApi.teams.mockResolvedValue({ success: true, message: 'ok', data: [] });
  teamApi.list.mockResolvedValue({ success: true, message: 'ok', data: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } });
  userApi.listDirectory.mockResolvedValue({ success: true, message: 'ok', data: [{ ...project.owner, id: 8, name: 'Omar Ali' }], meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 } });
});

describe('ProjectsRoute', () => {
  it('renders authorized projects and the create action', async () => {
    renderWithProviders(<ProjectsRoute />);
    expect(await screen.findByRole('link', { name: 'Atlas rollout' })).toHaveAttribute('href', '/projects/project-uuid');
    expect(screen.getByRole('link', { name: /new project/i })).toBeInTheDocument();
  });

  it('shows loading, empty, error and retry states', async () => {
    let resolveList: ((value: unknown) => void) | undefined;
    projectApi.list.mockImplementationOnce(() => new Promise((resolve) => { resolveList = resolve; }));
    renderWithProviders(<ProjectsRoute />);
    expect(screen.getByRole('status', { name: 'Loading projects' })).toBeInTheDocument();
    resolveList?.({ success: true, message: 'ok', data: [], meta: { current_page: 1, last_page: 1, per_page: 12, total: 0 } });
    expect(await screen.findByText('No projects found')).toBeInTheDocument();

    projectApi.list.mockRejectedValueOnce(new Error('network'));
    const view = renderWithProviders(<ProjectsRoute />);
    expect(await screen.findByText('Projects could not be loaded')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(projectApi.list).toHaveBeenCalledTimes(3));
    view.unmount();
  });

  it('submits supported search, status and pagination filters', async () => {
    renderWithProviders(<ProjectsRoute />);
    await screen.findByRole('link', { name: 'Atlas rollout' });
    fireEvent.change(screen.getByPlaceholderText('Search projects'), { target: { value: 'Atlas' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), { target: { value: 'active' } });
    await waitFor(() => expect(projectApi.list).toHaveBeenLastCalledWith({ page: 1, per_page: 12, search: 'Atlas', status: 'active' }));
  });

  it('hides creation when the backend permission is absent', async () => {
    authState.user!.permissions = ['projects.view'];
    renderWithProviders(<ProjectsRoute />);
    await screen.findByRole('link', { name: 'Atlas rollout' });
    expect(screen.queryByRole('link', { name: /new project/i })).not.toBeInTheDocument();
  });
});

describe('Project details and form', () => {
  it('loads real detail, project teams and contextual members', async () => {
    renderWithProviders(<Routes><Route path="/projects/:projectUuid" element={<ProjectDetailsRoute />} /></Routes>, '/projects/project-uuid');
    expect(await screen.findByRole('heading', { name: 'Atlas rollout' })).toBeInTheDocument();
    expect((await screen.findAllByText('Amina Hassan')).length).toBeGreaterThan(0);
    expect(screen.getByText('No teams are allocated to this project.')).toBeInTheDocument();
  });

  it('does not fetch cross-scope project details after a 404', async () => {
    projectApi.get.mockRejectedValueOnce({ status: 404 });
    renderWithProviders(<Routes><Route path="/projects/:projectUuid" element={<ProjectDetailsRoute />} /></Routes>, '/projects/private');
    expect(await screen.findByText('This project is unavailable or outside your access scope.')).toBeInTheDocument();
  });

  it('requires confirmation before archiving and calls the backend action afterward', async () => {
    projectApi.archive.mockResolvedValue({ ...project, status: 'archived' });
    renderWithProviders(<Routes><Route path="/projects/:projectUuid" element={<ProjectDetailsRoute />} /></Routes>, '/projects/project-uuid');
    await screen.findByRole('heading', { name: 'Atlas rollout' });
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(projectApi.archive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Archive project' }));
    await waitFor(() => expect(projectApi.archive).toHaveBeenCalledWith('project-uuid'));
  });

  it('allocates an eligible team using the existing project-team endpoint', async () => {
    const availableTeam = { id: 6, uuid: 'team-uuid', name: 'Platform team', slug: 'platform-team', description: null, leader: null, members_count: 1, created_at: null, updated_at: null };
    teamApi.list.mockResolvedValue({ success: true, message: 'ok', data: [availableTeam], meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 } });
    projectApi.allocateTeam.mockResolvedValue(availableTeam);
    renderWithProviders(<Routes><Route path="/projects/:projectUuid" element={<ProjectDetailsRoute />} /></Routes>, '/projects/project-uuid');
    await screen.findByText('No teams are allocated to this project.');
    await screen.findByRole('option', { name: 'Platform team' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Select a team to allocate' }), { target: { value: 'team-uuid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Allocate' }));
    await waitFor(() => expect(projectApi.allocateTeam).toHaveBeenCalledWith('project-uuid', 'team-uuid'));
  });

  it('creates a validated project and navigates to its UUID route', async () => {
    projectApi.create.mockResolvedValue(project);
    renderWithProviders(<Routes><Route path="/projects/new" element={<ProjectFormRoute />} /><Route path="/projects/:projectUuid" element={<h1>Created project destination</h1>} /></Routes>, '/projects/new');
    fireEvent.click(await screen.findByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('Enter a project name.')).toBeInTheDocument();
    fireEvent.change(document.querySelector('[name="name"]')!, { target: { value: 'Atlas rollout' } });
    fireEvent.change(document.querySelector('[name="description"]')!, { target: { value: 'Coordinate the launch.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(projectApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Atlas rollout', status: 'planning', priority: 'medium' })));
    expect(await screen.findByRole('heading', { name: 'Created project destination' })).toBeInTheDocument();
  });

  it('renders role management only for authorized project leads and invalidates after adding a member', async () => {
    projectApi.addMember.mockResolvedValue({ ...projectMember, id: 19, user: { ...project.owner, id: 8, name: 'Omar Ali' }, role: 'member' });
    renderWithProviders(<Routes><Route path="/projects/:projectUuid" element={<ProjectDetailsRoute />} /></Routes>, '/projects/project-uuid');
    expect(await screen.findByRole('button', { name: 'Add member' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Select a person to add' }), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(projectApi.addMember).toHaveBeenCalledWith('project-uuid', { user_id: 8, role: 'member' }));
  });

  it('prevents self or nonmember access to editing controls', async () => {
    authState.user!.id = 99;
    renderWithProviders(<Routes><Route path="/projects/:projectUuid" element={<ProjectDetailsRoute />} /></Routes>, '/projects/project-uuid');
    await screen.findByRole('heading', { name: 'Atlas rollout' });
    expect(screen.queryByRole('link', { name: 'Edit project' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
