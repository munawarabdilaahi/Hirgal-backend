<?php

namespace App\Http\Requests\Api\V1\Activity;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ListMyActivityRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * Identity always comes from the authenticated session; ownership scoping
     * is additionally enforced in SQL by ActivityLogService::ownTimeline().
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
        return [
            'action' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
