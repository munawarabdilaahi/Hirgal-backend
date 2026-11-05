import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { useDebouncedValue } from '@/features/users/use-debounced-value';
import { userApi } from '@/services/api/userApi';
import type { ApiDirectoryUser } from '@/services/api/contracts';

interface DirectoryUserPickerProps {
  ariaLabel: string;
  enabled: boolean;
  excludeIds?: number[];
  selectedId: string;
  selectedUser: ApiDirectoryUser | null;
  onSelect: (user: ApiDirectoryUser | null) => void;
}

export function DirectoryUserPicker({ ariaLabel, enabled, excludeIds = [], selectedId, selectedUser, onSelect }: DirectoryUserPickerProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const searchIsSettled = search.trim() === debouncedSearch;
  const directoryQuery = useQuery({
    queryKey: ['users', 'directory', 'picker', debouncedSearch, page],
    queryFn: () => userApi.listDirectory({ page, per_page: 100, ...(debouncedSearch ? { search: debouncedSearch } : {}) }),
    enabled: enabled && searchIsSettled,
  });
  const users = searchIsSettled ? directoryQuery.data?.data ?? [] : [];
  const selectableUsers = [
    ...(selectedUser && !users.some((user) => user.id === selectedUser.id) ? [selectedUser] : []),
    ...users.filter((user) => !excludeIds.includes(user.id) || String(user.id) === selectedId),
  ];

  return <div className="space-y-2">
    <Input aria-label={`Search ${ariaLabel}`} autoComplete="off" maxLength={100} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={`Search ${ariaLabel.toLowerCase()}`} value={search} />
    {directoryQuery.isError ? <div className="space-y-2 rounded-md border border-destructive/30 p-3" role="alert"><p className="text-sm text-destructive">People could not be loaded. Check your connection and try again.</p><Button onClick={() => void directoryQuery.refetch()} type="button" variant="outline">Try again</Button></div> : null}
    {!enabled ? <p className="text-sm text-muted-foreground" role="status">The people directory permission is required to select a person.</p> : null}
    {enabled && directoryQuery.isPending && searchIsSettled ? <p className="text-sm text-muted-foreground" role="status">Loading people…</p> : null}
    {!directoryQuery.isPending && !directoryQuery.isError && searchIsSettled && users.length === 0 ? <p className="text-sm text-muted-foreground" role="status">No people found. Try another search.</p> : null}
    <select aria-label={ariaLabel} className="h-10 w-full rounded-md border bg-background px-3" disabled={!enabled || directoryQuery.isPending || directoryQuery.isError} onChange={(event) => onSelect(selectableUsers.find((user) => String(user.id) === event.target.value) ?? null)} value={selectedId}>
      <option value="">Choose a person</option>
      {selectableUsers.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}
    </select>
    {searchIsSettled && directoryQuery.data?.meta ? <Pagination currentPage={directoryQuery.data.meta.current_page} onPageChange={setPage} totalPages={directoryQuery.data.meta.last_page} /> : null}
  </div>;
}
