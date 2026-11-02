<?php

namespace App\Http\Requests\Api\V1\Tasks;

use App\Models\Project;
use App\Models\Task;
use App\Models\TaskAssignment;
use App\Policies\ProjectPolicy;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTaskAssignmentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * Cross-scope access resolves as 404 before any ability check.
     */
    public function authorize(): bool
    {
        $actor = $this->user();
        $task = $this->route('task');

        if (! $actor || ! $task instanceof Task) {
            return false;
        }

        $project = $task->project;

        if (! $project instanceof Project) {
            return false;
        }

        abort_unless(ProjectPolicy::isWithinScope($actor, $project), 404);

        return $actor->can('create', [TaskAssignment::class, $task]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $task = $this->route('task');
        $projectId = $task instanceof Task ? (int) $task->project_id : 0;

        return [
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => [
                'integer',
                Rule::exists('project_members', 'user_id')->where('project_id', $projectId),
            ],
        ];
    }
}
