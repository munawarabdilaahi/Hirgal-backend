<?php

namespace App\Http\Requests\Api\V1\Auth;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
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
            'name' => ['sometimes', 'string', 'max:255'],
            'timezone' => ['nullable', 'string', 'timezone'],
            'avatar_url' => ['nullable', 'string', 'url', 'max:1024'],
            'phone' => ['nullable', 'string', 'max:30'],
            'job_title' => ['nullable', 'string', 'max:100'],
            'department' => ['nullable', 'string', 'max:100'],
            'bio' => ['nullable', 'string', 'max:1000'],
            'theme_preference' => ['nullable', 'string', 'in:light,dark,system'],
            'locale' => ['nullable', 'string', 'in:en'],
            'date_format' => ['nullable', 'string', 'in:Y-m-d,d/m/Y,m/d/Y'],
            'time_format' => ['nullable', 'string', 'in:12h,24h'],
            'notification_preferences' => ['nullable', 'array'],
            'notification_preferences.email_notifications' => ['nullable', 'boolean'],
            'notification_preferences.in_app_notifications' => ['nullable', 'boolean'],
            'notification_preferences.security_alerts' => ['nullable', 'boolean'],
            'notification_preferences.login_alerts' => ['nullable', 'boolean'],
            'notification_preferences.workspace_invitations' => ['nullable', 'boolean'],
            'notification_preferences.system_announcements' => ['nullable', 'boolean'],
            'notification_preferences.activity_notifications' => ['nullable', 'boolean'],
            'notification_preferences.email' => ['nullable', 'boolean'],
            'notification_preferences.in_app' => ['nullable', 'boolean'],
        ];
    }
}
