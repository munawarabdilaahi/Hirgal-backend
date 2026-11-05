import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserIdentity } from '@/components/ui/user-identity';
import { useAuth } from '@/features/auth/auth-hooks';
import { AccountStatusBadge } from '@/features/auth/components/AccountStatusBadge';
import { useAdministrativeUsers, useUserDirectory } from '@/features/users/user-queries';
import { useDebouncedValue } from '@/features/users/use-debounced-value';
import { hasPermission } from '@/features/auth/permissions';
import type { AccountStatus, ApiDirectoryUser, ApiUser } from '@/services/api/contracts';

const roleFilters = [
  { slug: 'system-admin', label: 'System Admin' },
  { slug: 'project-manager', label: 'Project Manager' },
  { slug: 'team-leader', label: 'Team Leader' },
  { slug: 'member', label: 'Member' },
] as const;

const statusFilters = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'pending', label: 'Pending' },
] as const satisfies readonly { value: AccountStatus; label: string }[];

function requestErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = error.status;

    if (status === 403) {
      return 'Your account no longer has permission to view this list.';
    }

    if (status === 404) {
      return 'This user list is not available.';
    }

    if (status === 422) {
      return 'The API rejected one of these filters. Clear the filters and try again.';
    }

    if (status === 500) {
      return 'The server could not load users right now. Try again shortly.';
    }
  }

  return 'Hirgal could not load this list. Check your connection and try again.';
}

function usePageSize(defaultValue: number) {
  const [perPage, setPerPage] = useState(defaultValue);
  const [page, setPage] = useState(1);

  const changePageSize = (value: string) => {
    setPerPage(Number(value));
    setPage(1);
  };

  return { changePageSize, page, perPage, setPage };
}

export function UsersRoute() {
  const { user } = useAuth();

  return hasPermission(user, 'users.view') ? (
    <AdministrativeUserList />
  ) : (
    <CollaborativeDirectory />
  );
}

function CollaborativeDirectory() {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const debouncedDepartment = useDebouncedValue(department.trim());
  const { changePageSize, page, perPage, setPage } = usePageSize(20);
  const filters = useMemo(
    () => ({
      page,
      per_page: perPage,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(debouncedDepartment ? { department: debouncedDepartment } : {}),
    }),
    [debouncedDepartment, debouncedSearch, page, perPage],
  );
  const directoryQuery = useUserDirectory(filters);
  const users = directoryQuery.data?.data ?? [];
  const meta = directoryQuery.data?.meta;

  return (
    <section aria-labelledby="people-directory-title" className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">People</p>
        <h1 className="text-2xl font-semibold tracking-tight" id="people-directory-title">
          Team directory
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Find active teammates by name, email, job title, or department.
        </p>
      </header>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[minmax(16rem,1fr)_minmax(12rem,0.55fr)_auto]">
          <label className="relative block">
            <span className="sr-only">Search people</span>
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, email, or job title"
              type="search"
              value={search}
            />
          </label>
          <label>
            <span className="sr-only">Filter by department</span>
            <Input
              onChange={(event) => {
                setDepartment(event.target.value);
                setPage(1);
              }}
              placeholder="Department"
              value={department}
            />
          </label>
          <PageSizeSelect onChange={changePageSize} perPage={perPage} />
        </CardContent>
      </Card>

      {directoryQuery.isPending ? (
        <div className="flex min-h-48 items-center justify-center">
          <LoadingState label="Loading team directory" />
        </div>
      ) : directoryQuery.isError ? (
        <ErrorState
          action={
            <Button onClick={() => void directoryQuery.refetch()} variant="outline">
              Retry
            </Button>
          }
          description={requestErrorMessage(directoryQuery.error)}
          title="Directory unavailable"
        />
      ) : users.length === 0 ? (
        <EmptyState
          description={
            search || department
              ? 'Try a different search or clear the department filter.'
              : 'No active teammates are available in the directory yet.'
          }
          title={search || department ? 'No matching people' : 'No teammates to show'}
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="hidden md:block">
                <DirectoryTable users={users} />
              </div>
              <div className="grid gap-3 p-4 md:hidden">
                {users.map((person) => <DirectoryCard key={person.id} user={person} />)}
              </div>
            </CardContent>
          </Card>
          {meta ? (
            <ListPagination
              currentPage={meta.current_page}
              onPageChange={setPage}
              perPage={perPage}
              total={meta.total}
              totalPages={meta.last_page}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function DirectoryTable({ users }: { users: ApiDirectoryUser[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Person</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Time zone</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((person) => (
          <TableRow key={person.id}>
            <TableCell>
              <UserIdentity
                detail={[person.email, person.job_title].filter(Boolean).join(' · ')}
                imageUrl={person.avatar_url}
                name={person.name}
              />
            </TableCell>
            <TableCell>{person.department || '—'}</TableCell>
            <TableCell>{person.timezone || 'UTC'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DirectoryCard({ user }: { user: ApiDirectoryUser }) {
  return (
    <article className="rounded-lg border p-4">
      <UserIdentity
        detail={[user.email, user.job_title].filter(Boolean).join(' · ')}
        imageUrl={user.avatar_url}
        name={user.name}
      />
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Department</dt>
          <dd className="mt-1">{user.department || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Time zone</dt>
          <dd className="mt-1">{user.timezone || 'UTC'}</dd>
        </div>
      </dl>
    </article>
  );
}

function AdministrativeUserList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AccountStatus | 'all'>('all');
  const [role, setRole] = useState('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'name' | 'last_login_at'>('created_at');
  const debouncedSearch = useDebouncedValue(search.trim());
  const { changePageSize, page, perPage, setPage } = usePageSize(15);
  const filters = useMemo(
    () => ({
      page,
      per_page: perPage,
      sort_by: sortBy,
      sort_direction: 'desc' as const,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status !== 'all' ? { status } : {}),
      ...(role !== 'all' ? { role } : {}),
    }),
    [debouncedSearch, page, perPage, role, sortBy, status],
  );
  const usersQuery = useAdministrativeUsers(filters);
  const users = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;

  return (
    <section aria-labelledby="user-administration-title" className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">Administration</p>
        <h1 className="text-2xl font-semibold tracking-tight" id="user-administration-title">
          Users &amp; access
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Review global account status and roles. Administrative data is available only to accounts
          with the backend-provided <code>users.view</code> permission.
        </p>
      </header>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_minmax(9rem,0.45fr)_minmax(9rem,0.5fr)_minmax(11rem,0.55fr)_auto]">
          <label className="relative block">
            <span className="sr-only">Search users</span>
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name or email"
              type="search"
              value={search}
            />
          </label>
          <FilterSelect
            ariaLabel="Filter by account status"
            onValueChange={(value) => {
              setStatus(value === 'all' ? 'all' : value as AccountStatus);
              setPage(1);
            }}
            placeholder="All statuses"
            value={status}
          >
            <SelectItem value="all">All statuses</SelectItem>
            {statusFilters.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect
            ariaLabel="Filter by global role"
            onValueChange={(value) => {
              setRole(value);
              setPage(1);
            }}
            placeholder="All roles"
            value={role}
          >
            <SelectItem value="all">All roles</SelectItem>
            {roleFilters.map((item) => (
              <SelectItem key={item.slug} value={item.slug}>{item.label}</SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect
            ariaLabel="Sort users"
            onValueChange={(value) => setSortBy(value as typeof sortBy)}
            placeholder="Sort users"
            value={sortBy}
          >
            <SelectItem value="created_at">Recently added</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="last_login_at">Last sign-in</SelectItem>
          </FilterSelect>
          <PageSizeSelect onChange={changePageSize} perPage={perPage} />
        </CardContent>
      </Card>

      {usersQuery.isPending ? (
        <div className="flex min-h-48 items-center justify-center">
          <LoadingState label="Loading administrative users" />
        </div>
      ) : usersQuery.isError ? (
        <ErrorState
          action={
            <Button onClick={() => void usersQuery.refetch()} variant="outline">
              Retry
            </Button>
          }
          description={requestErrorMessage(usersQuery.error)}
          title="User list unavailable"
        />
      ) : users.length === 0 ? (
        <EmptyState
          description={search || status !== 'all' || role !== 'all'
            ? 'Adjust the search, status, or global role filters and try again.'
            : 'There are no user accounts to display.'}
          title={search || status !== 'all' || role !== 'all' ? 'No matching users' : 'No users yet'}
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="hidden md:block">
                <AdministrativeTable users={users} />
              </div>
              <div className="grid gap-3 p-4 md:hidden">
                {users.map((person) => <AdministrativeCard key={person.id} user={person} />)}
              </div>
            </CardContent>
          </Card>
          {meta ? (
            <ListPagination
              currentPage={meta.current_page}
              onPageChange={setPage}
              perPage={perPage}
              total={meta.total}
              totalPages={meta.last_page}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function AdministrativeTable({ users }: { users: ApiUser[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Global roles</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Department</TableHead>
          <TableHead><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((person) => (
          <TableRow key={person.id}>
            <TableCell>
              <UserIdentity
                detail={person.email}
                imageUrl={person.avatar_url}
                name={person.name}
              />
            </TableCell>
            <TableCell><GlobalRoleList user={person} /></TableCell>
            <TableCell><AccountStatusBadge status={person.account_status} /></TableCell>
            <TableCell>{person.profile?.department || '—'}</TableCell>
            <TableCell className="text-right">
              <Button asChild size="sm" variant="outline">
                <Link aria-label={`View ${person.name}`} to={`/users/${person.id}`}>
                  View user
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AdministrativeCard({ user }: { user: ApiUser }) {
  return (
    <article className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <UserIdentity detail={user.email} imageUrl={user.avatar_url} name={user.name} />
        <AccountStatusBadge status={user.account_status} />
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Global roles</p>
          <div className="mt-1"><GlobalRoleList user={user} /></div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Department</p>
          <p className="mt-1">{user.profile?.department || '—'}</p>
        </div>
      </div>
      <Button asChild className="mt-4 w-full" variant="outline">
        <Link to={`/users/${user.id}`}>
          <UserRound aria-hidden="true" />
          View user
        </Link>
      </Button>
    </article>
  );
}

function GlobalRoleList({ user }: { user: ApiUser }) {
  return user.roles?.length ? (
    <div className="flex flex-wrap gap-1.5">
      {user.roles.map((role) => <StatusBadge key={role.id} status="neutral" label={role.name} />)}
    </div>
  ) : <span className="text-sm text-muted-foreground">No global role</span>;
}

function FilterSelect({
  ariaLabel,
  children,
  onValueChange,
  placeholder,
  value,
}: {
  ariaLabel: string;
  children: React.ReactNode;
  onValueChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <Select onValueChange={onValueChange} value={value}>
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function PageSizeSelect({
  onChange,
  perPage,
}: {
  onChange: (value: string) => void;
  perPage: number;
}) {
  return (
    <FilterSelect
      ariaLabel="Results per page"
      onValueChange={onChange}
      placeholder="Page size"
      value={String(perPage)}
    >
      {[10, 15, 20, 50].map((size) => (
        <SelectItem key={size} value={String(size)}>{size} per page</SelectItem>
      ))}
    </FilterSelect>
  );
}

function ListPagination({
  currentPage,
  onPageChange,
  perPage,
  total,
  totalPages,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  perPage: number;
  total: number;
  totalPages: number;
}) {
  const startIndex = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const endIndex = Math.min(currentPage * perPage, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Showing {startIndex}–{endIndex} of {total}
      </p>
      {totalPages > 1 ? (
        <Pagination currentPage={currentPage} onPageChange={onPageChange} totalPages={totalPages} />
      ) : null}
    </div>
  );
}
