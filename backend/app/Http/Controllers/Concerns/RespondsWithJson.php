<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\JsonResponse;

/** Every API response uses the same envelope: { success, message, data? }. */
trait RespondsWithJson
{
    protected function ok(string $message, mixed $data = null, int $status = 200): JsonResponse
    {
        $body = ['success' => true, 'message' => $message];
        if ($data !== null) {
            $body['data'] = $data;
        }

        return response()->json($body, $status);
    }
}
