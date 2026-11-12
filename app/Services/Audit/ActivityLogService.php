<?php

namespace App\Services\Audit;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class ActivityLogService
{
    /**
     * System-wide audit timeline for actors holding the audit.view ability.
     *
     * @param  array<string, mixed>  $filters
     */
    public function systemList(array $filters): LengthAwarePaginator
    {
        $query = ActivityLog::query()->with('user:id,name');

        $this->applyFilters($query, $filters);

        return $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();
    }

    /**
     * Personal timeline strictly scoped to the authenticated user.
     *
     * The ownership scope is enforced in SQL and is never widened by global
     * authorization bypasses, so System Admins see only their own records here.
     *
     * @param  array<string, mixed>  $filters
     */
    public function ownTimeline(User $user, array $filters): LengthAwarePaginator
    {
        $query = ActivityLog::query()
            ->with('user:id,name')
            ->where('user_id', $user->id);

        $this->applyFilters($query, $filters);

        return $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();
    }

    /**
     * @param  Builder<ActivityLog>  $query
     * @param  array<string, mixed>  $filters
     * @return Builder<ActivityLog>
     */
    private function applyFilters($query, array $filters)
    {
        if (isset($filters['action'])) {
            $query->where('action', $filters['action']);
        }
        if (isset($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }
        if (isset($filters['subject_type'])) {
            $query->where('subject_type', $filters['subject_type']);
        }
        if (isset($filters['subject_id'])) {
            $query->where('subject_id', $filters['subject_id']);
        }
        if (isset($filters['from'])) {
            $query->whereDate('created_at', '>=', $filters['from']);
        }
        if (isset($filters['to'])) {
            $query->whereDate('created_at', '<=', $filters['to']);
        }

        return $query;
    }
}
