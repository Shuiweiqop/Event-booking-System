<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * A business-rule violation during booking/cancellation.
 * Rendered as { "success": false, "message": "..." } with the given HTTP status.
 */
class BookingException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 409)
    {
        parent::__construct($message);
    }
}
