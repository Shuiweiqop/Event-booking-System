<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A pending registration waiting for its email to be verified.
     * Becomes a row in `registrations` only after the correct code is entered.
     */
    public function up(): void
    {
        Schema::create('registration_verifications', function (Blueprint $table) {
            $table->uuid('id')->primary();                 // unguessable id returned to the client
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('email', 150);
            $table->char('code_hash', 64);                 // HMAC-SHA256(code, APP_KEY)
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->dateTime('expires_at');
            $table->dateTime('last_sent_at');
            $table->dateTime('verified_at')->nullable();
            $table->foreignId('registration_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->index(['email', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registration_verifications');
    }
};
