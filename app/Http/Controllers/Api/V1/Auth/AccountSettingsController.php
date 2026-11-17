<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Enums\AccountStatus;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\Audit\ActivityLogger;
use App\Support\ApiResponse;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class AccountSettingsController extends Controller
{
    public function sessions(Request $request): JsonResponse
    {
        $user = $request->user();
        $currentSession = $request->hasSession() ? $request->session()->getId() : null;
        $currentToken = $user->currentAccessToken();
        $browser = $this->browserSessions($user)?->select(['id', 'ip_address', 'user_agent', 'last_activity'])
            ->orderByDesc('last_activity')->get()->map(fn (object $row): array => [
                'id' => $this->browserReference($row->id),
                'kind' => 'browser',
                'label' => Str::limit($row->user_agent ?: 'Browser session', 200),
                'ip_address' => $row->ip_address,
                'last_active_at' => Carbon::createFromTimestamp($row->last_activity)->toIso8601String(),
                'created_at' => null,
                'current' => $row->id === $currentSession,
            ])->all() ?? [];
        $tokens = $this->activeTokens($user)->get()->map(fn (PersonalAccessToken $token): array => [
            'id' => 'token-'.$token->id,
            'kind' => 'token',
            'label' => $token->name === 'auth-token' ? 'Hirgal sign-in' : $token->name,
            'ip_address' => null,
            'last_active_at' => $token->last_used_at?->toIso8601String(),
            'created_at' => $token->created_at->toIso8601String(),
            'current' => $currentToken instanceof PersonalAccessToken && $currentToken->id === $token->id,
        ])->all();

        return ApiResponse::success(data: [
            'sessions' => array_merge($browser, $tokens),
            'tracks_browser_sessions' => config('session.driver') === 'database',
        ])->header('Cache-Control', 'no-store');
    }

    public function revoke(Request $request, ActivityLogger $audit): JsonResponse
    {
        $input = $request->validate(['target' => ['required', 'string', 'max:100']]);
        $this->confirmPassword($request);
        $user = $request->user();
        $target = $input['target'];
        $currentSession = $request->hasSession() ? $request->session()->getId() : null;
        $currentToken = $user->currentAccessToken();
        $tokens = $this->activeTokens($user);
        if ($currentToken instanceof PersonalAccessToken) {
            $tokens->where('id', '!=', $currentToken->id);
        }

        $browser = $this->browserSessions($user);
        if ($currentSession !== null) {
            $browser?->where('id', '!=', $currentSession);
        }

        if ($target === 'others') {
            abort_if($browser === null && $currentSession !== null, 409, 'This installation cannot revoke other browser sessions.');
            $tokens->delete();
            $browser?->delete();
            $user->setRememberToken(Str::random(60));
            $user->save();
        } elseif (preg_match('/^token-(\d+)$/D', $target, $matches)) {
            abort_unless($tokens->whereKey($matches[1])->delete(), 404);
        } else {
            $match = $browser?->get(['id'])->first(fn (object $row): bool => hash_equals($this->browserReference($row->id), $target));
            abort_if($match === null, 404);
            $browser->where('id', $match->id)->delete();
            $user->setRememberToken(Str::random(60));
            $user->save();
        }

        $audit->record('account.sessions_revoked', $user, $user, 'Signed out other sessions.', ['scope' => $target === 'others' ? 'others' : 'individual']);

        return ApiResponse::success(message: 'Session access revoked.');
    }

    public function securityActivity(Request $request): JsonResponse
    {
        $user = $request->user();
        $events = ActivityLog::query()->where('subject_type', User::class)->where('subject_id', $user->id)
            ->where('action', 'like', 'account.%')->latest('id')->limit(20)->get()
            ->map(fn (ActivityLog $entry): array => [
                'id' => $entry->id,
                'description' => $entry->description,
                'created_at' => $entry->created_at->toIso8601String(),
            ]);

        return ApiResponse::success(data: $events)->header('Cache-Control', 'no-store');
    }

    public function export(Request $request, ActivityLogger $audit): JsonResponse
    {
        $this->confirmPassword($request);
        $user = $request->user()->load('profile');
        $audit->record('account.data_exported', $user, $user, 'Downloaded personal account data.');

        return ApiResponse::success(data: [
            'identity' => $user->only(['name', 'email', 'timezone', 'email_verified_at', 'created_at', 'last_login_at']),
            'profile' => $user->profile?->only(['phone', 'job_title', 'department', 'bio', 'theme_preference', 'notification_preferences']),
        ])->header('Cache-Control', 'no-store');
    }

    public function uploadAvatar(Request $request): JsonResponse
    {
        $request->validate(['avatar' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120', 'dimensions:min_width=64,min_height=64,max_width=2048,max_height=2048']]);
        abort_unless(function_exists('imagecreatefromstring'), 503, 'Image processing is unavailable.');
        $image = @imagecreatefromstring($request->file('avatar')->get());
        if ($image === false) {
            throw ValidationException::withMessages(['avatar' => ['Choose a valid JPEG, PNG, or WebP image.']]);
        }
        $size = min(imagesx($image), imagesy($image));
        $square = imagecrop($image, ['x' => intdiv(imagesx($image) - $size, 2), 'y' => intdiv(imagesy($image) - $size, 2), 'width' => $size, 'height' => $size]);
        abort_if($square === false, 422, 'Could not crop this image.');
        $avatar = imagescale($square, min($size, 512));
        abort_if($avatar === false, 422, 'Could not resize this image.');

        ob_start();
        try {
            $written = imagepng($avatar);
            $contents = ob_get_contents();
        } finally {
            ob_end_clean();
        }

        $user = $request->user();
        $path = 'account-avatars/'.$user->id.'/'.Str::uuid().'.png';
        abort_unless($written && is_string($contents) && Storage::disk('local')->put($path, $contents), 500, 'Could not store this image.');
        try {
            $this->replaceAvatar($user, $path);
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($path);

            throw $exception;
        }

        return $this->profileResponse($request);
    }

    public function removeAvatar(Request $request): JsonResponse
    {
        $this->replaceAvatar($request->user(), null);

        return $this->profileResponse($request);
    }

    public function avatar(User $user, string $version): Response
    {
        $path = 'account-avatars/'.$user->id.'/'.$version.'.png';
        abort_unless($user->account_status === AccountStatus::Active && $user->avatar_url === $path && Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, headers: [
            'Content-Type' => 'image/png',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function replaceAvatar(User $user, ?string $path): void
    {
        $old = DB::transaction(function () use ($user, $path): ?string {
            $lockedUser = User::query()->lockForUpdate()->findOrFail($user->id);
            $old = $lockedUser->avatar_url;
            $lockedUser->update(['avatar_url' => $path]);

            return $old;
        });
        if (is_string($old) && str_starts_with($old, 'account-avatars/'.$user->id.'/')) {
            Storage::disk('local')->delete($old);
        }
    }

    private function profileResponse(Request $request): JsonResponse
    {
        return ApiResponse::success(data: new \App\Http\Resources\Api\V1\UserResource($request->user()->fresh(['profile', 'roles.permissions'])));
    }

    private function browserSessions(User $user): ?Builder
    {
        if (config('session.driver') !== 'database') {
            return null;
        }

        return DB::connection(config('session.connection'))->table(config('session.table'))
            ->where('user_id', $user->id)->where('last_activity', '>=', now()->subMinutes(config('session.lifetime'))->timestamp);
    }

    private function activeTokens(User $user): \Illuminate\Database\Eloquent\Relations\MorphMany
    {
        $tokens = $user->tokens();
        $tokens->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()));
        if ($expiration = config('sanctum.expiration')) {
            $tokens->where('created_at', '>=', now()->subMinutes($expiration));
        }

        return $tokens;
    }

    private function browserReference(string $id): string
    {
        return 'browser-'.hash_hmac('sha256', 'account-session:'.$id, config('app.key'));
    }

    private function confirmPassword(Request $request): void
    {
        $credentials = $request->validate(['current_password' => ['required', 'string', 'max:1024']]);
        if (! Hash::check($credentials['current_password'], $request->user()->getAuthPassword())) {
            throw ValidationException::withMessages(['current_password' => ['The current password is incorrect.']]);
        }
    }
}
