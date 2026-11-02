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
        return $this->user()?->can('viewAny', Task::class) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'project' => ['nullable', 'string', 'uuid'],
            'team' => ['nullable', 'string', 'uuid'],
            'assignee' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['nullable', 'string', 'in:backlog,todo,in_progress,in_review,done,cancelled'],
            'priority' => ['nullable', 'string', 'in:urgent,high,medium,low'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'sort_by' => ['nullable', 'string', 'in:title,status,priority,due_date,order_column,created_at,updated_at'],
            'sort_direction' => ['nullable', 'string', 'in:asc,desc'],
        ];
    }
}
