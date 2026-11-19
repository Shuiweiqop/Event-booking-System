<?php

namespace App\Mail;

use App\Models\RegistrationVerification;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class VerificationCodeMail extends Mailable
{
    use Queueable;

    public function __construct(
        public readonly RegistrationVerification $verification,
        public readonly string $code,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Your booking code: {$this->code}");
    }

    public function content(): Content
    {
        return new Content(text: 'mail.verification-code', with: [
            'name' => $this->verification->name,
            'eventTitle' => $this->verification->event->title,
            'eventDate' => $this->verification->event->event_date->toFormattedDayDateString(),
            'code' => $this->code,
            'minutes' => config('booking.verification.ttl_minutes'),
        ]);
    }
}
