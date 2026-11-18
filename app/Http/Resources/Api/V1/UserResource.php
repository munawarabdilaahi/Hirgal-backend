<?php

namespace App\Http\Resources\Api\V1;

use App\Models\User;
use App\Support\AccountAvatar;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $isOwner = $request->user()?->is($this->resource) ?? false;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'account_status' => $this->account_status?->value ?? $this->account_status,
            'avatar_url' => AccountAvatar::url($this->avatar_url, $this->id),
            'timezone' => $this->timezone ?? 'UTC',
            'email_verified_at' => $this->email_verified_at?->toIso8601String(),
            'pending_email' => $this->when($isOwner, fn (): ?string => $this->pending_email),
            'two_factor_enabled' => $this->hasTwoFactorAuthentication(),
            'recovery_codes_remaining' => $this->when(
                $isOwner,
                fn (): int => count($this->two_factor_recovery_codes ?? [])
            ),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'profile' => new UserProfileResource($this->whenLoaded('profile')),
            'roles' => RoleResource::collection($this->whenLoaded('roles')),
            'permissions' => $this->when(
                $this->relationLoaded('roles'),
                fn () => $this->allPermissions()->pluck('slug')->values()->all()
            ),
        ];
    }
}
