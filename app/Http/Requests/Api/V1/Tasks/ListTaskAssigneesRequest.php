<?php

namespace App\Http\Requests\Api\V1\Tasks;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ListTaskAssigneesRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $actor = $this->user();
        if (! $actor) {
            return false;
        }

        return $actor->hasPermission('tasks.view')
            || $actor->hasPermission('tasks.assign')
            || $actor->hasPermission('users.view_directory')
            || $actor->hasPermission('users.view');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'project' => ['nullable', 'string', 'uuid', 'exists:projects,uuid'],
            'department' => ['nullable', 'string', 'max:100'],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
