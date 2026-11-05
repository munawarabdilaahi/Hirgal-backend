import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userApi } from '@/services/api/userApi';
import type { ApiDirectoryUser } from '@/services/api/contracts';
import { DirectoryUserPicker } from './DirectoryUserPicker';

vi.mock('@/services/api/userApi', () => ({ userApi: { listDirectory: vi.fn() } }));

const firstUser: ApiDirectoryUser = { id: 101, name: 'Amina Hassan', email: 'amina@example.com', avatar_url: null, timezone: 'UTC', job_title: null, department: null };
const laterUser: ApiDirectoryUser = { ...firstUser, id: 202, name: 'Zahra Noor', email: 'zahra@example.com' };

function Harness({ onSubmit }: { onSubmit: (() => void) | undefined }) {
  const [selectedUser, setSelectedUser] = useState<ApiDirectoryUser | null>(null);
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit?.(); }}><DirectoryUserPicker ariaLabel="Select a person" enabled onSelect={setSelectedUser} selectedId={selectedUser ? String(selectedUser.id) : ''} selectedUser={selectedUser} /><button type="submit">Submit parent form</button></form>;
}

function renderPicker(onSubmit?: () => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><Harness onSubmit={onSubmit} /></QueryClientProvider>);
}

describe('DirectoryUserPicker', () => {
  it('searches across server results, paginates, and preserves a selected user between pages', async () => {
    vi.mocked(userApi.listDirectory)
      .mockResolvedValueOnce({ success: true, message: 'ok', data: [firstUser], meta: { current_page: 1, last_page: 2, per_page: 100, total: 101 } })
      .mockResolvedValueOnce({ success: true, message: 'ok', data: [laterUser], meta: { current_page: 2, last_page: 2, per_page: 100, total: 101 } })
      .mockResolvedValueOnce({ success: true, message: 'ok', data: [laterUser], meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 } });

    const onSubmit = vi.fn();
    renderPicker(onSubmit);
    const select = await screen.findByRole('combobox', { name: 'Select a person' });
    await screen.findByRole('option', { name: /Amina Hassan/ });
    expect(userApi.listDirectory).toHaveBeenNthCalledWith(1, { page: 1, per_page: 100 });
    fireEvent.change(select, { target: { value: '101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(onSubmit).not.toHaveBeenCalled();
    await screen.findByRole('option', { name: /Zahra Noor/ });
    expect(userApi.listDirectory).toHaveBeenNthCalledWith(2, { page: 2, per_page: 100 });
    expect(select).toHaveValue('101');
    expect(screen.getByRole('option', { name: /Amina Hassan/ })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search Select a person' }), { target: { value: 'Zahra' } });
    await waitFor(() => expect(userApi.listDirectory).toHaveBeenNthCalledWith(3, { page: 1, per_page: 100, search: 'Zahra' }));
    expect(select).toHaveValue('101');
    expect(screen.getByRole('option', { name: /Amina Hassan/ })).toBeInTheDocument();
  });

  it('shows directory failures with a retry action', async () => {
    vi.mocked(userApi.listDirectory).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ success: true, message: 'ok', data: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } });
    const onSubmit = vi.fn();
    renderPicker(onSubmit);
    expect(await screen.findByText(/People could not be loaded/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText('No people found. Try another search.')).toBeInTheDocument();
  });
});
