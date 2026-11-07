<?php

namespace App\Http\Requests\Api\V1\Appointments;

use App\Enums\AppointmentLocationType;
use App\Services\Appointment\AppointmentTime;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator;

class UpdateAppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('appointments.update') ?? false;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'timezone' => ['sometimes', 'required', 'string', 'max:64'],
            'start_time' => ['sometimes', 'required', 'string', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/'],
            'end_time' => ['sometimes', 'required', 'string', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/'],
            'location_type' => ['sometimes', Rule::enum(AppointmentLocationType::class)],
            'meeting_link' => ['sometimes', 'nullable', 'url', 'max:1024'],
            'location_address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'in:scheduled,confirmed,completed'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->has('start_time') xor $this->has('end_time')) {
                $validator->errors()->add('start_time', 'Both start_time and end_time are required when rescheduling.');
            }
            if (! $this->has('start_time') || ! $this->has('end_time') || $validator->errors()->isNotEmpty()) {
                return;
            }
            try {
                app(AppointmentTime::class)->parseRange($this->string('start_time')->toString(), $this->string('end_time')->toString(), $this->input('timezone', $this->route('appointment')->timezone));
            } catch (ValidationException $exception) {
                foreach ($exception->errors() as $field => $messages) {
                    foreach ($messages as $message) {
                        $validator->errors()->add($field, $message);
                    }
                }
            }
        });
    }
}
