<?php

namespace App\Console\Commands;

use App\Models\Event;
use App\Models\Registration;
use Illuminate\Console\Command;
use Illuminate\Process\Pool;
use Illuminate\Support\Facades\Process;

/**
 * Proves the concurrency guarantees against the real MySQL database.
 *
 * Spawns N separate PHP processes. Each one boots Laravel, then waits until a shared
 * start timestamp so that all of them call RegistrationService::register() at the
 * same moment — genuine parallel transactions, not sequential HTTP requests.
 *
 *   php artisan booking:race-test                      # 30 people, 3 seats
 *   php artisan booking:race-test --mode=same-date     # 1 person, 10 events on one date
 */
class RaceTestCommand extends Command
{
    protected $signature = 'booking:race-test
        {--mode=capacity : capacity | same-date}
        {--requests=30 : number of concurrent processes}
        {--seats=3 : max_attendees of the test event (capacity mode)}
        {--keep : keep the test events instead of deleting them}';

    protected $description = 'Fire truly concurrent registrations at MySQL and verify no overbooking / double booking';

    public function handle(): int
    {
        if ($this->laravel['config']['database.default'] === 'sqlite') {
            $this->error('Run this against MySQL — SQLite serialises writes and proves nothing.');

            return self::FAILURE;
        }

        $mode = $this->option('mode');
        $n = max(2, (int) $this->option('requests'));
        $date = today()->addDays(60)->toDateString();
        $tag = 'RACE-'.now()->format('His');

        // Build the scenario: [eventId, email] for every worker.
        if ($mode === 'capacity') {
            $seats = max(1, (int) $this->option('seats'));
            $event = Event::create(['title' => "$tag capacity", 'event_date' => $date, 'max_attendees' => $seats]);
            $events = collect([$event]);
            $jobs = collect(range(1, $n))->map(fn ($i) => [$event->id, "racer{$i}@race.test"]);
            $this->info("Scenario: {$n} different people book an event with {$seats} seat(s) at the same instant.");
            $expected = min($seats, $n);
        } elseif ($mode === 'same-date') {
            $events = collect(range(1, $n))->map(fn ($i) => Event::create([
                'title' => "$tag same-date #$i", 'event_date' => $date, 'max_attendees' => 100,
            ]));
            $jobs = $events->map(fn ($e) => [$e->id, 'same.person@race.test']);
            $this->info("Scenario: ONE person books {$n} different events on {$date} at the same instant.");
            $expected = 1;
        } else {
            $this->error('Unknown --mode. Use capacity or same-date.');

            return self::FAILURE;
        }

        // Give every process time to boot before the shared start time.
        $startAt = microtime(true) + max(4, $n * 0.15);
        $this->line('Spawning '.$n.' PHP processes…');

        $results = Process::pool(function (Pool $pool) use ($jobs, $startAt) {
            foreach ($jobs as $i => [$eventId, $email]) {
                $pool->as("w$i")->path(base_path())->timeout(120)->command([
                    PHP_BINARY, 'artisan', 'booking:race-worker', $eventId, $email, sprintf('%.6f', $startAt),
                ]);
            }
        })->start()->wait();

        // Collect worker outcomes.
        $outcomes = $results->collect()->map(function ($r) {
            $json = json_decode(trim(collect(explode("\n", trim($r->output())))->last() ?? ''), true);

            return $json['outcome'] ?? ('crash: '.trim($r->errorOutput() ?: $r->output()));
        });

        $this->newLine();
        $this->table(['Outcome', 'Count'], $outcomes->countBy()->map(fn ($c, $k) => [$k, $c])->values());

        // Verify the database, not just the responses.
        $confirmed = Registration::query()
            ->whereIn('event_id', $events->pluck('id'))
            ->where('status', Registration::STATUS_CONFIRMED)
            ->count();
        $successes = $outcomes->filter(fn ($o) => $o === 'success')->count();

        $this->line("Confirmed rows in DB: <comment>{$confirmed}</comment>   expected: <comment>{$expected}</comment>");

        if (! $this->option('keep')) {
            Event::query()->whereIn('id', $events->pluck('id'))->delete(); // registrations cascade
        }

        if ($confirmed === $expected && $successes === $expected) {
            $this->info('PASS — no overbooking and no double booking under concurrency.');

            return self::SUCCESS;
        }

        $this->error('FAIL — concurrency guarantee violated.');

        return self::FAILURE;
    }
}
