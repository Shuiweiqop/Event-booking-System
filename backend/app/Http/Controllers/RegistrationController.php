<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Requests\StoreRegistrationRequest;
use App\Http\Resources\RegistrationResource;
use App\Models\Event;
use App\Models\RegistrationVerification;
use App\Services\EmailVerificationService;
use App\Services\RegistrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RegistrationController extends Controller
{
    use RespondsWithJson;

    public function __construct(
        private readonly RegistrationService $service,
        private readonly EmailVerificationService $verification,
    ) {}

    /**
     * Step 1 — POST /api/registrations  { event_id, name, email }
     * Checks the booking rules and emails a one-time code. No seat is taken yet.
     */
    public function store(StoreRegistrationRequest $request): JsonResponse
    {
        [$verification, $code] = $this->verification->request(
            (int) $request->validated('event_id'),
            $request->validated('name'),
            $request->validated('email'),
        );

        return $this->ok(
            "We sent a 6-digit code to {$verification->maskedEmail()}. Enter it to confirm your booking.",
            $this->verificationPayload($verification, $code),
            202,
        );
    }

    /** Step 2 — POST /api/registrations/verify  { verification_id, code } */
    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'verification_id' => ['required', 'uuid'],
            'code' => ['required', 'string', 'regex:/^\s*\d{6}\s*$/'],
        ], ['code.regex' => 'The code must be 6 digits.']);

        [$registration, $cancelToken] = $this->verification->verify($data['verification_id'], $data['code']);

        return $this->ok('Registered successfully.', [
            'registration' => new RegistrationResource($registration),
            // Shown once (and emailed); required to cancel. Only its SHA-256 hash is stored.
            'cancel_token' => $cancelToken,
        ], 201);
    }

    /** POST /api/registrations/verifications/{id}/resend */
    public function resend(string $id): JsonResponse
    {
        [$verification, $code] = $this->verification->resend($id);

        return $this->ok("A new code was sent to {$verification->maskedEmail()}.", $this->verificationPayload($verification, $code));
    }

    private function verificationPayload(RegistrationVerification $v, string $code): array
    {
        $payload = [
            'verification_id' => $v->id,
            'email_masked' => $v->maskedEmail(),
            'expires_at' => $v->expires_at->toIso8601String(),
            'resend_available_at' => $v->last_sent_at
                ->copy()->addSeconds(config('booking.verification.resend_cooldown_seconds'))->toIso8601String(),
        ];

        if (config('booking.verification.expose_code')) {
            $payload['debug_code'] = $code; // local demo only — see config/booking.php
        }

        return $payload;
    }

    /**
     * GET /api/registrations/{id}   header  X-Cancel-Token: <token>
     * Lets the cancel-link page show what is about to be cancelled. The token travels in a
     * header (not the query string) so it doesn't end up in server access logs.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $token = (string) $request->header('X-Cancel-Token', '');
        if ($token === '') {
            return response()->json(['success' => false, 'message' => 'The X-Cancel-Token header is required.'], 401);
        }

        $registration = $this->service->findWithToken($id, $token);

        return $this->ok('Booking retrieved.', new RegistrationResource($registration));
    }

    /** POST /api/registrations/{id}/cancel  { cancel_token } */
    public function cancel(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['cancel_token' => ['required', 'string', 'max:100']]);

        $registration = $this->service->cancel($id, $data['cancel_token']);

        return $this->ok('Your booking has been cancelled.', new RegistrationResource($registration));
    }

    /** GET /api/admin/events/{id}/registrations  (admin only) */
    public function indexForEvent(int $id): JsonResponse
    {
        $event = Event::query()->findOrFail($id);
        $registrations = $event->registrations()->latest()->get();

        return $this->ok('Registrations retrieved.', RegistrationResource::collection($registrations));
    }
}
