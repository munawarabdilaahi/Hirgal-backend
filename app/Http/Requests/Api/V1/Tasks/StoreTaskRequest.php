<?php

namespace App\Http\Requests\Api\V1\Tasks;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Policies\ProjectPolicy;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

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
            'description_is_rich_text' => ['sometimes', 'boolean'],
            'context' => ['sometimes', 'in:project,department,other'],
            'department' => ['required_if:context,department', 'prohibited_unless:context,department', 'nullable', 'string', 'max:100'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'remind_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:'.now($this->user()?->timezone ?? 'UTC')->toDateString()],
            'tags' => ['nullable', 'array', 'list', 'max:20'],
            'tags.*' => ['required', 'string', 'max:40', 'distinct:ignore_case'],
            'status' => ['nullable', 'string', 'in:backlog,todo,in_progress,in_review,done,cancelled'],
            'priority' => ['nullable', 'string', 'in:urgent,high,medium,low'],
            'due_date' => ['nullable', 'date', Rule::when($this->filled('start_date'), ['after_or_equal:start_date'])],
            'estimated_hours' => ['nullable', 'numeric', 'min:0'],
            'order_column' => ['nullable', 'integer', 'min:0'],
            'parent' => ['nullable', 'string', 'uuid', Rule::exists('tasks', 'uuid')->where('project_id', $projectId)],
            'assignees' => ['nullable', 'array'],
            'assignees.*' => [
                'integer',
                Rule::exists('project_members', 'user_id')->where('project_id', $projectId),
            ],
            'followers' => ['nullable', 'array', 'list', 'max:100'],
            'followers.*' => ['integer', 'distinct', Rule::exists('project_members', 'user_id')->where('project_id', $projectId)],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty() || $this->input('context') !== 'department') {
                return;
            }

            $roster = ProjectMember::query()->where('project_id', $this->route('project')->id)
                ->whereHas('user.profile', fn ($query) => $query->where('department', $this->input('department')));

            if (! $roster->exists()) {
                $validator->errors()->add('department', 'Choose a department represented on the project.');

                return;
            }

            $assignees = collect($this->input('assignees', []))->unique();
            if ($roster->whereIn('user_id', $assignees)->count() !== $assignees->count()) {
                $validator->errors()->add('assignees', 'Assignees must belong to the selected department.');
            }
        }];
    }
}
