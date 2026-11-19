<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The event date the person saw when they asked for the code. If an admin moves the
     * event before the code is entered, the booking is refused instead of silently landing
     * on a date the person never chose.
     */
    public function up(): void
    {
        Schema::table('registration_verifications', function (Blueprint $table) {
            $table->date('event_date')->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('registration_verifications', function (Blueprint $table) {
            $table->dropColumn('event_date');
        });
    }
};
