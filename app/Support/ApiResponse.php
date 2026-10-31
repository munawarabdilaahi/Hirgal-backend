<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class ApiResponse
{
    /**
     * Return a standardized success JSON response.
     *
     * @param  mixed  $data
     * @param  string  $message
     * @param  int  $status
     * @param  array<string, mixed>  $meta
     * @return JsonResponse
     */
    public static function success(
        mixed $data = null,
        string $message = 'Success',
        int $status = Response::HTTP_OK,
        array $meta = []
    ): JsonResponse {
        $payload = [
            'success' => true,
            'message' => $message,
            'data' => $data,
        ];

        if (! empty($meta)) {
            $payload['meta'] = $meta;
        }

        return response()->json($payload, $status);
    }

    /**
     * Return a standardized error JSON response.
     *
     * @param  string  $message
     * @param  int  $status
     * @param  mixed  $errors
     * @param  string|null  $errorCode
     * @return JsonResponse
     */
    public static function error(
        string $message = 'An error occurred',
        int $status = Response::HTTP_BAD_REQUEST,
        mixed $errors = null,
        ?string $errorCode = null
    ): JsonResponse {
        $payload = [
            'success' => false,
            'message' => $message,
            'errors' => $errors,
        ];

        if ($errorCode !== null) {
            $payload['error_code'] = $errorCode;
        }

        return response()->json($payload, $status);
    }
}
