<?php

namespace App\Http\Resources\Api\V1;

use App\Notifications\AppointmentNotification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Notifications\DatabaseNotification;

/**
 * @mixin DatabaseNotification
 */
class NotificationResource extends JsonResource
{
    /**
     * Approved payload keys per known notification type. Unknown types
     * serialize an empty data object (fail-closed), so a future type that
     * carries sensitive fields cannot leak them through this endpoint.
     *
     * @var array<string, array<int, string>>
     */
    private const TYPE_DATA_ALLOWLIST = [
        AppointmentNotification::class => [
            'event',
            'appointment_uuid',
            'title',
            'start_time',
            'end_time',
            'timezone',
            'organizer_name',
            'context',
        ],
    ];

    /**
     * Transform the notification into an array.
     *
     * Internal columns (notifiable_type, notifiable_id, updated_at) are
     * intentionally never exposed.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'data' => $this->sanitizedData(),
            'read_at' => $this->read_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function sanitizedData(): array
    {
        $allowlist = self::TYPE_DATA_ALLOWLIST[$this->type] ?? null;

        if ($allowlist === null) {
            return [];
        }

        return array_intersect_key($this->data ?? [], array_flip($allowlist));
    }
}
