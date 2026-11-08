<?php

namespace App\Http\Requests\Api\V1\Habits;

use App\Enums\HabitFrequency;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreHabitRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'frequency' => ['required', Rule::enum(HabitFrequency::class)],
            'target_days' => ['nullable', 'array', 'max:7', 'required_if:frequency,custom'],
            'target_days.*' => ['string', 'distinct', 'in:mon,tue,wed,thu,fri,sat,sun'],
            'color' => ['nullable', 'string', 'regex:/^#[a-fA-F0-9]{6}$/'],
        ];
    }
}
