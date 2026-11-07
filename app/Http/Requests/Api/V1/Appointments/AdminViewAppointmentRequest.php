<?php

namespace App\Http\Requests\Api\V1\Appointments;

use App\Policies\AppointmentPolicy;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class AdminViewAppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && app(AppointmentPolicy::class)->canAdminView($this->user());
    }

    /** @return array<string, ValidationRule|array<mixed>|string> */
    public function rules(): array
    {
        return ['reason' => ['required', 'string', 'min:8', 'max:500']];
    }
}
