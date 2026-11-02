<?php

namespace App\Http\Requests\Api\V1\Projects;

use App\Models\Project;
use App\Policies\ProjectPolicy;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateProjectRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * Cross-scope access resolves as 404 before any ability check.
     */
    public function authorize(): bool
    {
        $actor = $this->user();
        $project = $this->route('project');

        if (! $actor || ! $project instanceof Project) {
            return false;
        }

        abort_unless(ProjectPolicy::isWithinScope($actor, $project), 404);

        return $actor->can('update', $project);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'sometimes', 'string', 'max:5000'],
            'status' => ['nullable', 'sometimes', 'string', 'in:planning,active,paused,completed'],
            'priority' => ['nullable', 'sometimes', 'string', 'in:urgent,high,medium,low'],
            'start_date' => ['nullable', 'sometimes', 'date'],
            'due_date' => ['nullable', 'sometimes', 'date'],
            'settings' => ['nullable', 'sometimes', 'array'],
        ];
    }
}
