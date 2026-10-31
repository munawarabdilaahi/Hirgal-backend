<?php

namespace App\Actions\Auth;

use App\Enums\AccountStatus;
use App\Enums\InvitationStatus;
use App\Models\User;
use App\Models\UserInvitation;
use App\Models\UserProfile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AcceptInvitationAction
{
    /**
     * Accept an invitation, create the user, assign role, and issue access token.
     *
     * @param  string  $rawToken
     * @param  array<string, mixed>  $data
     * @return array{user: User, token: string}
     *
     * @throws ValidationException
     */
    public function execute(string $rawToken, array $data): array
    {
        $tokenHash = hash('sha256', $rawToken);

        $invitation = UserInvitation::with('role')
            ->where('token_hash', $tokenHash)
            ->first();

        if (! $invitation) {
            throw ValidationException::withMessages([
                'token' => ['Invalid invitation token.'],
            ]);
        }

        if ($invitation->status !== InvitationStatus::Pending) {
            throw ValidationException::withMessages([
                'token' => ["This invitation has already been {$invitation->status->value}."],
            ]);
        }

        if ($invitation->expires_at->isPast()) {
            $invitation->update(['status' => InvitationStatus::Expired]);

            throw ValidationException::withMessages([
                'token' => ['This invitation has expired. Please request a new invitation.'],
            ]);
        }

        // Verify that no account with this email already exists
        if (User::where('email', $invitation->email)->exists()) {
            throw ValidationException::withMessages([
                'email' => ['An account with this email address already exists.'],
            ]);
        }

        return DB::transaction(function () use ($invitation, $data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $invitation->email,
                'password' => Hash::make($data['password']),
                'account_status' => AccountStatus::Active,
                'timezone' => $data['timezone'] ?? 'UTC',
                'email_verified_at' => now(),
            ]);

            // Assign the designated role safely
            $user->roles()->attach($invitation->role_id);

            // Create initial user profile
            UserProfile::create([
                'user_id' => $user->id,
            ]);

            // Mark invitation accepted
            $invitation->update([
                'status' => InvitationStatus::Accepted,
                'accepted_at' => now(),
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
