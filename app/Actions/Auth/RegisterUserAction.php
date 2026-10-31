<?php

namespace App\Actions\Auth;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class RegisterUserAction
{
    /**
     * Register a new user when public registration is enabled.
     *
     * @param  array<string, mixed>  $data
     * @return array{user: User, token: string}
     *
     * @throws AuthorizationException
     */
    public function execute(array $data): array
    {
        if (! config('auth.allow_registration', false)) {
            throw new AuthorizationException('Public registration is currently disabled. Registration is by invitation only.');
        }

        return DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'account_status' => AccountStatus::Active,
                'timezone' => $data['timezone'] ?? 'UTC',
            ]);

            // Assign standard Member role
            $memberRole = Role::where('slug', UserRole::Member->value)->first();
            if ($memberRole) {
                $user->roles()->attach($memberRole->id);
            }

            // Create initial profile
            UserProfile::create([
                'user_id' => $user->id,
            ]);

            $deviceName = $data['device_name'] ?? 'auth-token';
            $token = $user->createToken($deviceName)->plainTextToken;

            return [
                'user' => $user->load(['roles.permissions', 'profile']),
                'token' => $token,
            ];
        });
    }
}
