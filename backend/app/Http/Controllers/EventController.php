<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Requests\StoreEventRequest;
use App\Http\Resources\EventResource;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventController extends Controller
{
    use RespondsWithJson;

    /**
     * GET /api/events
     *   ?date=YYYY-MM-DD           exact date
     *   ?from=YYYY-MM-DD&to=...    date range
     *   ?search=keyword            title / venue
     *   ?include_past=1            past events are hidden by default
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'search' => ['nullable', 'string', 'max:100'],
            'include_past' => ['nullable', 'boolean'],
        ]);

        $events = Event::query()
            ->withConfirmedCount()
            ->when($filters['date'] ?? null, fn ($q, $d) => $q->whereDate('event_date', $d))
            ->when($filters['from'] ?? null, fn ($q, $d) => $q->whereDate('event_date', '>=', $d))
            ->when($filters['to'] ?? null, fn ($q, $d) => $q->whereDate('event_date', '<=', $d))
            ->when($filters['search'] ?? null, function ($q, $s) {
                $q->where(fn ($w) => $w->where('title', 'like', "%{$s}%")->orWhere('venue', 'like', "%{$s}%"));
            })
            ->when(! $request->boolean('include_past') && empty($filters['date']),
                fn ($q) => $q->whereDate('event_date', '>=', today()))
            ->orderBy('event_date')
            ->orderBy('start_time')
            ->get();

        return $this->ok('Events retrieved.', EventResource::collection($events));
    }

    public function show(int $id): JsonResponse
    {
        $event = Event::query()->withConfirmedCount()->findOrFail($id);

        return $this->ok('Event retrieved.', new EventResource($event));
    }

    /** Admin only. */
    public function store(StoreEventRequest $request): JsonResponse
    {
        $event = Event::create($request->validated());
        $event->loadCount(['confirmedRegistrations as confirmed_count']);

        return $this->ok('Event created.', new EventResource($event), 201);
    }

    /** Admin only. Registrations are removed by the FK's ON DELETE CASCADE. */
    public function destroy(int $id): JsonResponse
    {
        Event::query()->findOrFail($id)->delete();

        return $this->ok('Event deleted.');
    }
}
