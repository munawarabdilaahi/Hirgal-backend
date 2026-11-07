<?php

namespace App\Http\Resources\Api\V1;

use App\Models\AppointmentParticipant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin AppointmentParticipant */
class AppointmentParticipantResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'user_id' => $this->user_id,
            'name' => $this->whenLoaded('user', fn () => $this->user->name),
            'status' => $this->status?->value ?? $this->status,
            'responded_at' => $this->responded_at?->toIso8601String(),
            'notes' => $this->response_notes,
        ];
    }
}
