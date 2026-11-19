<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Registration extends Model
{
    public const STATUS_CONFIRMED = 'confirmed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'event_id',
        'name',
        'email',
        'event_date',
        'status',
        'active_event_date',
        'cancel_token_hash',
        'cancelled_at',
    ];

    protected $hidden = ['cancel_token_hash', 'active_event_date'];

    protected function casts(): array
    {
        return [
            'event_date' => 'date:Y-m-d',
            'cancelled_at' => 'datetime',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function isConfirmed(): bool
    {
        return $this->status === self::STATUS_CONFIRMED;
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }
}
