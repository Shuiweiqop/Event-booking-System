<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\RegistrationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public API  (prefix: /api)
|--------------------------------------------------------------------------
*/
Route::get('/events', [EventController::class, 'index']);
Route::get('/events/{id}', [EventController::class, 'show'])->whereNumber('id');

Route::middleware('throttle:bookings')->group(function () {
    Route::post('/registrations', [RegistrationController::class, 'store']);            // step 1: email a code
    Route::post('/registrations/verify', [RegistrationController::class, 'verify']);    // step 2: confirm
    Route::post('/registrations/verifications/{id}/resend', [RegistrationController::class, 'resend'])->whereUuid('id');
    Route::get('/registrations/{id}', [RegistrationController::class, 'show'])->whereNumber('id');   // needs X-Cancel-Token
    Route::post('/registrations/{id}/cancel', [RegistrationController::class, 'cancel'])->whereNumber('id');
});

/*
|--------------------------------------------------------------------------
| Admin API  (Sanctum bearer token + is_admin)
|--------------------------------------------------------------------------
*/
Route::prefix('admin')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

    Route::middleware(['auth:sanctum', 'admin'])->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);

        Route::post('/events', [EventController::class, 'store']);
        Route::delete('/events/{id}', [EventController::class, 'destroy'])->whereNumber('id');
        Route::get('/events/{id}/registrations', [RegistrationController::class, 'indexForEvent'])->whereNumber('id');
    });
});
