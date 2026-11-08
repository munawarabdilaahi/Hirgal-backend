<?php

namespace App\Http\Requests\Api\V1\Habits;

use App\Enums\HabitFrequency;
use App\Models\Habit;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateHabitRequest extends FormRequest
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
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'frequency' => ['sometimes', 'required', Rule::enum(HabitFrequency::class)],
            'target_days' => ['sometimes', 'nullable', 'array', 'max:7', 'required_if:frequency,custom'],
            'target_days.*' => ['string', 'distinct', 'in:mon,tue,wed,thu,fri,sat,sun'],
            'color' => ['sometimes', 'nullable', 'string', 'regex:/^#[a-fA-F0-9]{6}$/'],
        ];
    }

    /**
     * Configure additional validation after base rules.
     *
     * Enforces the post-update invariant that a custom weekday habit always
     * retains at least one target weekday, even when the payload omits or
     * explicitly clears target_days.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $inputs = $this->all();
            $hasTargetDays = array_key_exists('target_days', $inputs);
            $frequency = $this->input('frequency');
            $habit = null;

            if ($frequency === null || ! $hasTargetDays) {
                $habit = Habit::query()
                    ->where('uuid', $this->route('uuid'))
                    ->where('user_id', $this->user()?->id)
                    ->first();
                $frequency ??= $habit?->frequency?->value;
            }

            if ($frequency !== HabitFrequency::Custom->value) {
                return;
            }

            $targetDays = $hasTargetDays ? $this->input('target_days') : $habit?->target_days;

            if (empty($targetDays)) {
                $validator->errors()->add('target_days', 'Custom habits require at least one target weekday.');
            }
        });
    }
}
