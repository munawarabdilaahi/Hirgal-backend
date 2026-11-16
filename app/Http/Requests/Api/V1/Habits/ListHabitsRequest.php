<?php

namespace App\Http\Requests\Api\V1\Habits;

use App\Enums\HabitFrequency;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListHabitsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('habits.manage') ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'is_archived' => ['nullable', 'boolean'],
            'frequency' => ['nullable', Rule::enum(HabitFrequency::class)],
            'search' => ['nullable', 'string', 'max:100'],
            'week_start' => ['nullable', 'date_format:Y-m-d'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
