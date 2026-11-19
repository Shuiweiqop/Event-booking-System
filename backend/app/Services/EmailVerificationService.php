<?php

namespace App\Services;

use App\Exceptions\BookingException;
use App\Mail\BookingConfirmedMail;
use App\Mail\VerificationCodeMail;
use App\Models\Event;
use App\Models\Registration;
use App\Models\RegistrationVerification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Two-step booking:
 *   1. request()  – pre-check the rules, store a pending verification, email a one-time code
 *   2. verify()   – check the code, then create the real registration via RegistrationService
 *
 * Proves the person owns the email address, so nobody can book with someone else's
 * email and block that person's date.
 */
class EmailVerificationService
{
    public function __construct(private readonly RegistrationService $registrations) {}

    /** @return array{0: RegistrationVerification, 1: string} the verification and the plain code */
    public function request(int $eventId, string $name, string $email): array
    {
        $email = RegistrationService::normaliseEmail($email);
        $event = Event::query()->findOrFail($eventId);

        // Fail fast with the real reason instead of emailing a code that can never work.
        $this->registrations->assertBookable($event, $email);

        $code = $this->generateCode();
        $verification = RegistrationVerification::create([
            'event_id' => $event->id,
            'name' => trim($name),
            'email' => $email,
            'event_date' => $event->event_date->toDateString(), // the date the person agreed to
            'code_hash' => RegistrationVerification::hashCode($code),
            'expires_at' => now()->addMinutes(config('booking.verification.ttl_minutes')),
            'last_sent_at' => now(),
        ]);

        Mail::to($email)->send(new VerificationCodeMail($verification->setRelation('event', $event), $code));

        return [$verification, $code];
    }

    /** @return array{0: RegistrationVerification, 1: string} */
    public function resend(string $verificationId): array
    {
        $verification = $this->findUsable($verificationId, allowExpired: true);

        $elapsed = $verification->last_sent_at->diffInSeconds(now());
        $wait = (int) ceil(config('booking.verification.resend_cooldown_seconds') - $elapsed);
        if ($wait > 0) {
            throw new BookingException("Please wait {$wait} seconds before requesting a new code.", 429);
        }

        $code = $this->generateCode();
        $verification->update([
            'code_hash' => RegistrationVerification::hashCode($code),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(config('booking.verification.ttl_minutes')),
            'last_sent_at' => now(),
        ]);

        Mail::to($verification->email)->send(new VerificationCodeMail($verification->load('event'), $code));

        return [$verification, $code];
    }

    /** @return array{0: Registration, 1: string} registration + plain cancel token */
    public function verify(string $verificationId, string $code): array
    {
        $max = config('booking.verification.max_attempts');

        // Lock the row so parallel submissions can't skip the attempt counter.
        // A wrong code is returned (not thrown) so the attempts increment is COMMITTED —
        // throwing inside the transaction would roll it back and allow unlimited guesses.
        [$verification, $attemptsLeft] = DB::transaction(function () use ($verificationId, $code, $max) {
            $v = RegistrationVerification::query()->whereKey($verificationId)->lockForUpdate()->first();
            $this->assertUsable($v);

            if ($v->attempts >= $max) {
                return [$v, 0];
            }
            if (! hash_equals($v->code_hash, RegistrationVerification::hashCode(trim($code)))) {
                $v->increment('attempts');

                return [$v, $max - $v->attempts];
            }

            return [$v, null]; // correct code
        });

        if ($attemptsLeft !== null) {
            throw $attemptsLeft > 0
                ? new BookingException("Incorrect code. {$attemptsLeft} attempt(s) left.", 422)
                : new BookingException('Too many incorrect attempts. Please request a new code.', 429);
        }

        // The real booking: all rules re-checked under the event row lock.
        // Book only for the date the person saw when they asked for the code: if an admin
        // moved the event in the meantime, register() refuses instead of silently using the new date.
        [$registration, $cancelToken] = $this->registrations->register(
            $verification->event_id, $verification->name, $verification->email,
            expectedDate: $verification->event_date?->toDateString(),
        );

        $verification->update(['verified_at' => now(), 'registration_id' => $registration->id]);

        $this->sendConfirmation($registration, $cancelToken);

        return [$registration, $cancelToken];
    }

    private function findUsable(string $id, bool $allowExpired = false): RegistrationVerification
    {
        $v = RegistrationVerification::query()->find($id);
        $this->assertUsable($v, $allowExpired);

        return $v;
    }

    private function assertUsable(?RegistrationVerification $v, bool $allowExpired = false): void
    {
        if (! $v) {
            throw new BookingException('Verification request not found. Please start again.', 404);
        }
        if ($v->verified_at) {
            throw new BookingException('This code has already been used.', 409);
        }
        if (! $allowExpired && $v->isExpired()) {
            throw new BookingException('This code has expired. Please request a new one.', 410);
        }
    }

    private function sendConfirmation(Registration $registration, string $cancelToken): void
    {
        // The booking is already committed — a mail failure must not turn it into an error.
        try {
            Mail::to($registration->email)->send(new BookingConfirmedMail($registration, $cancelToken));
        } catch (Throwable $e) {
            Log::warning('Booking confirmation email failed', ['registration' => $registration->id, 'error' => $e->getMessage()]);
        }
    }

    private function generateCode(): string
    {
        $len = config('booking.verification.code_length');

        return str_pad((string) random_int(0, 10 ** $len - 1), $len, '0', STR_PAD_LEFT);
    }
}
