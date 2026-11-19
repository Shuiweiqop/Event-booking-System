<?php

namespace App\Mail;

use App\Models\Registration;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class BookingConfirmedMail extends Mailable
{
    use Queueable;

    public function __construct(
        public readonly Registration $registration,
        public readonly string $cancelToken,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Booking confirmed: {$this->registration->event->title}");
    }

    public function content(): Content
    {
        return new Content(text: 'mail.booking-confirmed', with: [
            'name' => $this->registration->name,
            'eventTitle' => $this->registration->event->title,
            'eventDate' => $this->registration->event->event_date->toFormattedDayDateString(),
            'venue' => $this->registration->event->venue,
            'bookingId' => $this->registration->id,
            'cancelToken' => $this->cancelToken,
            'cancelUrl' => $this->cancelUrl(),
        ]);
    }

    /** Opens a confirmation page — visiting the link alone never cancels anything. */
    public function cancelUrl(): string
    {
        return config('app.frontend_url').'/cancel?'.http_build_query([
            'id' => $this->registration->id,
            'token' => $this->cancelToken,
        ]);
    }
}
