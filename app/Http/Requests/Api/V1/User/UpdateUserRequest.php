<?php

namespace App\Http\Requests\Api\V1\User;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $targetUser = $this->route('user');

        if (! $targetUser instanceof User) {
            $targetUser = User::find($targetUser);
        }

        return $targetUser ? $this->user()->can('update', $targetUser) : false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $targetUserId = $this->route('user') instanceof User
            ? $this->route('user')->id
            : $this->route('user');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($targetUserId)],
            'role_id' => ['sometimes', 'integer', 'exists:roles,id'],
            'account_status' => ['sometimes', 'string', 'in:active,suspended,pending'],
            'timezone' => ['nullable', 'string', 'timezone'],
        ];
    }
}
