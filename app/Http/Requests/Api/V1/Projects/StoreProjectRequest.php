<?php

namespace App\Http\Requests\Api\V1\Projects;

use App\Models\Project;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreProjectRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('create', Project::class) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['nullable', 'string', 'in:planning,active,paused,completed'],
            'priority' => ['nullable', 'string', 'in:urgent,high,medium,low'],
            'start_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'settings' => ['nullable', 'array'],
        ];
    }
}
