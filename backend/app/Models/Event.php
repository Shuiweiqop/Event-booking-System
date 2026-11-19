<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Event extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'venue',
        'event_date',
        'start_time',
        'max_attendees',
    ];

    protected function casts(): array
    {
        return [
            'event_date' => 'date:Y-m-d',
            'max_attendees' => 'integer',
        ];
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(Registration::class);
    }

    public function confirmedRegistrations(): HasMany
    {
        return $this->registrations()->where('status', Registration::STATUS_CONFIRMED);
    }

    /** Adds `confirmed_count` to each row. */
    public function scopeWithConfirmedCount(Builder $query): Builder
    {
        return $query->withCount(['registrations as confirmed_count' => function (Builder $q) {
            $q->where('status', Registration::STATUS_CONFIRMED);
        }]);
    }

    public function isPast(): bool
    {
        return $this->event_date->lt(today());
    }
}
