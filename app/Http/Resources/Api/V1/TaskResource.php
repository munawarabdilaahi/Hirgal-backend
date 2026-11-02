<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Task
 */
class TaskResource extends JsonResource
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
            'project' => $this->whenLoaded('project', fn () => [
                'id' => $this->project->id,
                'uuid' => $this->project->uuid,
                'name' => $this->project->name,
            ]),
            'parent' => $this->whenLoaded('parent', fn () => [
                'id' => $this->parent?->id,
                'uuid' => $this->parent?->uuid,
                'title' => $this->parent?->title,
            ]),
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status?->value ?? $this->status,
            'priority' => $this->priority?->value ?? $this->priority,
            'creator' => new UserDirectoryResource($this->whenLoaded('creator')),
            'assignees' => UserDirectoryResource::collection($this->whenLoaded('assignees')),
            'due_date' => $this->due_date?->toIso8601String(),
            'estimated_hours' => $this->estimated_hours !== null ? (float) $this->estimated_hours : null,
            'actual_hours' => $this->actual_hours !== null ? (float) $this->actual_hours : null,
            'order_column' => $this->order_column !== null ? (int) $this->order_column : null,
            'completed_at' => $this->completed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
