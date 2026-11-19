<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('registrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('email', 150);              // stored lower-cased + trimmed

            // Copy of events.event_date at the time of booking (denormalised on purpose,
            // so the "one event per date" rule can be enforced by a UNIQUE index).
            $table->date('event_date');

            $table->enum('status', ['confirmed', 'cancelled'])->default('confirmed');

            // = event_date while the booking is confirmed, NULL once cancelled.
            // UNIQUE(email, active_event_date) is the database-level guarantee that a person
            // holds at most ONE confirmed booking per date. MySQL allows many NULLs in a
            // unique index, so cancelled rows never block a new booking.
            $table->date('active_event_date')->nullable();

            $table->char('cancel_token_hash', 64);     // sha256 of the secret cancel token
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->unique(['email', 'active_event_date'], 'registrations_email_date_unique');
            $table->index(['event_id', 'status']);          // fast "confirmed seats for event" count
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registrations');
    }
};
