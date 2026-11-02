<?php

namespace App\Http\Requests\Api\V1\User;

use App\Enums\UserRole;
use App\Models\Role;
use App\Models\UserInvitation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class CreateInvitationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $actor = $this->user();
        if (! $actor || ! $actor->can('create', UserInvitation::class)) {
            return false;
        }

        // SEC-02: Only System Administrators may dispatch invitations for the System Admin role
        $roleId = $this->input('role_id');
        if ($roleId) {
            $role = Role::find($roleId);
            if ($role && $role->slug === UserRole::SystemAdmin->value && ! $actor->isSystemAdmin()) {
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
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'role_id' => ['required', 'integer', 'exists:roles,id'],
        ];
    }
}
