<?php

namespace App\Http\Requests\Api\V1\Tasks;

use App\Models\Task;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ListTasksRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $canViewProjectTasks = $this->user()?->can('viewAny', Task::class) ?? false;

        return [
            'search' => ['nullable', 'string', 'max:100'],
            'project' => $canViewProjectTasks ? ['nullable', 'string', 'uuid'] : ['prohibited'],
            'team' => $canViewProjectTasks ? ['nullable', 'string', 'uuid'] : ['prohibited'],
            'assignee' => $canViewProjectTasks ? ['nullable', 'integer', 'exists:users,id'] : ['prohibited'],
            'status' => ['nullable', 'string', 'in:backlog,todo,in_progress,in_review,done,cancelled'],
            'priority' => ['nullable', 'string', 'in:urgent,high,medium,low'],
            'schedule' => ['nullable', 'string', 'in:overdue,today,tomorrow,upcoming,other'],
            'with_schedule' => ['nullable', 'boolean'],
            'with_move_permissions' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'sort_by' => ['nullable', 'string', 'in:title,status,priority,due_date,order_column,created_at,updated_at'],
            'sort_direction' => ['nullable', 'string', 'in:asc,desc'],
        ];
    }
}
