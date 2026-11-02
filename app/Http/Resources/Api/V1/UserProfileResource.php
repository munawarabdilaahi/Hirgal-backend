<?php

namespace App\Http\Resources\Api\V1;

use App\Models\UserProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin UserProfile
 */
class UserProfileResource extends JsonResource
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
            'phone' => $this->phone,
            'job_title' => $this->job_title,
            'department' => $this->department,
            'bio' => $this->bio,
            'notification_preferences' => $this->notification_preferences ?? [],
            'theme_preference' => $this->theme_preference ?? 'system',
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
