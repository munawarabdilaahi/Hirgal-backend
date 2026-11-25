<?php

namespace App\Support;

use Illuminate\Support\Facades\URL;

class AccountAvatar
{
    private const PREFIX = 'account-avatars/';

    /**
     * Resolve a stored avatar path to a short-lived signed URL.
     */
    public static function url(?string $path, int $userId): ?string
    {
        if ($path === null || $path === '' || ! str_starts_with($path, self::PREFIX.$userId.'/')) {
            return null;
        }

        $version = pathinfo($path, PATHINFO_FILENAME);

        if ($version === '') {
            return null;
        }

        return URL::temporarySignedRoute(
            'api.v1.account.avatar',
            now()->addHour(),
            ['user' => $userId, 'version' => $version]
        );
    }
}
