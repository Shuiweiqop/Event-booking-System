# Event Booking — Frontend (React + Vite)

Setup, API and design notes are in the [root README](../README.md).

```bash
npm install
cp .env.example .env     # VITE_API_URL=/api → proxied to http://127.0.0.1:8000 by Vite
npm run dev              # http://localhost:5173
npm run build            # production build in dist/
npm test                 # unit tests (Vitest + Testing Library)
```

## Pages

| Route | Page |
|---|---|
| `/` | Event listing with search, date filter and "show past"; opens a registration modal |
| `/my-bookings` | Bookings made in this browser; cancel, or cancel any booking with ID + code |
| `/cancel?id=…&token=…` | Landing page for the cancel link in the confirmation email: shows the booking, cancels only after an explicit click |
| `/admin` | Admin login, then dashboard (create event, delete event, view attendees) |

## Structure

```
src/
├── api/
│   ├── client.js            axios instance: base URL, bearer token, error normalisation
│   └── index.js             eventsApi / registrationsApi / adminApi
├── components/
│   ├── EventCard.jsx        title, date, slots bar, register button (disabled when full/past/booked)
│   ├── EventFilters.jsx     debounced search + date filter
│   ├── RegistrationForm.jsx details → verify code → confirmation (3 steps)
│   ├── VerifyCodeStep.jsx   6-digit code input, attempts/expiry errors, resend countdown
│   ├── InputField.jsx       label + input + inline error (accessible)
│   ├── LiveIndicator.jsx    "Live · slots updated 12s ago"
│   ├── Pagination.jsx       prev / numbered pages with ellipsis / next (+ Pagination.test.jsx)
│   ├── Modal.jsx, Alert.jsx, Spinner.jsx, EmptyState.jsx, Navbar.jsx
├── context/AuthContext.jsx  admin token state, login / logout
├── hooks/
│   ├── useEvents.js         fetch + loading/error + refetch, aborts stale requests,
│   │                        auto-refresh every 30 s / on tab focus (paused while hidden)
│   ├── useEvents.test.js    8 tests for the refresh behaviour (fake timers)
│   ├── useMyBookings.js     localStorage bookings, synced across tabs
│   └── useCountdown.js      seconds-left timer (resend cooldown)
├── pages/                   EventsPage, MyBookingsPage, CancelBookingPage (+ test), AdminLoginPage, AdminDashboardPage
├── test/setup.js            jest-dom matchers + cleanup between tests
├── utils/                   format.js (dates), validation.js, pagination.js (page list)
├── App.jsx                  routes
└── main.jsx
```

Only functional components and hooks are used. Every network call has loading, error and empty states. The server is the source of truth: client-side checks only give earlier feedback.
