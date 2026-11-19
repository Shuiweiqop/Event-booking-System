<?php

namespace App\Services;

use App\Exceptions\BookingException;
use App\Models\Event;
use App\Models\Registration;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Admin changes to an event that must stay consistent with existing bookings.
 */
class EventService
{
    /**
     * Update an event. Rules:
     *  - past events can't be edited
     *  - max_attendees can't drop below the number of confirmed bookings
     *  - moving the date moves every booking with it, and is refused as a whole if any
     *    attendee already holds another confirmed booking on the new date
     *
     * Runs under the same event row lock as registrations, so a booking can't slip in
     * between the capacity check and the update.
     */
    public function update(int $eventId, array $data): Event
    {
        try {
            return DB::transaction(function () use ($eventId, $data) {
                /** @var Event $event */
                $event = Event::query()->whereKey($eventId)->lockForUpdate()->firstOrFail();

                if ($event->isPast()) {
                    throw new BookingException('Past events cannot be edited.', 422);
                }

                $confirmed = $event->confirmedRegistrations()->count();
                if (isset($data['max_attendees']) && $data['max_attendees'] < $confirmed) {
                    throw new BookingException(
                        "Capacity can't be lower than the {$confirmed} confirmed booking(s).", 422
                    );
                }

                $oldDate = $event->event_date->toDateString();
                $newDate = $data['event_date'] ?? $oldDate;

                if ($newDate !== $oldDate) {
                    $this->assertNoDateConflicts($event, $newDate);

                    // Keep the per-date rule intact: bookings move with the event.
                    $event->registrations()->update(['event_date' => $newDate]);
                    $event->registrations()
                        ->where('status', Registration::STATUS_CONFIRMED)
                        ->update(['active_event_date' => $newDate]);
                }

                $event->update($data);

                return $event->loadCount(['confirmedRegistrations as confirmed_count']);
            }, attempts: 3);
        } catch (UniqueConstraintViolationException) {
            // An attendee booked another event on the new date in the meantime.
            throw new BookingException('Some attendees already have another booking on the new date.', 409);
        }
    }

    private function assertNoDateConflicts(Event $event, string $newDate): void
    {
        $attendees = $event->confirmedRegistrations()->pluck('email');

        $conflicts = Registration::query()
            ->whereIn('email', $attendees)
            ->where('active_event_date', $newDate)
            ->where('event_id', '!=', $event->id)
            ->count();

        if ($conflicts > 0) {
            throw new BookingException(
                "Can't move the event to {$newDate}: {$conflicts} attendee(s) already have another booking on that date.",
                409,
            );
        }
    }
}
