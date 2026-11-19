<?php

return [

    /*
    | Email verification (one-time code) before a booking is confirmed.
    | Prevents someone from booking with — and blocking the dates of — another
    | person's email address.
    */
    'verification' => [
        'code_length' => 6,
        'ttl_minutes' => (int) env('BOOKING_CODE_TTL_MINUTES', 10),
        'max_attempts' => 5,
        'resend_cooldown_seconds' => 60,

        // LOCAL DEMO ONLY: include the code in the API response (as `debug_code`) so the
        // flow can be tested without a mailbox. Must be false in production.
        'expose_code' => (bool) env('BOOKING_EXPOSE_CODE', false),
    ],

];
