<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Appointment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Appointment */
class AppointmentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'organizer' => $this->whenLoaded('organizer', fn () => ['id' => $this->organizer->id, 'name' => $this->organizer->name]),
            'context' => $this->project_id !== null
                ? ['type' => 'project', 'uuid' => $this->whenLoaded('project', fn () => $this->project?->uuid)]
                : ($this->team_id !== null
                    ? ['type' => 'team', 'uuid' => $this->whenLoaded('team', fn () => $this->team?->uuid)]
                    : ['type' => 'personal', 'uuid' => null]),
            'title' => $this->title,
            'description' => $this->description,
            'timezone' => $this->timezone,
            'start_time' => $this->start_time?->utc()->format('Y-m-d\TH:i:s\Z'),
            'end_time' => $this->end_time?->utc()->format('Y-m-d\TH:i:s\Z'),
            'location_type' => $this->location_type?->value ?? $this->location_type,
            'meeting_link' => $this->meeting_link,
            'location_address' => $this->location_address,
            'status' => $this->status?->value ?? $this->status,
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'participants' => AppointmentParticipantResource::collection($this->whenLoaded('participantRecords')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
