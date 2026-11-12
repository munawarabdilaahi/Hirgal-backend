<?php

namespace App\Services\Audit;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class ActivityLogger
{
    /**
     * Persist an immutable audit record for a security-relevant event.
     *
     * Forensic metadata (ip_address, user_agent) is captured here and never
     * returned by ActivityLogResource.
     *
     * @param  array<string, mixed>  $properties
     */
    public function record(
        string $action,
        Model $subject,
        ?User $actor,
        string $description,
        array $properties = []
    ): ActivityLog {
        return ActivityLog::query()->create([
            'user_id' => $actor?->id,
            'action' => $action,
            'subject_type' => $subject::class,
            'subject_id' => $subject->getKey(),
            'description' => $description,
            'properties' => $properties,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }
}
