<?php

namespace Database\Seeders;

use App\Models\Event;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'admin@example.com'],
            ['name' => 'Admin', 'password' => 'Admin@123', 'is_admin' => true],
        );

        $d = fn (int $days) => today()->addDays($days)->toDateString();

        $events = [
            ['title' => 'React Hooks Deep Dive', 'venue' => 'Hall A, KL Tech Hub', 'event_date' => $d(3), 'start_time' => '09:30', 'max_attendees' => 30,
                'description' => 'Hands-on workshop on useState, useEffect, custom hooks and performance.'],
            ['title' => 'Laravel API Best Practices', 'venue' => 'Hall B, KL Tech Hub', 'event_date' => $d(3), 'start_time' => '14:00', 'max_attendees' => 25,
                'description' => 'Same day as the React workshop — try registering for both to see the same-date rule.'],
            ['title' => 'MySQL Performance Tuning', 'venue' => 'Room 3, Cyberjaya', 'event_date' => $d(5), 'start_time' => '10:00', 'max_attendees' => 2,
                'description' => 'Only 2 seats — good for testing the capacity limit.'],
            ['title' => 'UI/UX Design Sprint', 'venue' => 'Online (Zoom)', 'event_date' => $d(7), 'start_time' => '20:00', 'max_attendees' => 100,
                'description' => 'A one-evening design sprint for developers.'],
            ['title' => 'Cloud Deployment 101', 'venue' => 'Penang Digital Centre', 'event_date' => $d(10), 'start_time' => '09:00', 'max_attendees' => 40,
                'description' => 'From localhost to production: Docker, CI/CD and monitoring.'],
            ['title' => 'Startup Networking Night', 'venue' => 'Bangsar South', 'event_date' => $d(14), 'start_time' => '19:00', 'max_attendees' => 1,
                'description' => 'Single seat — fills up after one booking.'],
            ['title' => 'TypeScript for React Developers', 'venue' => 'Hall A, KL Tech Hub', 'event_date' => $d(16), 'start_time' => '09:30', 'max_attendees' => 35,
                'description' => 'Typing props, hooks and API responses without the pain.'],
            ['title' => 'Securing REST APIs', 'venue' => 'Room 3, Cyberjaya', 'event_date' => $d(18), 'start_time' => '14:00', 'max_attendees' => 20,
                'description' => 'Authentication, rate limiting and the OWASP API Top 10 in practice.'],
            ['title' => 'Docker for PHP Developers', 'venue' => 'Online (Zoom)', 'event_date' => $d(21), 'start_time' => '20:00', 'max_attendees' => 80,
                'description' => 'Containerise a Laravel app with MySQL and nginx.'],
            ['title' => 'Testing React with Vitest', 'venue' => 'Hall B, KL Tech Hub', 'event_date' => $d(24), 'start_time' => '10:00', 'max_attendees' => 30,
                'description' => 'Unit and component tests with Testing Library and fake timers.'],
            ['title' => 'Database Design Clinic', 'venue' => 'Penang Digital Centre', 'event_date' => $d(28), 'start_time' => '15:00', 'max_attendees' => 15,
                'description' => 'Bring your schema — indexes, constraints and normalisation reviewed live.'],
            ['title' => 'Year-End Tech Meetup', 'venue' => 'Bangsar South', 'event_date' => $d(35), 'start_time' => '18:30', 'max_attendees' => 60,
                'description' => 'Lightning talks and networking to close the year.'],
        ];

        foreach ($events as $event) {
            Event::query()->firstOrCreate(['title' => $event['title']], $event);
        }
    }
}
