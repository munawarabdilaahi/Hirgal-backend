import { useState, useId } from 'react';
import { Check, ChevronsUpDown, Search, UserPlus, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LoadingState } from '@/components/feedback/LoadingState';
import { cn } from '@/lib/utils';
import type { ApiDirectoryUser } from '@/services/api/contracts';

interface TaskAssigneesFieldProps {
  eligibleUsers: ApiDirectoryUser[];
  selectedUsers: ApiDirectoryUser[];
  onChange: (users: ApiDirectoryUser[]) => void;
  isLoading?: boolean | undefined;
  disabled?: boolean | undefined;
  disabledMessage?: string | undefined;
  label?: string | undefined;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export function TaskAssigneesField({
  eligibleUsers,
  selectedUsers,
  onChange,
  isLoading = false,
  disabled = false,
  disabledMessage,
  label = 'Assignees',
}: TaskAssigneesFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchId = useId();

  const query = search.trim().toLowerCase();
  const filteredUsers = eligibleUsers.filter((user) => {
    if (!query) return true;
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.role && user.role.toLowerCase().includes(query)) ||
      (user.job_title && user.job_title.toLowerCase().includes(query)) ||
      (user.department && user.department.toLowerCase().includes(query))
    );
  });

  function toggleUser(user: ApiDirectoryUser) {
    const isSelected = selectedUsers.some((u) => u.id === user.id);
    if (isSelected) {
      onChange(selectedUsers.filter((u) => u.id !== user.id));
    } else {
      onChange([...selectedUsers, user]);
    }
  }

  function removeUser(userId: number) {
    onChange(selectedUsers.filter((u) => u.id !== userId));
  }

  return (
    <div className="grid gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={label}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal h-10 px-3',
              selectedUsers.length === 0 && 'text-muted-foreground',
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <UserPlus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {selectedUsers.length > 0
                ? `${selectedUsers.length} selected`
                : 'Select assignees...'}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 shadow-md"
        >
          <div className="flex items-center border-b px-3 py-2 gap-2">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              id={searchId}
              type="text"
              placeholder="Search members by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Search assignees"
              autoComplete="off"
            />
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5"
                onClick={() => setSearch('')}
                aria-label="Clear assignee search"
              >
                <X className="size-3" />
              </Button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto p-1" role="listbox" aria-multiselectable="true" aria-label={label}>
            {isLoading && (
              <div className="p-3 text-center text-sm text-muted-foreground">
                <LoadingState label="Loading members" layout="inline" />
              </div>
            )}

            {!isLoading && eligibleUsers.length === 0 && (
              <p className="p-4 text-center text-xs text-muted-foreground" role="status">
                No eligible members available to assign.
              </p>
            )}

            {!isLoading && eligibleUsers.length > 0 && filteredUsers.length === 0 && (
              <p className="p-4 text-center text-xs text-muted-foreground" role="status">
                No members match &ldquo;{search}&rdquo;.
              </p>
            )}

            {!isLoading &&
              filteredUsers.map((user) => {
                const isSelected = selectedUsers.some((u) => u.id === user.id);
                return (
                  <button
                    type="button"
                    key={user.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleUser(user)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-primary/10 text-primary font-medium hover:bg-primary/15',
                    )}
                  >
                    <Avatar className="size-8 shrink-0">
                      {user.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
                      <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight text-foreground">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground leading-tight mt-0.5">
                        {[user.role || user.job_title, user.email].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="size-4 text-primary shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
          </div>
        </PopoverContent>
      </Popover>

      {disabledMessage && (
        <p className="text-xs text-muted-foreground" role="status">
          {disabledMessage}
        </p>
      )}

      {selectedUsers.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1" aria-label="Selected assignees">
          {selectedUsers.map((user) => (
            <li key={user.id}>
              <div
                className="inline-flex items-center gap-2 rounded-lg border bg-secondary/50 py-1 pl-1.5 pr-2 text-xs font-medium text-secondary-foreground shadow-xs transition-colors hover:bg-secondary/70"
                data-testid={`assignee-chip-${user.id}`}
              >
                <Avatar className="size-6 shrink-0">
                  {user.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
                  <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 pr-1">
                  <span className="truncate max-w-[140px] text-xs font-semibold leading-tight text-foreground">
                    {user.name}
                  </span>
                  {user.job_title ? (
                    <span className="truncate max-w-[140px] text-[10px] text-muted-foreground leading-tight">
                      {user.job_title}
                    </span>
                  ) : (
                    <span className="truncate max-w-[140px] text-[10px] text-muted-foreground leading-tight">
                      {user.email}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${user.name}`}
                  onClick={() => removeUser(user.id)}
                  className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
