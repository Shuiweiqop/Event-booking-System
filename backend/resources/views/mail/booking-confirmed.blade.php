Hi {{ $name }},

You're booked for "{{ $eventTitle }}" on {{ $eventDate }}{{ $venue ? ' at '.$venue : '' }}.

Booking ID:         #{{ $bookingId }}
Cancellation code:  {{ $cancelToken }}

To cancel, open "My Bookings" on the website and use "Cancel with a booking code".

— {{ config('app.name') }}
