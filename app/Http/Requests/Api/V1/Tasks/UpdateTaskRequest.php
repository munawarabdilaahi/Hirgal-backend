<?php

namespace App\Http\Requests\Api\V1\Tasks;

use App\Models\Task;
use App\Policies\ProjectPolicy;
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

        abort_unless(ProjectPolicy::isWithinScope($actor, $task->project), 404);

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
            'status' => ['nullable', 'sometimes', 'string', 'in:backlog,todo,in_progress,in_review,done,cancelled'],
            'priority' => ['nullable', 'sometimes', 'string', 'in:urgent,high,medium,low'],
            'due_date' => ['nullable', 'sometimes', 'date'],
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
        ];
    }
}
