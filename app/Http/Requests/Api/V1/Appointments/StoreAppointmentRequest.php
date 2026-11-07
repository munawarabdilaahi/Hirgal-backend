<?php

namespace App\Http\Requests\Api\V1\Appointments;

use App\Enums\AppointmentLocationType;
use App\Services\Appointment\AppointmentTime;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator;

class StoreAppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('appointments.create') ?? false;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'project_uuid' => ['nullable', 'uuid', Rule::exists('projects', 'uuid')->whereNull('deleted_at')],
            'team_uuid' => ['nullable', 'uuid', Rule::exists('teams', 'uuid')->whereNull('deleted_at')],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'timezone' => ['required', 'string', 'max:64'],
            'start_time' => ['required', 'string', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/'],
            'end_time' => ['required', 'string', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/'],
            'location_type' => ['nullable', Rule::enum(AppointmentLocationType::class)],
            'meeting_link' => ['nullable', 'url', 'max:1024'],
            'location_address' => ['nullable', 'string', 'max:255'],
            'participants' => ['nullable', 'array', 'max:100'],
            'participants.*' => ['integer', 'distinct', 'exists:users,id'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->filled('project_uuid') && $this->filled('team_uuid')) {
                $validator->errors()->add('project_uuid', 'An appointment can have only one context.');
            }
            if ($validator->errors()->isNotEmpty() || ! $this->filled('start_time') || ! $this->filled('end_time') || ! $this->filled('timezone')) {
                return;
            }
            try {
                app(AppointmentTime::class)->parseRange($this->string('start_time')->toString(), $this->string('end_time')->toString(), $this->string('timezone')->toString());
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
