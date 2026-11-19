<?php

use App\Models\RegistrationVerification;
use Illuminate\Support\Facades\Schedule;

/*
| Scheduled jobs. Run the scheduler with:  php artisan schedule:work   (or cron: schedule:run every minute)
*/

// Delete abandoned email verifications (see RegistrationVerification::prunable()).
Schedule::command('model:prune', ['--model' => [RegistrationVerification::class]])->daily();
