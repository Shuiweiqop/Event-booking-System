<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Requests\StoreRegistrationRequest;
use App\Http\Resources\RegistrationResource;
use App\Models\Event;
use App\Services\RegistrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RegistrationController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly RegistrationService $service) {}

    /** POST /api/registrations  { event_id, name, email } */
    public function store(StoreRegistrationRequest $request): JsonResponse
    {
        [$registration, $cancelToken] = $this->service->register(
            (int) $request->validated('event_id'),
            $request->validated('name'),
            $request->validated('email'),
        );

        return $this->ok('Registered successfully.', [
            'registration' => new RegistrationResource($registration),
            // Shown once; required to cancel. Only its SHA-256 hash is stored.
            'cancel_token' => $cancelToken,
        ], 201);
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
