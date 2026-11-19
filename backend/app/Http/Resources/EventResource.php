<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Event */
class EventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $registered = (int) ($this->confirmed_count ?? $this->confirmedRegistrations()->count());
        $available = max(0, $this->max_attendees - $registered);

        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'venue' => $this->venue,
            'event_date' => $this->event_date->toDateString(),
            'start_time' => $this->start_time ? substr($this->start_time, 0, 5) : null,
            'max_attendees' => $this->max_attendees,
            'registered_count' => $registered,
            'available_slots' => $available,
            'is_full' => $available === 0,
            'is_past' => $this->isPast(),
        ];
    }
}
