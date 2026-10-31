<?php

namespace App\Http\Resources\Api\V1;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuthTokenResource extends JsonResource
{
    protected string $token;
    protected User $user;

    public function __construct(string $token, User $user)
    {
        parent::__construct(null);
        $this->token = $token;
        $this->user = $user;
    }

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'access_token' => $this->token,
            'token_type' => 'Bearer',
            'user' => new UserResource($this->user),
        ];
    }
}
