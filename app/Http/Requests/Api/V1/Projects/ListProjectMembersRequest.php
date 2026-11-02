<?php

namespace App\Http\Requests\Api\V1\Projects;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Policies\ProjectPolicy;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ListProjectMembersRequest extends FormRequest
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

        return $actor->can('viewAny', [ProjectMember::class, $project]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
