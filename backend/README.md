# Event Booking API (Laravel 12)

Setup, API reference, database design and the concurrency explanation are in the [root README](../README.md).

```bash
composer install && cp .env.example .env && php artisan key:generate
# set DB_* in .env, create the `event_booking` database
php artisan migrate --seed
php artisan serve
php artisan test
```

## Structure

```
app/
├── Exceptions/BookingException.php          business-rule error → { success:false, message } + HTTP status
├── Http/
│   ├── Controllers/
│   │   ├── Concerns/RespondsWithJson.php    { success, message, data } envelope
│   │   ├── EventController.php              list / show / create / delete
│   │   ├── RegistrationController.php       register / cancel / admin attendee list
│   │   └── AuthController.php               admin login / me / logout (Sanctum)
│   ├── Middleware/EnsureUserIsAdmin.php     `admin` route middleware
│   ├── Requests/                            StoreRegistrationRequest, StoreEventRequest
│   └── Resources/                           EventResource (computes available_slots), RegistrationResource
├── Models/                                  Event, Registration, RegistrationVerification, User
├── Providers/AppServiceProvider.php         rate limiters (bookings, login)
├── Services/RegistrationService.php         ★ all booking rules + transaction / locking
├── Services/EmailVerificationService.php    two-step booking: email code → verify → book
├── Mail/                                    VerificationCodeMail, BookingConfirmedMail (text views in resources/views/mail)
└── Console/Commands/RaceTestCommand.php     booking:race-test (real concurrency test)
bootstrap/app.php                            routes + JSON error rendering for /api/*
database/migrations/                         schema (events, registrations, registration_verifications, is_admin)
database/seeders/DatabaseSeeder.php          demo admin + sample events
routes/api.php                               route definitions
tests/Feature/RegistrationTest.php           35 feature tests
```
