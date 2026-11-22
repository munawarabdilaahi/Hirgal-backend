import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { ApiDirectoryUser } from '@/services/api/contracts';
import { TaskAssigneesField } from './TaskAssigneesField';

const mockUsers: ApiDirectoryUser[] = [
  {
    id: 1,
    name: 'Sarah Connor',
    email: 'sarah@example.com',
    avatar_url: 'https://example.com/sarah.jpg',
    timezone: 'UTC',
    job_title: 'Lead Engineer',
    department: 'Engineering',
  },
  {
    id: 2,
    name: 'John Doe',
    email: 'john@example.com',
    avatar_url: null,
    timezone: 'UTC',
    job_title: 'Product Designer',
    department: 'Design',
  },
  {
    id: 3,
    name: 'Kyle Reese',
    email: 'kyle@example.com',
    avatar_url: null,
    timezone: 'UTC',
    job_title: 'QA Specialist',
    department: 'Engineering',
  },
];

function TestHarness({
  eligible = mockUsers,
  initialSelected = [],
  disabled = false,
  disabledMessage,
  isLoading = false,
}: {
  eligible?: ApiDirectoryUser[];
  initialSelected?: ApiDirectoryUser[];
  disabled?: boolean;
  disabledMessage?: string;
  isLoading?: boolean;
}) {
  const [selected, setSelected] = useState<ApiDirectoryUser[]>(initialSelected);

  return (
    <div>
      <TaskAssigneesField
        eligibleUsers={eligible}
        selectedUsers={selected}
        onChange={setSelected}
        disabled={disabled}
        disabledMessage={disabledMessage}
        isLoading={isLoading}
      />
    </div>
  );
}

describe('TaskAssigneesField', () => {
  it('displays trigger with unselected state and opens dropdown with eligible members', () => {
    render(<TestHarness />);

    const trigger = screen.getByRole('combobox', { name: 'Assignees' });
    expect(trigger).toHaveTextContent('Select assignees...');

    fireEvent.click(trigger);

    expect(screen.getByRole('option', { name: /Sarah Connor/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /John Doe/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Kyle Reese/i })).toBeInTheDocument();
    expect(screen.getByText('Lead Engineer · sarah@example.com')).toBeInTheDocument();
  });

  it('searches eligible members by name or email and handles empty search results', () => {
    render(<TestHarness />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Assignees' }));

    const searchInput = screen.getByRole('textbox', { name: 'Search assignees' });
    fireEvent.change(searchInput, { target: { value: 'john' } });

    expect(screen.getByRole('option', { name: /John Doe/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Sarah Connor/i })).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.getByText(/No members match.*nonexistent/)).toBeInTheDocument();
  });

  it('supports selecting multiple users, avoids duplicates, and displays removable chips', () => {
    render(<TestHarness />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Assignees' }));

    const sarahOption = screen.getByRole('option', { name: /Sarah Connor/i });
    fireEvent.click(sarahOption);

    const johnOption = screen.getByRole('option', { name: /John Doe/i });
    fireEvent.click(johnOption);

    // Both should be in selected chips
    expect(screen.getByTestId('assignee-chip-1')).toBeInTheDocument();
    expect(screen.getByTestId('assignee-chip-2')).toBeInTheDocument();

    const trigger = screen.getByRole('combobox', { name: 'Assignees' });
    expect(trigger).toHaveTextContent('2 selected');

    // Clicking Sarah again in dropdown toggles off rather than duplicating
    fireEvent.click(sarahOption);
    expect(screen.queryByTestId('assignee-chip-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('assignee-chip-2')).toBeInTheDocument();
    expect(trigger).toHaveTextContent('1 selected');
  });

  it('allows removing selected assignees via chip remove button', () => {
    render(<TestHarness initialSelected={[mockUsers[0]!, mockUsers[1]!]} />);

    expect(screen.getByTestId('assignee-chip-1')).toBeInTheDocument();
    expect(screen.getByTestId('assignee-chip-2')).toBeInTheDocument();

    const removeSarahBtn = screen.getByRole('button', { name: 'Remove Sarah Connor' });
    fireEvent.click(removeSarahBtn);

    expect(screen.queryByTestId('assignee-chip-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('assignee-chip-2')).toBeInTheDocument();
  });

  it('shows empty state when no eligible members exist', () => {
    render(<TestHarness eligible={[]} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Assignees' }));
    expect(screen.getByText('No eligible members available to assign.')).toBeInTheDocument();
  });

  it('renders disabled state with appropriate message when not authorized or private context', () => {
    render(<TestHarness disabled={true} disabledMessage="You do not have permission to assign tasks." />);

    const trigger = screen.getByRole('combobox', { name: 'Assignees' });
    expect(trigger).toBeDisabled();
    expect(screen.getByText('You do not have permission to assign tasks.')).toBeInTheDocument();
  });
});
