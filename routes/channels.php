<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function (User $user, $id): bool {
    return (int) $user->id === (int) $id;
}, ['guards' => ['sanctum', 'web']]);

Broadcast::channel('users.{id}', function (User $user, $id): bool {
    return (int) $user->id === (int) $id;
}, ['guards' => ['sanctum', 'web']]);
