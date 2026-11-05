import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamDetailsRoute, TeamFormRoute, TeamsRoute } from './TeamsRoutes';

const { teamApi, userApi, authState } = vi.hoisted(() => ({
  teamApi: { list: vi.fn(), get: vi.fn(), members: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), addMember: vi.fn(), updateMember: vi.fn(), removeMember: vi.fn() },
  userApi: { listDirectory: vi.fn() },
  authState: { user: null as null | { id: number; name: string; email: string; account_status: 'active'; avatar_url: null; timezone: string; roles: { id: number; name: string; slug: string; description: null; is_system: true }[]; permissions: string[] } },
}));

vi.mock('@/services/api/teamApi', () => ({ teamApi }));
vi.mock('@/services/api/userApi', () => ({ userApi }));
vi.mock('@/features/auth/auth-hooks', () => ({ useAuth: () => authState }));

const team = { id: 4, uuid: 'team-uuid', name: 'Platform team', slug: 'platform-team', description: 'Platform engineering.', leader: { id: 7, name: 'Amina Hassan', email: 'amina@example.com', avatar_url: null, timezone: 'UTC', job_title: 'Lead', department: 'Engineering' }, members_count: 1, created_at: null, updated_at: null };
const member = { id: 11, team_id: 4, user: team.leader, role: 'leader' as const, joined_at: null, created_at: null, updated_at: null };

function renderWithProviders(ui: React.ReactNode, initialEntry = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = { id: 7, name: 'Amina Hassan', email: 'amina@example.com', account_status: 'active', avatar_url: null, timezone: 'UTC', roles: [{ id: 2, name: 'Team Leader', slug: 'team-leader', description: null, is_system: true }], permissions: ['teams.view', 'teams.create', 'teams.update', 'teams.delete', 'teams.manage', 'users.view_directory'] };
  teamApi.list.mockResolvedValue({ success: true, message: 'ok', data: [team], meta: { current_page: 1, last_page: 1, per_page: 12, total: 1 } });
  teamApi.get.mockResolvedValue(team);
  teamApi.members.mockResolvedValue({ success: true, message: 'ok', data: [member], meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 } });
  userApi.listDirectory.mockResolvedValue({ success: true, message: 'ok', data: [{ ...team.leader, id: 8, name: 'Omar Ali' }], meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 } });
});

describe('TeamsRoute', () => {
  it('renders API teams and authorized create action', async () => {
    renderWithProviders(<TeamsRoute />);
    expect(await screen.findByRole('link', { name: 'Platform team' })).toHaveAttribute('href', '/teams/team-uuid');
    expect(screen.getByRole('link', { name: /new team/i })).toBeInTheDocument();
  });

  it('renders empty and retryable error states', async () => {
    teamApi.list.mockResolvedValueOnce({ success: true, message: 'ok', data: [], meta: { current_page: 1, last_page: 1, per_page: 12, total: 0 } });
    const { unmount } = renderWithProviders(<TeamsRoute />);
    expect(await screen.findByText('No teams found')).toBeInTheDocument();
    unmount();
    teamApi.list.mockRejectedValueOnce({ status: 500 });
    renderWithProviders(<TeamsRoute />);
    expect(await screen.findByText('Teams could not be loaded')).toBeInTheDocument();
  });

  it('filters the list with the supported search parameter', async () => {
    renderWithProviders(<TeamsRoute />);
    await screen.findByRole('link', { name: 'Platform team' });
    fireEvent.change(screen.getByPlaceholderText('Search teams'), { target: { value: 'Platform' } });
    await waitFor(() => expect(teamApi.list).toHaveBeenLastCalledWith({ page: 1, per_page: 12, search: 'Platform' }));
  });
});

describe('Team detail and form', () => {
  it('renders team information and manages supported roster roles', async () => {
    teamApi.addMember.mockResolvedValue({ ...member, id: 12, user: { ...team.leader, id: 8, name: 'Omar Ali' }, role: 'member' });
    renderWithProviders(<Routes><Route path="/teams/:teamUuid" element={<TeamDetailsRoute />} /></Routes>, '/teams/team-uuid');
    expect(await screen.findByRole('heading', { name: 'Platform team' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Add member' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Select a person to add' }), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(teamApi.addMember).toHaveBeenCalledWith('team-uuid', { user_id: 8, role: 'member' }));
  });

  it('creates a team using a validated server compatible payload', async () => {
    teamApi.create.mockResolvedValue(team);
    renderWithProviders(<Routes><Route path="/teams/new" element={<TeamFormRoute />} /><Route path="/teams/:teamUuid" element={<h1>Created team destination</h1>} /></Routes>, '/teams/new');
    fireEvent.change(document.querySelector('[name="name"]')!, { target: { value: 'Platform team' } });
    fireEvent.change(document.querySelector('[name="description"]')!, { target: { value: 'Platform engineering.' } });
    await screen.findByRole('option', { name: /Omar Ali/ });
    fireEvent.change(screen.getByRole('combobox', { name: 'Team lead' }), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));
    await waitFor(() => expect(teamApi.create).toHaveBeenCalledWith({ name: 'Platform team', description: 'Platform engineering.', leader_id: 8 }));
    expect(await screen.findByRole('heading', { name: 'Created team destination' })).toBeInTheDocument();
  });

  it('does not offer team edits without contextual team leadership', async () => {
    authState.user!.id = 99;
    renderWithProviders(<Routes><Route path="/teams/:teamUuid" element={<TeamDetailsRoute />} /></Routes>, '/teams/team-uuid');
    await screen.findByRole('heading', { name: 'Platform team' });
    expect(screen.queryByRole('link', { name: 'Edit team' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument();
  });
});
