<?php

namespace App\Http\Requests\Api\V1\Tasks;

use App\Models\Task;
use App\Policies\TaskPolicy;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTaskRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * Cross-scope access — including tasks of soft-deleted projects — resolves
     * as 404 before any ability check.
     */
    public function authorize(): bool
    {
        $actor = $this->user();
        $task = $this->route('task');

        if (! $actor || ! $task instanceof Task) {
            return false;
        }

        abort_unless(TaskPolicy::isWithinScope($actor, $task), 404);

        return $actor->can('update', $task);
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
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'sometimes', 'string', 'max:10000'],
            'description_is_rich_text' => ['sometimes', 'boolean'],
            'status' => ['nullable', 'sometimes', 'string', 'in:backlog,todo,in_progress,in_review,done,cancelled'],
            'priority' => ['nullable', 'sometimes', 'string', 'in:urgent,high,medium,low'],
            'due_date' => ['nullable', 'sometimes', 'date', Rule::when($task?->start_date !== null, ['after_or_equal:'.$task?->start_date?->toDateString()])],
            'estimated_hours' => ['nullable', 'sometimes', 'numeric', 'min:0'],
            'actual_hours' => ['nullable', 'sometimes', 'numeric', 'min:0'],
            'order_column' => ['nullable', 'sometimes', 'integer', 'min:0'],
            'parent' => [
                'nullable',
                'sometimes',
                'string',
                'uuid',
                Rule::exists('tasks', 'uuid')
                    ->where('project_id', $projectId)
                    ->whereNull('deleted_at'),
            ],
            'followers' => ['nullable', 'sometimes', 'array', 'list', 'max:100', Rule::prohibitedIf($task?->project_id === null)],
            'followers.*' => [
                'integer',
                'distinct',
                Rule::exists('project_members', 'user_id')->where('project_id', $projectId),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'followers.*.exists' => 'The selected follower is not a member of this project.',
            'followers.*.distinct' => 'Each follower can only be added once.',
        ];
    }
}
