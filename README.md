# Mini Event Booking System

React (Vite) frontend + Laravel 12 (PHP 8.2) REST API + MySQL.

Users can browse events, register with name + email, and cancel. A person **cannot hold more than one booking on the same date**, and an event **cannot exceed `max_attendees`**. Both rules are enforced in the backend, inside a database transaction, with a database constraint as the final safeguard. Admins log in with a token to create and delete events.

```
event-booking/
├── backend/     Laravel API (see backend/README.md)
├── frontend/    React + Vite SPA (see frontend/README.md)
├── database/    schema.sql – plain-SQL schema + sample data
├── postman/     EventBooking.postman_collection.json
└── README.md    ← you are here
```

---

## 1. Setup

### Requirements
- PHP ≥ 8.2 with `pdo_mysql`, Composer 2
- MySQL 8 or MariaDB 10.4+ (XAMPP works)
- Node.js ≥ 18

### Backend

```bash
cd backend
composer install
cp .env.example .env            # Windows: copy .env.example .env
php artisan key:generate
```

Create the database, then set the `DB_*` values in `.env` (default: `event_booking`, user `root`, no password, port 3306):

```sql
CREATE DATABASE event_booking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
php artisan migrate --seed      # tables + demo admin + 6 sample events
php artisan serve               # http://127.0.0.1:8000
```

> As an alternative to migrations, you can import `database/schema.sql`. It contains the same structure plus sample data.

**Demo admin:** `admin@example.com` / `Admin@123`

Run the backend tests (they use in-memory SQLite, so they need no MySQL):

```bash
php artisan test
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env            # VITE_API_URL=/api (uses the Vite proxy)
npm run dev                     # http://localhost:5173
```

In development, Vite proxies `/api/*` to `http://127.0.0.1:8000`, so no CORS setup is needed. For a production build, set `VITE_API_URL` to the full API URL and run `npm run build`.

---

## 2. API

Base URL: `http://127.0.0.1:8000/api`. Every response uses the same envelope:

```json
{ "success": true,  "message": "Registered successfully.", "data": { ... } }
{ "success": false, "message": "You already registered for an event on this date." }
{ "success": false, "message": "The email field is required.", "errors": { "email": ["..."] } }
```

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/events` | – | List events. Query: `date`, `from`, `to`, `search`, `include_past=1` (past events are hidden by default) |
| GET | `/events/{id}` | – | Single event |
| POST | `/registrations` | – | `{ event_id, name, email }`, returns the registration and a one-time `cancel_token` |
| POST | `/registrations/{id}/cancel` | cancel token | `{ cancel_token }` |
| POST | `/admin/login` | – | `{ email, password }`, returns a Bearer token (expires in 8 h) |
| GET | `/admin/me` | Bearer | Current admin |
| POST | `/admin/logout` | Bearer | Revokes the current token |
| POST | `/admin/events` | Bearer | Create event `{ title, event_date, max_attendees, start_time?, venue?, description? }` |
| DELETE | `/admin/events/{id}` | Bearer | Delete event (its registrations cascade) |
| GET | `/admin/events/{id}/registrations` | Bearer | Attendee list |

Each event in the response includes computed fields: `registered_count`, `available_slots`, `is_full`, `is_past`.

**HTTP status codes:** `201` created · `401` not logged in · `403` not admin · `404` not found · `409` business-rule conflict (same date / same event / full) · `422` validation (incl. past event) · `429` rate-limited.

A Postman collection is in `postman/`. Run it top to bottom: its test scripts save the IDs and tokens into collection variables automatically.

---

## 3. Database structure

```
users (admins)             events                         registrations
──────────────             ──────────────────             ─────────────────────────────────
id                         id                             id
name                       title                          event_id  → events.id (ON DELETE CASCADE)
email (unique)             description                    name
password (bcrypt)          venue                          email            (lower-cased)
is_admin                   event_date  (indexed)          event_date       (copied from event)
                           start_time                     status           confirmed | cancelled
personal_access_tokens     max_attendees                  active_event_date  = event_date, or NULL when cancelled
(Sanctum, hashed tokens)                                  cancel_token_hash  (sha256)
                                                          cancelled_at
                                                          UNIQUE (email, active_event_date)
                                                          INDEX  (event_id, status)
```

Design decisions:

- **Attendees have no accounts.** The requirement only asks for name + email, so the person is identified by their **normalised email** (trimmed, lower-cased): `Jane@X.com` and `jane@x.com` count as the same person.
- **Available slots are calculated, not stored:** `max_attendees − COUNT(confirmed registrations)`. A cancellation therefore frees the seat automatically, and no counter can drift out of sync.
- **`active_event_date` + UNIQUE index.** While a booking is confirmed, this column holds the event date. On cancellation it becomes `NULL`. Since MySQL allows any number of `NULL`s in a unique index, `UNIQUE(email, active_event_date)` means "at most one *confirmed* booking per email per date", enforced by the database itself. Cancelled rows stay in the table as history and never block a new booking.
- **Cancellation without login.** On registration the API returns a random 40-character `cancel_token`, shown to the user once. Only its SHA-256 hash is stored. Cancelling requires booking ID + token. A missing booking and a wrong token return the same 404, so booking IDs cannot be enumerated.

---

## 4. Validation logic

Validation happens in layers. The frontend checks give quick feedback; the backend is the source of truth.

| Rule | Frontend | Backend |
|---|---|---|
| All fields required, valid email, name 2–100 chars | `utils/validation.js`, inline field errors | `StoreRegistrationRequest`, returns 422 with `errors` |
| Event must exist | – | `exists:events,id`, returns 422 |
| Event is full | Register button disabled ("Fully booked") | Counted under row lock, returns 409 |
| Event is in the past | Button disabled ("Event ended") | `isPast()` check, returns 422 |
| Same email already booked this event | Button shows "You're registered" | returns 409 *"You are already registered for this event."* |
| Same email already booked another event that date | Checked against this browser's bookings before submit | App check + **UNIQUE index**, returns 409 *"You already registered for an event on this date."* |
| Admin: title, date ≥ today, capacity ≥ 1 | `validateEvent()` | `StoreEventRequest` |

All booking rules live in one place: `backend/app/Services/RegistrationService.php`.

---

## 5. Concurrent registrations (race conditions)

Two kinds of race have to be handled:

**A) Many people book the last seat of the same event at the same time.**
The service runs inside a transaction and first locks the event row:

```php
DB::transaction(function () {
    $event = Event::whereKey($id)->lockForUpdate()->firstOrFail();   // SELECT … FOR UPDATE
    // count confirmed registrations → reject if >= max_attendees → insert
}, attempts: 3);                                                      // auto-retry on deadlock
```

All registrations for the same event queue up on that row lock. Each one counts seats only after the previous one has committed, so two requests can never both see "1 seat left". Cancellations take the same lock.

**B) The same person books two *different* events on the same date at the same time.**
These requests lock *different* event rows, so the lock above does not serialise them. Both could pass the "already booked on this date?" check. The `UNIQUE(email, active_event_date)` index covers this case: InnoDB accepts only one of the two inserts. The second raises `UniqueConstraintViolationException`, which the service turns into the normal 409 *"You already registered for an event on this date."* No second booking can exist, even in theory.

There is a test for this: `test_database_unique_index_blocks_same_date_even_if_app_check_is_bypassed`.

In short: the **row lock** guarantees capacity, and the **unique index** guarantees the per-date rule. The application-level checks remain so that users get specific, friendly error messages.

### Proving it: a real concurrency test against MySQL

`php artisan serve` handles one request at a time, so firing HTTP requests at it would not prove anything. Instead, this artisan command starts **N separate PHP processes**. Each process boots Laravel, waits for a shared start timestamp, and then runs `RegistrationService::register()` at the same instant, which means N genuinely parallel MySQL transactions:

```bash
cd backend
php artisan booking:race-test                                # 30 people race for 3 seats
php artisan booking:race-test --mode=same-date --requests=15 # 1 person books 15 events on one date
php artisan booking:race-test --requests=50 --seats=5        # tune the numbers
```

The command checks the **database rows**, not only the responses, and deletes its test events afterwards:

| Scenario | Successes | Rejected | Confirmed rows | Result |
|---|---|---|---|---|
| 30 people, 3 seats | 3 | 27 *"fully booked"* | 3 | PASS |
| 1 person, 15 events, same date | 1 | 14 *"already registered … this date"* | 1 | PASS |
| 30 people, 3 seats, **with `lockForUpdate()` temporarily removed** | 8 | 22 | **8** | **FAIL (overbooked)** |

The last row shows that the test catches a real bug: without the row lock, 8 people got 3 seats.

---

## 6. Security / API authentication

- **Admin auth:** Laravel Sanctum personal access tokens. Tokens are sent as `Authorization: Bearer …`, stored hashed, carry an `admin` ability, and expire after 8 h. The `admin` middleware checks both `is_admin` and the token ability.
- **Rate limiting:** login is limited to 5/min per email + IP (brute-force protection). Booking and cancelling are limited to 30/min per IP (configurable with `BOOKING_RATE_LIMIT`).
- **Input:** all input goes through Form Request validation. Eloquent and the query builder use parameter binding, so there is no SQL injection. React escapes output, so there is no XSS.
- **Errors:** every `/api` error returns the JSON envelope. Stack traces are hidden when `APP_DEBUG=false`.

---

## 7. Bonus features implemented

- [x] Admin authentication to create / delete events (plus attendee list)
- [x] User cancellation with automatic capacity re-adjustment
- [x] Search / filter events by date (exact date, range via API, keyword, show past)
- [x] Race-condition handling (explained above)
- [x] API authentication (Sanctum bearer tokens, rate limiting)
- [x] Postman collection
- [x] Automated backend tests (15 feature tests)

## 8. Assumptions

- "Same date" means the same calendar day in the app timezone (`APP_TIMEZONE`, default `Asia/Kuala_Lumpur`). Event times do not matter for this rule.
- Past events are listed only on request, cannot be booked, and their bookings cannot be cancelled.
- Admins can only create and delete events. Editing an event (especially its date or capacity) was left out because it raises policy questions, such as what happens to existing bookings that would then conflict.
- "My Bookings" in the UI is stored per browser (localStorage). From another device, a booking can still be cancelled with its booking ID + cancellation code.
