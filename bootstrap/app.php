<?php

use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\ForceJsonResponse;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prependToGroup('api', [
            ForceJsonResponse::class,
        ]);

        // D6: global API rate limit (60/min) applied once to every route in
        // the "api" group. Endpoint-specific throttles remain layered on top.
        $middleware->throttleApi('api');

        $middleware->alias([
            'account.active' => EnsureAccountIsActive::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    message: 'Validation failed',
                    status: 422,
                    errors: $e->errors(),
                    errorCode: 'VALIDATION_ERROR'
                );
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    message: 'Unauthenticated. Access token is missing or invalid.',
                    status: 401,
                    errorCode: 'UNAUTHENTICATED'
                );
            }
        });

        $exceptions->render(function (AuthorizationException|AccessDeniedHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    message: $e->getMessage() ?: 'Forbidden: You do not have permission to perform this action.',
                    status: 403,
                    errorCode: 'FORBIDDEN'
                );
            }
        });

        $exceptions->render(function (ModelNotFoundException|NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    message: 'Requested resource not found.',
                    status: 404,
                    errorCode: 'RESOURCE_NOT_FOUND'
                );
            }
        });

        $exceptions->render(function (MethodNotAllowedHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    message: 'HTTP method not allowed for this route.',
                    status: 405,
                    errorCode: 'METHOD_NOT_ALLOWED'
                );
            }
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiResponse::error(
                    message: 'Rate limit exceeded. Please slow down your requests.',
                    status: 429,
                    errorCode: 'RATE_LIMIT_EXCEEDED'
                )->withHeaders($e->getHeaders());
            }
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $isDebug = config('app.debug');

                return ApiResponse::error(
                    message: $isDebug ? $e->getMessage() : 'An unexpected internal server error occurred.',
                    status: 500,
                    errors: $isDebug ? [
                        'exception' => get_class($e),
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                    ] : null,
                    errorCode: 'INTERNAL_SERVER_ERROR'
                );
            }
        });
    })->create();
