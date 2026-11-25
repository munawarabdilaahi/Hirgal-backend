<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class UpdateUserProfileAction
{
    /**
     * Update permitted profile fields for the authenticated user.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(User $user, array $data): User
    {
        return DB::transaction(function () use ($user, $data) {
            // Update user core permitted fields
            $userUpdates = Arr::only($data, ['name', 'timezone', 'avatar_url']);
            if (! empty($userUpdates)) {
                $user->update($userUpdates);
            }

            // Update or create profile fields
            $profileUpdates = Arr::only($data, [
                'phone',
                'job_title',
                'department',
                'bio',
                'theme_preference',
                'locale',
                'date_format',
                'time_format',
            ]);

            if (array_key_exists('notification_preferences', $data) && is_array($data['notification_preferences'])) {
                $profileUpdates['notification_preferences'] = $this->normalizeNotificationPreferences(
                    $user->profile?->notification_preferences ?? [],
                    $data['notification_preferences']
                );
            }

            if (! empty($profileUpdates)) {
                $profile = $user->profile ?: new UserProfile(['user_id' => $user->id]);
                $profile->fill($profileUpdates);
                $profile->save();
            }

            return $user->fresh(['profile', 'roles.permissions']);
        });
    }

    /**
     * Keep only supported channel keys and enforce non-optional security alerts.
     *
     * @param  array<string, mixed>  $existing
     * @param  array<string, mixed>  $incoming
     * @return array<string, mixed>
     */
    private function normalizeNotificationPreferences(array $existing, array $incoming): array
    {
        $allowed = [
            'email_notifications',
            'in_app_notifications',
            'workspace_invitations',
            'system_announcements',
            'activity_notifications',
        ];

        $preferences = $existing;

        foreach ($allowed as $key) {
            if (array_key_exists($key, $incoming)) {
                $preferences[$key] = (bool) $incoming[$key];
            }
        }

        // Legacy appointment channel keys remain supported by existing clients.
        if (array_key_exists('email', $incoming)) {
            $preferences['email'] = (bool) $incoming['email'];
        }

        if (array_key_exists('in_app', $incoming)) {
            $preferences['in_app'] = (bool) $incoming['in_app'];
        }

        $preferences['security_alerts'] = true;
        $preferences['login_alerts'] = true;

        return $preferences;
    }
}
