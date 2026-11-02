<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Project
 */
class ProjectResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'status' => $this->status?->value ?? $this->status,
            'priority' => $this->priority?->value ?? $this->priority,
            'owner' => $this->when(
                $this->resource->owner_id !== null,
                fn () => new UserDirectoryResource($this->resource->owner)
            ),
            'start_date' => $this->start_date?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'settings' => $this->settings,
            'members_count' => $this->when(
                array_key_exists('members_count', $this->resource->getAttributes()),
                fn () => (int) $this->resource->getAttributes()['members_count']
            ),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
