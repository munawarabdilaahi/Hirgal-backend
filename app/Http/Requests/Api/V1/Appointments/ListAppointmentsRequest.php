<?php

namespace App\Http\Requests\Api\V1\Appointments;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ListAppointmentsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('appointments.view') ?? false;
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return [
            'from' => ['nullable', 'string', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/', 'date'],
            'to' => ['nullable', 'string', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/', 'date', 'after:from'],
            'project_uuid' => ['nullable', 'uuid', 'exists:projects,uuid'],
            'team_uuid' => ['nullable', 'uuid', 'exists:teams,uuid'],
            'context' => ['nullable', 'in:project,team,personal'],
            'status' => ['nullable', 'in:scheduled,confirmed,completed,cancelled'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->filled('from') && $this->filled('to')) {
                if (strtotime($this->string('to')->toString()) <= strtotime($this->string('from')->toString())) {
                    $validator->errors()->add('to', 'The to parameter must be after from.');
                }
            }
            if ($this->filled('project_uuid') && $this->filled('team_uuid')) {
                $validator->errors()->add('project_uuid', 'Filter by only one appointment context at a time.');
            }
            if (($this->input('context') === 'project' && $this->filled('team_uuid'))
                || ($this->input('context') === 'team' && $this->filled('project_uuid'))
                || ($this->input('context') === 'personal' && ($this->filled('project_uuid') || $this->filled('team_uuid')))) {
                $validator->errors()->add('context', 'The context filter conflicts with the specified context identifier.');
            }
        });
    }
}
