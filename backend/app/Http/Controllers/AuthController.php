<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Admin authentication using Laravel Sanctum personal access tokens.
 * Client sends:  Authorization: Bearer <token>
 */
class AuthController extends Controller
{
    use RespondsWithJson;

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', strtolower(trim($credentials['email'])))->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password) || ! $user->is_admin) {
            return response()->json(['success' => false, 'message' => 'Invalid email or password.'], 401);
        }

        $token = $user->createToken('admin', ['admin'], now()->addHours(8))->plainTextToken;

        return $this->ok('Logged in.', [
            'token' => $token,
            'token_type' => 'Bearer',
            'expires_in' => 8 * 3600,
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return $this->ok('Authenticated.', ['id' => $user->id, 'name' => $user->name, 'email' => $user->email]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return $this->ok('Logged out.');
    }
}
