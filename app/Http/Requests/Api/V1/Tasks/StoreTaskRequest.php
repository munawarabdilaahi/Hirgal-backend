<?php

namespace App\Http\Requests\Api\V1\Tasks;

use App\Models\Project;
use App\Models\Task;
use App\Policies\ProjectPolicy;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
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

        return $actor->can('create', [Task::class, $project]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $project = $this->route('project');
        $projectId = $project instanceof Project ? $project->id : 0;

        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'status' => ['nullable', 'string', 'in:backlog,todo,in_progress,in_review,done,cancelled'],
            'priority' => ['nullable', 'string', 'in:urgent,high,medium,low'],
            'due_date' => ['nullable', 'date'],
            'estimated_hours' => ['nullable', 'numeric', 'min:0'],
            'order_column' => ['nullable', 'integer', 'min:0'],
            'parent' => ['nullable', 'string', 'uuid', Rule::exists('tasks', 'uuid')->where('project_id', $projectId)],
            'assignees' => ['nullable', 'array'],
            'assignees.*' => [
                'integer',
                Rule::exists('project_members', 'user_id')->where('project_id', $projectId),
            ],
        ];
    }
}
