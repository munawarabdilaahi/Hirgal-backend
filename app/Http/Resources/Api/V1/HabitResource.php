<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Habit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Habit
 */
class HabitResource extends JsonResource
{
    /**
     * Additional metrics injected on the resource.
     *
     * @var array<string, mixed>
     */
    protected array $stats = [];

    public function withStats(array $stats): self
    {
        $this->stats = $stats;

        return $this;
    }

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'title' => $this->title,
            'description' => $this->description,
            'frequency' => $this->frequency?->value ?? $this->frequency,
            'target_days' => $this->target_days,
            'color' => $this->color,
            'is_archived' => (bool) $this->is_archived,
            'current_streak' => $this->stats['current_streak'] ?? null,
            'longest_streak' => $this->stats['longest_streak'] ?? null,
            'stats' => ! empty($this->stats) ? $this->stats : null,
            'latest_logs' => HabitLogResource::collection($this->whenLoaded('logs')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
