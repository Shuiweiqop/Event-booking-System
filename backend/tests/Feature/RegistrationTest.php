<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\Registration;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    private function makeEvent(array $attrs = []): Event
    {
        return Event::create(array_merge([
            'title' => 'Test Event',
            'event_date' => today()->addDays(3)->toDateString(),
            'max_attendees' => 10,
        ], $attrs));
    }

    private function register(Event $event, string $email = 'jane@example.com', string $name = 'Jane')
    {
        return $this->postJson('/api/registrations', ['event_id' => $event->id, 'name' => $name, 'email' => $email]);
    }

    public function test_lists_upcoming_events_with_available_slots(): void
    {
        $event = $this->makeEvent(['max_attendees' => 2]);
        $this->makeEvent(['title' => 'Old', 'event_date' => today()->subDay()->toDateString()]);
        $this->register($event);

        $this->getJson('/api/events')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.available_slots', 1)
            ->assertJsonPath('data.0.is_full', false);
    }

    public function test_filters_events_by_date(): void
    {
        $a = $this->makeEvent(['event_date' => today()->addDays(2)->toDateString()]);
        $this->makeEvent(['event_date' => today()->addDays(4)->toDateString()]);

        $this->getJson('/api/events?date='.$a->event_date->toDateString())
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $a->id);
    }

    public function test_registers_successfully(): void
    {
        $this->register($this->makeEvent(), '  Jane@Example.COM ')
            ->assertCreated()
            ->assertJson(['success' => true, 'message' => 'Registered successfully.'])
            ->assertJsonPath('data.registration.email', 'jane@example.com')
            ->assertJsonStructure(['data' => ['cancel_token']]);
    }

    public function test_all_fields_are_required(): void
    {
        $this->postJson('/api/registrations', [])
            ->assertStatus(422)
            ->assertJson(['success' => false])
            ->assertJsonValidationErrors(['event_id', 'name', 'email']);
    }

    public function test_rejects_invalid_email(): void
    {
        $this->register($this->makeEvent(), 'not-an-email')->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_cannot_register_twice_for_same_event(): void
    {
        $event = $this->makeEvent();
        $this->register($event)->assertCreated();

        $this->register($event, 'JANE@example.com')
            ->assertStatus(409)
            ->assertJson(['success' => false, 'message' => 'You are already registered for this event.']);
    }

    public function test_cannot_register_for_two_events_on_the_same_date(): void
    {
        $date = today()->addDays(5)->toDateString();
        $this->register($this->makeEvent(['event_date' => $date]))->assertCreated();

        $this->register($this->makeEvent(['title' => 'Other', 'event_date' => $date]))
            ->assertStatus(409)
            ->assertJson(['success' => false, 'message' => 'You already registered for an event on this date.']);
    }

    public function test_can_register_for_events_on_different_dates(): void
    {
        $this->register($this->makeEvent(['event_date' => today()->addDays(5)->toDateString()]))->assertCreated();
        $this->register($this->makeEvent(['event_date' => today()->addDays(6)->toDateString()]))->assertCreated();
    }

    public function test_capacity_limit_is_enforced(): void
    {
        $event = $this->makeEvent(['max_attendees' => 1]);
        $this->register($event, 'a@example.com')->assertCreated();

        $this->register($event, 'b@example.com')
            ->assertStatus(409)
            ->assertJson(['message' => 'Sorry, this event is fully booked.']);
    }

    public function test_cannot_register_for_past_event(): void
    {
        $event = $this->makeEvent(['event_date' => today()->subDay()->toDateString()]);

        $this->register($event)->assertStatus(422)->assertJson(['success' => false]);
    }

    public function test_cancellation_frees_the_seat_and_the_date(): void
    {
        $event = $this->makeEvent(['max_attendees' => 1]);
        $res = $this->register($event, 'a@example.com')->assertCreated();
        $id = $res->json('data.registration.id');

        $this->postJson("/api/registrations/{$id}/cancel", ['cancel_token' => 'wrong'])->assertNotFound();
        $this->postJson("/api/registrations/{$id}/cancel", ['cancel_token' => $res->json('data.cancel_token')])
            ->assertOk()->assertJsonPath('data.status', 'cancelled');

        // seat freed for someone else...
        $this->register($event, 'b@example.com')->assertCreated();
        // ...and the original user may book another event on that date
        $this->register($this->makeEvent(['title' => 'Other']), 'a@example.com')->assertCreated();
    }

    public function test_database_unique_index_blocks_same_date_even_if_app_check_is_bypassed(): void
    {
        // Simulates the race: two requests both passed the application check.
        $date = today()->addDays(3)->toDateString();
        $e1 = $this->makeEvent(['event_date' => $date]);
        $e2 = $this->makeEvent(['title' => 'B', 'event_date' => $date]);
        $row = fn (Event $e) => [
            'event_id' => $e->id, 'name' => 'X', 'email' => 'x@example.com', 'event_date' => $date,
            'active_event_date' => $date, 'status' => 'confirmed', 'cancel_token_hash' => str_repeat('a', 64),
        ];

        Registration::create($row($e1));
        $this->expectException(UniqueConstraintViolationException::class);
        Registration::create($row($e2));
    }

    public function test_admin_endpoints_require_authentication(): void
    {
        $this->postJson('/api/admin/events', [])->assertUnauthorized()->assertJson(['success' => false]);
    }

    public function test_non_admin_cannot_create_events(): void
    {
        $user = User::factory()->create(['is_admin' => false]);
        $token = $user->createToken('t', ['admin'])->plainTextToken;

        $this->withToken($token)->postJson('/api/admin/events', [])->assertForbidden();
    }

    public function test_admin_can_login_create_and_delete_events(): void
    {
        User::factory()->create(['email' => 'admin@example.com', 'password' => 'secret123', 'is_admin' => true]);

        $this->postJson('/api/admin/login', ['email' => 'admin@example.com', 'password' => 'wrong'])->assertUnauthorized();
        $token = $this->postJson('/api/admin/login', ['email' => 'admin@example.com', 'password' => 'secret123'])
            ->assertOk()->json('data.token');

        $id = $this->withToken($token)->postJson('/api/admin/events', [
            'title' => 'New', 'event_date' => today()->addWeek()->toDateString(), 'start_time' => '10:00', 'max_attendees' => 5,
        ])->assertCreated()->assertJsonPath('data.available_slots', 5)->json('data.id');

        $this->register(Event::find($id))->assertCreated();

        $this->withToken($token)->deleteJson("/api/admin/events/{$id}")->assertOk();
        $this->assertDatabaseMissing('events', ['id' => $id]);
        $this->assertDatabaseCount('registrations', 0);
    }
}
