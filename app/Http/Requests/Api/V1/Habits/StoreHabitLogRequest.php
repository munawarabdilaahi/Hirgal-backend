<?php

namespace App\Http\Requests\Api\V1\Habits;

use App\Enums\HabitLogStatus;
use App\Models\Habit;
use Carbon\Carbon;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreHabitLogRequest extends FormRequest
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
            'logged_date' => ['required', 'date_format:Y-m-d'],
            'status' => ['required', Rule::enum(HabitLogStatus::class)],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Configure additional validation after base rules.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty() || ! $this->filled('logged_date')) {
                return;
            }

            $user = $this->user();
            $tz = $user?->timezone ?: 'UTC';
            $today = Carbon::now($tz)->startOfDay();
            $date = Carbon::parse($this->string('logged_date')->toString(), $tz)->startOfDay();

            if ($date->greaterThan($today)) {
                $validator->errors()->add('logged_date', 'Cannot record habit check-in for a future date.');
            }

            $minAllowed = $today->copy()->subDays(30);
            if ($date->lessThan($minAllowed)) {
                $validator->errors()->add('logged_date', 'Cannot record habit check-in older than 30 days.');
            }

            // Canonical history start: reject logs dated before the habit was
            // created. The habit lookup is owner-scoped so a foreign UUID
            // yields no error here and still resolves to 404 in the controller.
            $habit = Habit::query()
                ->where('uuid', $this->route('uuid'))
                ->where('user_id', $user?->id)
                ->first();

            if ($habit !== null) {
                $historyStart = Carbon::parse($habit->created_at)->setTimezone($tz)->startOfDay();
                if ($date->lessThan($historyStart)) {
                    $validator->errors()->add('logged_date', 'Cannot record habit check-in before the habit was created.');
                }
            }
        });
    }
}
