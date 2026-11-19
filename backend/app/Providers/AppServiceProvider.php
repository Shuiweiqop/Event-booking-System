<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Booking / cancelling: N requests per minute per IP (BOOKING_RATE_LIMIT, default 30).
        RateLimiter::for('bookings', fn (Request $request) => Limit::perMinute((int) env('BOOKING_RATE_LIMIT', 30))
            ->by($request->ip()));

        // Admin login: 5 attempts per minute per IP + email (brute-force protection).
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)
            ->by(strtolower((string) $request->input('email')).'|'.$request->ip()));
    }
}
