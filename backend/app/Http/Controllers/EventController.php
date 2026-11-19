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

    public const DEFAULT_PER_PAGE = 10;

    public const MAX_PER_PAGE = 50;

    /**
     * GET /api/events
     *   ?date=YYYY-MM-DD           exact date
     *   ?from=YYYY-MM-DD&to=...    date range
     *   ?search=keyword            title / venue
     *   ?include_past=1            past events are hidden by default
     *   ?page=1&per_page=10        pagination (per_page max 50); response has a `meta` block
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'search' => ['nullable', 'string', 'max:100'],
            'include_past' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_PER_PAGE],
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
            ->orderBy('id') // stable order, so an item never appears on two pages
            ->paginate($filters['per_page'] ?? self::DEFAULT_PER_PAGE);

        return $this->okPaginated('Events retrieved.', $events, EventResource::class);
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
