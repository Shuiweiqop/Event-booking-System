<?php

namespace App\Console\Commands;

use App\Exceptions\BookingException;
use App\Services\RegistrationService;
use Illuminate\Console\Command;
use Throwable;

/** One worker process for booking:race-test. Not meant to be run by hand. */
class RaceWorkerCommand extends Command
{
    protected $signature = 'booking:race-worker {eventId} {email} {startAt}';

    protected $description = 'Internal: single concurrent registration attempt';

    protected $hidden = true;

    public function handle(RegistrationService $service): int
    {
        // Busy-wait until the shared start instant so all workers fire together.
        $startAt = (float) $this->argument('startAt');
        while (($wait = $startAt - microtime(true)) > 0) {
            usleep((int) min($wait * 1_000_000, 2_000));
        }

        try {
            $service->register((int) $this->argument('eventId'), 'Race Tester', $this->argument('email'));
            $outcome = 'success';
        } catch (BookingException $e) {
            $outcome = 'rejected: '.$e->getMessage();
        } catch (Throwable $e) {
            $outcome = 'error: '.class_basename($e).' '.$e->getMessage();
        }

        $this->line(json_encode(['outcome' => $outcome]));

        return self::SUCCESS;
    }
}
