<?php

namespace App\Http\Requests\Api\V1\User;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $actor = $this->user();
        $targetUser = $this->route('id') ?? $this->route('user');

        if (! $targetUser instanceof User) {
            $targetUser = User::find($targetUser);
        }

        if (! $actor || ! $targetUser || ! $actor->can('update', $targetUser)) {
            return false;
        }

        // SEC-01: Ordinary users and administrators cannot modify their own system role or account status
        if ($actor->id === $targetUser->id) {
            if ($this->has('role_id') || $this->has('account_status')) {
                return false;
            }
        }

        // SEC-01: Only System Administrators may modify global roles or account statuses of any user
        if ($this->has('role_id') || $this->has('account_status')) {
            if (! $actor->isSystemAdmin()) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $param = $this->route('id') ?? $this->route('user');
        $targetUserId = $param instanceof User ? $param->id : $param;

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($targetUserId)],
            'role_id' => ['sometimes', 'integer', 'exists:roles,id'],
            'account_status' => ['sometimes', 'string', 'in:active,suspended,pending'],
            'timezone' => ['nullable', 'string', 'timezone'],
        ];
    }
}
