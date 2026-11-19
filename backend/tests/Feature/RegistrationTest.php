<?php

namespace Tests\Feature;

use App\Mail\BookingConfirmedMail;
use App\Mail\VerificationCodeMail;
use App\Models\Event;
use App\Models\Registration;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config(['booking.verification.expose_code' => false]);
    }

    private function makeEvent(array $attrs = []): Event
    {
        return Event::create(array_merge([
            'title' => 'Test Event',
            'event_date' => today()->addDays(3)->toDateString(),
            'max_attendees' => 10,
        ], $attrs));
    }

    /** Step 1 only: request a verification code. */
    private function requestCode(Event $event, string $email = 'jane@example.com', string $name = 'Jane')
    {
        return $this->postJson('/api/registrations', ['event_id' => $event->id, 'name' => $name, 'email' => $email]);
    }

    /** The code from the most recent verification email (read from the faked mailer). */
    private function lastCode(): string
    {
        return Mail::sent(VerificationCodeMail::class)->last()->code;
    }

    /** Full flow: request code + verify. Returns the step-1 response if it was rejected. */
    private function register(Event $event, string $email = 'jane@example.com', string $name = 'Jane')
    {
        $res = $this->requestCode($event, $email, $name);
        if ($res->status() !== 202) {
            return $res;
        }

        return $this->postJson('/api/registrations/verify', [
            'verification_id' => $res->json('data.verification_id'),
            'code' => $this->lastCode(),
        ]);
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

    /* ------------------------------------------------------------------
     | Pagination
     * ------------------------------------------------------------------ */

    private function makeEvents(int $n): void
    {
        foreach (range(1, $n) as $i) {
            $this->makeEvent(['title' => "Event {$i}", 'event_date' => today()->addDays($i)->toDateString()]);
        }
    }

    public function test_events_are_paginated_with_meta(): void
    {
        $this->makeEvents(12);

        $this->getJson('/api/events?per_page=5&page=2')
            ->assertOk()
            ->assertJsonCount(5, 'data')
            ->assertJsonPath('data.0.title', 'Event 6')
            ->assertJsonPath('meta', [
                'current_page' => 2, 'last_page' => 3, 'per_page' => 5, 'total' => 12, 'from' => 6, 'to' => 10,
            ]);

        $this->getJson('/api/events?per_page=5&page=3')->assertJsonCount(2, 'data')->assertJsonPath('meta.to', 12);
    }

    public function test_default_page_size_is_10(): void
    {
        $this->makeEvents(12);

        $this->getJson('/api/events')->assertJsonCount(10, 'data')->assertJsonPath('meta.last_page', 2);
    }

    public function test_pages_do_not_overlap_when_events_share_date_and_time(): void
    {
        foreach (range(1, 7) as $i) {
            $this->makeEvent(['title' => "Same {$i}", 'start_time' => '10:00']);
        }

        $ids = collect([1, 2, 3])
            ->flatMap(fn ($p) => $this->getJson("/api/events?per_page=3&page={$p}")->json('data.*.id'));

        $this->assertCount(7, $ids);
        $this->assertCount(7, $ids->unique());
    }

    public function test_page_beyond_last_returns_empty_data(): void
    {
        $this->makeEvents(3);

        $this->getJson('/api/events?page=5')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 3);
    }

    public function test_per_page_is_capped(): void
    {
        $this->getJson('/api/events?per_page=500')->assertStatus(422)->assertJsonValidationErrors('per_page');
        $this->getJson('/api/events?page=0')->assertStatus(422)->assertJsonValidationErrors('page');
    }

    public function test_pagination_respects_filters(): void
    {
        $this->makeEvents(12);
        $this->makeEvent(['title' => 'Special Workshop', 'event_date' => today()->addDays(40)->toDateString()]);

        $this->getJson('/api/events?search=special&per_page=5')
            ->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 1)->assertJsonPath('meta.last_page', 1);
    }

    /* ------------------------------------------------------------------
     | Email verification
     * ------------------------------------------------------------------ */

    public function test_requesting_a_code_emails_it_and_does_not_book_yet(): void
    {
        $event = $this->makeEvent();

        $this->requestCode($event, 'jane@example.com')
            ->assertStatus(202)
            ->assertJson(['success' => true])
            ->assertJsonPath('data.email_masked', 'j***@example.com')
            ->assertJsonMissingPath('data.debug_code');

        Mail::assertSent(VerificationCodeMail::class, fn ($m) => $m->hasTo('jane@example.com') && strlen($m->code) === 6);
        $this->assertDatabaseCount('registrations', 0);
        $this->assertDatabaseMissing('registration_verifications', ['code_hash' => $this->lastCode()]); // never stored in plain text
    }

    public function test_booking_rules_are_checked_before_sending_a_code(): void
    {
        $event = $this->makeEvent(['max_attendees' => 1]);
        $this->register($event, 'a@example.com')->assertCreated();

        $this->requestCode($event, 'b@example.com')->assertStatus(409)->assertJson(['message' => 'Sorry, this event is fully booked.']);
        Mail::assertSentCount(2); // only a@'s code + confirmation, nothing for b@
    }

    public function test_successful_verification_books_and_emails_confirmation(): void
    {
        $res = $this->register($this->makeEvent())->assertCreated()->assertJsonPath('data.registration.status', 'confirmed');

        Mail::assertSent(BookingConfirmedMail::class, fn ($m) => $m->cancelToken === $res->json('data.cancel_token'));
    }

    public function test_wrong_code_is_counted_and_locks_after_max_attempts(): void
    {
        $id = $this->requestCode($this->makeEvent())->json('data.verification_id');
        $correct = $this->lastCode();
        $wrong = $correct === '000000' ? '111111' : '000000';

        for ($left = 4; $left >= 1; $left--) {
            $this->postJson('/api/registrations/verify', ['verification_id' => $id, 'code' => $wrong])
                ->assertStatus(422)->assertJson(['message' => "Incorrect code. {$left} attempt(s) left."]);
        }
        $this->postJson('/api/registrations/verify', ['verification_id' => $id, 'code' => $wrong])->assertStatus(429);

        // Even the right code is refused now — brute force is capped at 5 guesses.
        $this->postJson('/api/registrations/verify', ['verification_id' => $id, 'code' => $correct])->assertStatus(429);
        $this->assertDatabaseCount('registrations', 0);
    }

    public function test_expired_code_is_rejected(): void
    {
        $id = $this->requestCode($this->makeEvent())->json('data.verification_id');
        $code = $this->lastCode();

        $this->travel(11)->minutes();

        $this->postJson('/api/registrations/verify', ['verification_id' => $id, 'code' => $code])->assertStatus(410);
    }

    public function test_code_cannot_be_used_twice(): void
    {
        $id = $this->requestCode($this->makeEvent())->json('data.verification_id');
        $code = $this->lastCode();

        $this->postJson('/api/registrations/verify', ['verification_id' => $id, 'code' => $code])->assertCreated();
        $this->postJson('/api/registrations/verify', ['verification_id' => $id, 'code' => $code])->assertStatus(409);
    }

    public function test_resend_has_cooldown_and_invalidates_old_code(): void
    {
        $id = $this->requestCode($this->makeEvent())->json('data.verification_id');
        $oldCode = $this->lastCode();

        $this->postJson("/api/registrations/verifications/{$id}/resend")->assertStatus(429);

        $this->travel(61)->seconds();
        $this->postJson("/api/registrations/verifications/{$id}/resend")->assertOk();
        $newCode = $this->lastCode();

        if ($newCode !== $oldCode) {
            $this->postJson('/api/registrations/verify', ['verification_id' => $id, 'code' => $oldCode])->assertStatus(422);
        }
        $this->postJson('/api/registrations/verify', ['verification_id' => $id, 'code' => $newCode])->assertCreated();
    }

    public function test_debug_code_is_only_exposed_when_enabled(): void
    {
        config(['booking.verification.expose_code' => true]);

        $res = $this->requestCode($this->makeEvent())->assertStatus(202);
        $this->assertSame($this->lastCode(), $res->json('data.debug_code'));
    }
}
