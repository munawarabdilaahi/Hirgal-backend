import { ChoiceOption, ChoiceSelect } from '@/components/ui/choice-select';
import { useState } from 'react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { useDebouncedValue } from '@/features/users/use-debounced-value';
import { useTeams } from '@/features/teams/team-queries';
import type { ApiTeam } from '@/services/api/contracts';

interface ProjectTeamAllocationPickerProps {
  allocatedTeamUuids: string[];
  enabled: boolean;
  onSelect: (team: ApiTeam | null) => void;
  selectedTeam: ApiTeam | null;
}

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'status' in error && error.status === 403) {
    return 'Your account cannot view teams available for allocation.';
  }

  return 'Available teams could not be loaded. Check your connection and try again.';
}

export function ProjectTeamAllocationPicker({
  allocatedTeamUuids,
  enabled,
  onSelect,
  selectedTeam,
}: ProjectTeamAllocationPickerProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const searchIsSettled = search.trim() === debouncedSearch;
  const filters = {
    page,
    per_page: 12,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  };
  const teamsQuery = useTeams(filters, enabled && searchIsSettled);
  const teams = teamsQuery.data?.data ?? [];
  const availableTeams = teams.filter((team) => !allocatedTeamUuids.includes(team.uuid));
  const selectedTeamIsOnPage = teams.some((team) => team.uuid === selectedTeam?.uuid);

  return (
    <div className="space-y-3 border-t pt-3">
      <label className="block space-y-1.5 text-sm font-medium">
        <span>Search available teams</span>
        <SearchInput
          maxLength={100}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search teams"
          value={search}
        />
      </label>
      {teamsQuery.isPending ? <LoadingState label="Loading available teams" layout="inline" /> : null}
      {teamsQuery.isError ? (
        <ErrorState
          description={errorMessage(teamsQuery.error)}
          onRetry={() => void teamsQuery.refetch()}
          title="Available teams could not be loaded"
        />
      ) : null}
      {teamsQuery.isSuccess && availableTeams.length === 0 ? (
        <EmptyState
          description="No unallocated teams appear on this page. Try another search or page."
          title="No available teams"
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="project-team-allocation-select">Select a team to allocate</label>
        <ChoiceSelect
          aria-label="Select a team to allocate"
          className="flex-1"
          disabled={!enabled || teamsQuery.isPending || teamsQuery.isError || availableTeams.length === 0}
          id="project-team-allocation-select"
          onValueChange={(nextValue) => {
            const team = availableTeams.find((candidate) => candidate.uuid === nextValue);
            onSelect(team ?? null);
          }}
          value={selectedTeam?.uuid ?? ''}
        >
          <ChoiceOption value="">Choose a team</ChoiceOption>
          {selectedTeam && !selectedTeamIsOnPage && !allocatedTeamUuids.includes(selectedTeam.uuid) ? (
            <ChoiceOption value={selectedTeam.uuid}>{selectedTeam.name}</ChoiceOption>
          ) : null}
          {availableTeams.map((team) => <ChoiceOption key={team.uuid} value={team.uuid}>{team.name}</ChoiceOption>)}
        </ChoiceSelect>
      </div>
      {teamsQuery.data?.meta ? (
        <Pagination
          currentPage={teamsQuery.data.meta.current_page}
          onPageChange={setPage}
          totalPages={teamsQuery.data.meta.last_page}
        />
      ) : null}
    </div>
  );
}
