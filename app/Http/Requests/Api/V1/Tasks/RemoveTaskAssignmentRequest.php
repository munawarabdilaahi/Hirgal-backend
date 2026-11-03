<?php

namespace App\Http\Requests\Api\V1\Tasks;

use App\Models\Task;
use App\Policies\ProjectPolicy;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class RemoveTaskAssignmentRequest extends FormRequest
{
    /**
     * Merge the route-bound assignee identifier into the validation data.
     */
    protected function prepareForValidation(): void
    {
        $user = $this->route('user');

        if (is_string($user) || is_int($user)) {
            $this->merge(['user' => $user]);
        }
    }

    /**
     * Determine if the user is authorized to make this request.
     *
     * Cross-scope access — including tasks of soft-deleted projects — resolves
     * as 404 before validation. Ability checks stay on the assignment lookup.
     */
    public function authorize(): bool
    {
        $actor = $this->user();
        $task = $this->route('task');

        if (! $actor || ! $task instanceof Task) {
            return false;
        }

        abort_unless(ProjectPolicy::isWithinScope($actor, $task->project), 404);

        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'user' => ['required', 'integer'],
        ];
    }
}
