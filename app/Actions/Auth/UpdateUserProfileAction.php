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
                'notification_preferences',
            ]);

            if (! empty($profileUpdates)) {
                $profile = $user->profile ?: new UserProfile(['user_id' => $user->id]);
                $profile->fill($profileUpdates);
                $profile->save();
            }

            return $user->fresh(['profile', 'roles.permissions']);
        });
    }
}
