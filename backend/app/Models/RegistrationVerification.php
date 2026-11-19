<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RegistrationVerification extends Model
{
    use HasUuids, MassPrunable;

    /**
     * Abandoned verifications (never confirmed, expired more than a day ago) are deleted by
     * `php artisan model:prune`, scheduled daily in routes/console.php. Verified rows are kept
     * because they link to the registration they created.
     */
    public function prunable(): Builder
    {
        return static::query()
            ->whereNull('verified_at')
            ->where('expires_at', '<', now()->subDay());
    }

    protected $fillable = [
        'event_id', 'name', 'email', 'event_date', 'code_hash', 'attempts',
        'expires_at', 'last_sent_at', 'verified_at', 'registration_id',
    ];

    protected $hidden = ['code_hash'];

    protected function casts(): array
    {
        return [
            'attempts' => 'integer',
            'event_date' => 'date:Y-m-d',
            'expires_at' => 'datetime',
            'last_sent_at' => 'datetime',
            'verified_at' => 'datetime',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public static function hashCode(string $code): string
    {
        return hash_hmac('sha256', $code, (string) config('app.key'));
    }

    /** j***@example.com */
    public function maskedEmail(): string
    {
        [$local, $domain] = explode('@', $this->email, 2) + [1 => ''];

        return mb_substr($local, 0, 1).str_repeat('*', max(2, mb_strlen($local) - 1)).'@'.$domain;
    }
}
