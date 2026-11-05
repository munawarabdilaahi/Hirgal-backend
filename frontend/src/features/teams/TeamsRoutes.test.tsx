import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
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
    await screen.findByRole('option', { name: /Omar Ali/ });
    fireEvent.change(screen.getByRole('combobox', { name: 'Select a person to add' }), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(teamApi.addMember).toHaveBeenCalledWith('team-uuid', { user_id: 8, role: 'member' }));
    await waitFor(() => expect(teamApi.members.mock.calls.length).toBeGreaterThan(1));
  });

  it('excludes known members from later roster pages when choosing candidates', async () => {
    const existingMember = { ...member, id: 12, user: { ...team.leader, id: 8, name: 'Omar Ali' }, role: 'member' as const };
    teamApi.members.mockImplementation(async (_uuid: string, page = 1) => ({
      success: true,
      message: 'ok',
      data: page === 1 ? [member] : [existingMember],
      meta: { current_page: page, last_page: 2, per_page: 100, total: 101 },
    }));
    renderWithProviders(<Routes><Route path="/teams/:teamUuid" element={<TeamDetailsRoute />} /></Routes>, '/teams/team-uuid');
    await screen.findByRole('button', { name: 'Add member' });
    await waitFor(() => expect(teamApi.members).toHaveBeenCalledWith('team-uuid', 2));
    expect(screen.queryByRole('option', { name: /Omar Ali/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add member' })).toBeDisabled();
    expect(teamApi.addMember).not.toHaveBeenCalled();
  });

  it('shows a useful message when the backend rejects a member for project eligibility', async () => {
    teamApi.addMember.mockRejectedValueOnce({ status: 422 });
    renderWithProviders(<Routes><Route path="/teams/:teamUuid" element={<TeamDetailsRoute />} /></Routes>, '/teams/team-uuid');
    await screen.findByRole('button', { name: 'Add member' });
    await screen.findByRole('option', { name: /Omar Ali/ });
    fireEvent.change(screen.getByRole('combobox', { name: 'Select a person to add' }), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('They must belong to every project allocated to this team');
  });

  it('paginates long team rosters using the backend page parameter', async () => {
    teamApi.members
      .mockResolvedValueOnce({ success: true, message: 'ok', data: [member], meta: { current_page: 1, last_page: 2, per_page: 100, total: 101 } })
      .mockResolvedValueOnce({ success: true, message: 'ok', data: [{ ...member, id: 12, user: { ...team.leader, id: 8, name: 'Omar Ali' }, role: 'member' }], meta: { current_page: 2, last_page: 2, per_page: 100, total: 101 } });
    renderWithProviders(<Routes><Route path="/teams/:teamUuid" element={<TeamDetailsRoute />} /></Routes>, '/teams/team-uuid');
    expect((await screen.findAllByText('Amina Hassan')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(await screen.findByText('Omar Ali')).toBeInTheDocument();
    expect(teamApi.members).toHaveBeenLastCalledWith('team-uuid', 2);
  });

  it('resets roster pagination when navigating directly to another team', async () => {
    teamApi.get.mockImplementation((uuid: string) => Promise.resolve(uuid === 'other-team' ? { ...team, uuid, name: 'Other team' } : team));
    teamApi.members.mockImplementation((uuid: string, page = 1) => Promise.resolve({
      success: true,
      message: 'ok',
      data: page === 2 ? [{ ...member, id: 12, user: { ...team.leader, id: 8, name: 'Omar Ali' }, role: 'member' }] : [member],
      meta: { current_page: page, last_page: uuid === 'team-uuid' ? 2 : 1, per_page: 100, total: uuid === 'team-uuid' ? 101 : 1 },
    }));
    renderWithProviders(<><Link to="/teams/other-team">Open another team</Link><Routes><Route path="/teams/:teamUuid" element={<TeamDetailsRoute />} /></Routes></>, '/teams/team-uuid');
    await screen.findByRole('heading', { name: 'Platform team' });
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(await screen.findByText('Omar Ali')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Open another team' }));
    expect(await screen.findByRole('heading', { name: 'Other team' })).toBeInTheDocument();
    await waitFor(() => expect(teamApi.members).toHaveBeenLastCalledWith('other-team', 1));
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

  it('does not send a null leader when an edit selection is cleared', async () => {
    teamApi.update.mockResolvedValueOnce(team);
    renderWithProviders(<Routes><Route path="/teams/:teamUuid/edit" element={<TeamFormRoute />} /><Route path="/teams/:teamUuid" element={<h1>Team destination</h1>} /></Routes>, '/teams/team-uuid/edit');
    const leaderPicker = await screen.findByRole('combobox', { name: 'Team lead' });
    fireEvent.change(leaderPicker, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(teamApi.update).toHaveBeenCalled());
    const [, request] = teamApi.update.mock.calls[0] as [string, Record<string, unknown>];
    expect(request).not.toHaveProperty('leader_id');
  });

  it('does not offer team edits without contextual team leadership', async () => {
    authState.user!.id = 99;
    renderWithProviders(<Routes><Route path="/teams/:teamUuid" element={<TeamDetailsRoute />} /></Routes>, '/teams/team-uuid');
    await screen.findByRole('heading', { name: 'Platform team' });
    expect(screen.queryByRole('link', { name: 'Edit team' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument();
  });

  it('recognizes a contextual team leader on a later roster page', async () => {
    authState.user!.id = 8;
    teamApi.members.mockImplementation(async (_uuid: string, page = 1) => ({
      success: true,
      message: 'ok',
      data: page === 1 ? [member] : [{ ...member, id: 12, user: { ...team.leader, id: 8, name: 'Omar Ali' }, role: 'leader' as const }],
      meta: { current_page: page, last_page: 2, per_page: 100, total: 101 },
    }));
    renderWithProviders(<Routes><Route path="/teams/:teamUuid" element={<TeamDetailsRoute />} /></Routes>, '/teams/team-uuid');
    expect(await screen.findByRole('link', { name: 'Edit team' })).toHaveAttribute('href', '/teams/team-uuid/edit');
    expect(await screen.findByRole('button', { name: 'Add member' })).toBeInTheDocument();
    expect(teamApi.members).toHaveBeenCalledWith('team-uuid', 2);
  });
});
