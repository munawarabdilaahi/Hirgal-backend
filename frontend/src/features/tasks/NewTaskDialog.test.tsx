import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/api/apiClient';
import { projectApi } from '@/services/api/projectApi';
import { taskApi } from '@/services/api/taskApi';
import type { ApiDirectoryUser, ApiProject } from '@/services/api/contracts';
import { NewTaskDialog } from './NewTaskDialog';

vi.mock('@/services/api/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/projectApi', () => ({
  projectApi: {
    list: vi.fn(),
    members: vi.fn(),
  },
}));

vi.mock('@/services/api/taskApi', () => ({
  taskApi: {
    getAssignees: vi.fn(),
  },
}));

const mockProject: ApiProject = {
  id: 1,
  uuid: 'project-uuid-1',
  name: 'Core Platform',
  slug: 'core-platform',
  description: null,
  status: 'active',
  priority: 'high',
  start_date: null,
  due_date: null,
  completed_at: null,
  settings: null,
  created_at: null,
  updated_at: null,
};

const mockAdminUser: ApiDirectoryUser = {
  id: 1,
  name: 'System Administrator',
  email: 'admin@hirgal.local',
  avatar_url: null,
  timezone: 'UTC',
  job_title: null,
  department: null,
  role: 'System Administrator',
};

const mockMember1: ApiDirectoryUser = {
  id: 101,
  name: 'Alice Smith',
  email: 'alice@example.com',
  avatar_url: null,
  timezone: 'UTC',
  job_title: 'Backend Dev',
  department: 'Engineering',
  role: 'Member',
};

const mockMember2: ApiDirectoryUser = {
  id: 102,
  name: 'Bob Jones',
  email: 'bob@example.com',
  avatar_url: null,
  timezone: 'UTC',
  job_title: 'Frontend Dev',
  department: 'Engineering',
  role: 'Member',
};

const mockPmUser: ApiDirectoryUser = {
  id: 103,
  name: 'Sarah Project Manager',
  email: 'pm@hirgal.local',
  avatar_url: null,
  timezone: 'UTC',
  job_title: 'Lead PM',
  department: 'Product',
  role: 'Project Manager',
};

function renderDialog({
  onClose = vi.fn(),
  canAssign = true,
  canViewProjects = true,
  initialProjectUuid,
}: {
  onClose?: () => void;
  canAssign?: boolean;
  canViewProjects?: boolean;
  initialProjectUuid?: string | undefined;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NewTaskDialog
        actorId={1}
        canViewProjects={canViewProjects}
        canAssign={canAssign}
        statuses={{ todo: 'To Do', in_progress: 'In Progress', done: 'Done' }}
        priorities={['low', 'medium', 'high', 'urgent']}
        initialProjectUuid={initialProjectUuid}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
}

describe('NewTaskDialog Assignee Selection Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('allows selecting assignees in step 0, preserves them across wizard steps, and submits them together', async () => {
    vi.mocked(projectApi.list).mockResolvedValue({
      success: true,
      message: 'ok',
      data: [mockProject],
      meta: { current_page: 1, last_page: 1, per_page: 50, total: 1 },
    });

    vi.mocked(taskApi.getAssignees).mockResolvedValue({
      success: true,
      message: 'ok',
      data: [mockMember1, mockMember2],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 2 },
    });

    vi.mocked(apiClient.post).mockResolvedValue({
      data: { data: { id: 99, uuid: 'task-99', title: 'Feature Task' } },
    });

    const onClose = vi.fn();
    renderDialog({ onClose, initialProjectUuid: 'project-uuid-1' });

    // Step 0: Fill task name
    const titleInput = screen.getByRole('textbox', { name: 'Task name' });
    fireEvent.change(titleInput, { target: { value: 'Feature Task' } });

    // Step 0: Open Assignees selector
    const assigneesTrigger = await screen.findByRole('combobox', { name: 'Assignees' });
    fireEvent.click(assigneesTrigger);

    // Wait for assignees to appear
    const aliceOption = await screen.findByRole('option', { name: /Alice Smith/i });
    fireEvent.click(aliceOption);

    const bobOption = await screen.findByRole('option', { name: /Bob Jones/i });
    fireEvent.click(bobOption);

    // Both should be shown as chips
    expect(screen.getByTestId('assignee-chip-101')).toBeInTheDocument();
    expect(screen.getByTestId('assignee-chip-102')).toBeInTheDocument();

    // Step 0: Add a tag (verifying tags and assignees stay separate)
    const tagInput = screen.getByRole('textbox', { name: 'Tags' });
    fireEvent.change(tagInput, { target: { value: 'Frontend' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    expect(screen.getByText('Frontend')).toBeInTheDocument();

    // Click Continue -> Step 1 (Context)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // On Step 1: Heading should be Context
    await screen.findByRole('heading', { name: 'Context' });

    // Check that assignees remain selected in Step 1
    expect(screen.getByTestId('assignee-chip-101')).toBeInTheDocument();
    expect(screen.getByTestId('assignee-chip-102')).toBeInTheDocument();

    // Click Continue -> Step 2 (Review)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('heading', { name: 'Review' });

    // Review summary should display assigned members and tags separately
    expect(screen.getByText('Alice Smith, Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/projects/project-uuid-1/tasks',
        expect.objectContaining({
          title: 'Feature Task',
          assignees: [101, 102],
          tags: ['Frontend'],
        }),
      );
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('displays multiple workspace assignees and does not restrict dropdown to authenticated user', async () => {
    vi.mocked(projectApi.list).mockResolvedValue({
      success: true,
      message: 'ok',
      data: [mockProject],
      meta: { current_page: 1, last_page: 1, per_page: 50, total: 1 },
    });

    vi.mocked(taskApi.getAssignees).mockResolvedValue({
      success: true,
      message: 'ok',
      data: [mockAdminUser, mockPmUser, mockMember1, mockMember2],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 4 },
    });

    renderDialog({ initialProjectUuid: undefined });

    // Verify taskApi.getAssignees was called without a project
    await waitFor(() => {
      expect(taskApi.getAssignees).toHaveBeenCalledWith(
        expect.objectContaining({ project: undefined }),
      );
    });

    // Open Assignees selector
    const assigneesTrigger = await screen.findByRole('combobox', { name: 'Assignees' });
    fireEvent.click(assigneesTrigger);

    // All 4 users should appear, not just admin
    expect(await screen.findByRole('option', { name: /System Administrator/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Sarah Project Manager/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Alice Smith/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Bob Jones/i })).toBeInTheDocument();

    // Search by name filters correctly
    const searchInput = screen.getByLabelText('Search assignees');
    fireEvent.change(searchInput, { target: { value: 'Sarah' } });

    expect(screen.getByRole('option', { name: /Sarah Project Manager/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Alice Smith/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /System Administrator/i })).not.toBeInTheDocument();
  });

  it('preserves entered data and assignees if API submission fails', async () => {
    vi.mocked(projectApi.list).mockResolvedValue({
      success: true,
      message: 'ok',
      data: [mockProject],
      meta: { current_page: 1, last_page: 1, per_page: 50, total: 1 },
    });

    vi.mocked(taskApi.getAssignees).mockResolvedValue({
      success: true,
      message: 'ok',
      data: [mockMember1],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 },
    });

    const error = new Error('Server error');
    (error as unknown as Record<string, unknown>).response = {
      data: { message: 'Server exploded while saving' },
      status: 500,
    };
    vi.mocked(apiClient.post).mockRejectedValue(error);

    const onClose = vi.fn();
    renderDialog({ onClose, initialProjectUuid: 'project-uuid-1' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Task name' }), {
      target: { value: 'Failing Task' },
    });

    const assigneesTrigger = await screen.findByRole('combobox', { name: 'Assignees' });
    fireEvent.click(assigneesTrigger);
    const aliceOption = await screen.findByRole('option', { name: /Alice Smith/i });
    fireEvent.click(aliceOption);

    // Step 0 -> Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Context' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Review' });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));

    // Error should be displayed
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Something went wrong/);

    // Dialog should not have closed
    expect(onClose).not.toHaveBeenCalled();

    // Form data and assignees still intact
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('blocks step 1 continuation if an assignee is not an eligible member of the selected project', async () => {
    vi.mocked(projectApi.list).mockResolvedValue({
      success: true,
      message: 'ok',
      data: [mockProject],
      meta: { current_page: 1, last_page: 1, per_page: 50, total: 1 },
    });

    // Step 0 without project returns outsider
    vi.mocked(taskApi.getAssignees).mockImplementation(async (params) => {
      const project = params?.project;
      if (!project) {
        return {
          success: true,
          message: 'ok',
          data: [mockMember1, mockMember2],
          meta: { current_page: 1, last_page: 1, per_page: 100, total: 2 },
        };
      }
      // Project only has mockMember1 (Alice), Bob is not a project member
      return {
        success: true,
        message: 'ok',
        data: [mockMember1],
        meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 },
      };
    });

    renderDialog({ initialProjectUuid: undefined });

    // Fill task title
    fireEvent.change(screen.getByRole('textbox', { name: 'Task name' }), {
      target: { value: 'Project Assignment Test' },
    });

    // Select Bob (who is not in project)
    const assigneesTrigger = await screen.findByRole('combobox', { name: 'Assignees' });
    fireEvent.click(assigneesTrigger);
    const bobOption = await screen.findByRole('option', { name: /Bob Jones/i });
    fireEvent.click(bobOption);

    // Proceed to Step 1
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Context' });

    // Select mockProject
    // ChoiceSelect trigger
    const projectTrigger = screen.getByRole('combobox', { name: 'Project' });
    fireEvent.click(projectTrigger);
    const projectOption = await screen.findByRole('option', { name: /Core Platform/i });
    fireEvent.click(projectOption);

    await waitFor(() => {
      expect(taskApi.getAssignees).toHaveBeenCalledWith(
        expect.objectContaining({ project: 'project-uuid-1' }),
      );
    });

    await screen.findByRole('combobox', { name: 'Assigned to' });

    // Try to proceed to Step 2
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Should stay on step 1 with validation message
    expect(await screen.findByText(/not members of Core Platform: Bob Jones/i)).toBeInTheDocument();
  });
});
