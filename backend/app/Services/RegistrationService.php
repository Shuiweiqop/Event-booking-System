<?php

namespace App\Services;

use App\Exceptions\BookingException;
use App\Models\Event;
use App\Models\Registration;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * All booking rules live here so they are enforced in exactly one place.
 *
 * Concurrency strategy (see README "Race conditions"):
 *  1. Capacity  -> the event row is locked with SELECT ... FOR UPDATE inside a transaction,
 *                  so registrations for the SAME event are processed one at a time and the
 *                  "count < max_attendees" check cannot be raced.
 *  2. Same date -> two requests for DIFFERENT events on the same date lock different rows,
 *                  so the lock alone is not enough. The UNIQUE(email, active_event_date)
 *                  index makes the database reject the second insert; we translate that
 *                  error into the friendly "already registered on this date" message.
 */
class RegistrationService
{
    public const MSG_SAME_DATE = 'You already registered for an event on this date.';
    public const MSG_SAME_EVENT = 'You are already registered for this event.';
    public const MSG_FULL = 'Sorry, this event is fully booked.';
    public const MSG_PAST = 'Registration is closed because this event has already taken place.';

    /**
     * @return array{0: Registration, 1: string} the registration and the plain cancel token
     */
    public function register(int $eventId, string $name, string $email): array
    {
        $email = self::normaliseEmail($email);
        $name = trim($name);
        $plainToken = Str::random(40);

        try {
            $registration = DB::transaction(function () use ($eventId, $name, $email, $plainToken) {
                /** @var Event $event */
                $event = Event::query()->whereKey($eventId)->lockForUpdate()->firstOrFail();

                $this->assertBookable($event, $email);

                return $event->registrations()->create([
                    'name' => $name,
                    'email' => $email,
                    'event_date' => $event->event_date->toDateString(),
                    'active_event_date' => $event->event_date->toDateString(),
                    'status' => Registration::STATUS_CONFIRMED,
                    'cancel_token_hash' => Registration::hashToken($plainToken),
                ]);
            }, attempts: 3); // retry automatically on deadlock
        } catch (UniqueConstraintViolationException) {
            // Lost a race against a concurrent booking for another event on the same date.
            throw new BookingException(self::MSG_SAME_DATE);
        }

        return [$registration->load('event'), $plainToken];
    }

    /**
     * The booking rules: event not past, person not already booked that date, seats left.
     * Called without a lock as a pre-check (before sending a verification code) and again
     * under the row lock inside register(), which is the check that actually counts.
     *
     * @throws BookingException
     */
    public function assertBookable(Event $event, string $email): void
    {
        $email = self::normaliseEmail($email);

        if ($event->isPast()) {
            throw new BookingException(self::MSG_PAST, 422);
        }

        $existing = Registration::query()
            ->where('email', $email)
            ->where('active_event_date', $event->event_date->toDateString())
            ->first();

        if ($existing) {
            throw new BookingException(
                $existing->event_id === $event->id ? self::MSG_SAME_EVENT : self::MSG_SAME_DATE
            );
        }

        if ($event->confirmedRegistrations()->count() >= $event->max_attendees) {
            throw new BookingException(self::MSG_FULL);
        }
    }

    /**
     * Look up a booking by ID + its cancel token (used by the cancel link page).
     * Same 404 for "not found" and "wrong token", so booking IDs can't be probed.
     */
    public function findWithToken(int $registrationId, string $plainToken): Registration
    {
        $registration = Registration::query()->with('event')->find($registrationId);

        if (! $registration || ! hash_equals($registration->cancel_token_hash, Registration::hashToken($plainToken))) {
            throw new BookingException('Booking not found or cancellation code is invalid.', 404);
        }

        return $registration;
    }

    public function cancel(int $registrationId, string $plainToken): Registration
    {
        return DB::transaction(function () use ($registrationId, $plainToken) {
            $registration = $this->findWithToken($registrationId, $plainToken);

            // Lock the event row: keeps capacity bookkeeping serialised with registrations.
            $event = Event::query()->whereKey($registration->event_id)->lockForUpdate()->first();
            $registration = Registration::query()->whereKey($registrationId)->lockForUpdate()->first();

            if (! $registration->isConfirmed()) {
                throw new BookingException('This booking has already been cancelled.');
            }
            if ($event && $event->isPast()) {
                throw new BookingException('Past events cannot be cancelled.', 422);
            }

            // Freeing active_event_date releases both the seat (capacity is counted from
            // confirmed rows) and the user's "one event per date" slot.
            $registration->update([
                'status' => Registration::STATUS_CANCELLED,
                'active_event_date' => null,
                'cancelled_at' => now(),
            ]);

            return $registration->load('event');
        }, attempts: 3);
    }

    public static function normaliseEmail(string $email): string
    {
        return Str::lower(trim($email));
    }
}
