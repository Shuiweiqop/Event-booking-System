{{-- Plain-text email: output is NOT HTML-escaped on purpose ({!! !!}), otherwise "&" in the cancel link
     or in names/titles would arrive as "&amp;". There is no HTML context, so no XSS risk. --}}
Hi {!! $name !!},

You're booked for "{!! $eventTitle !!}" on {!! $eventDate !!}{!! $venue ? ' at '.$venue : '' !!}.

Booking ID:         #{!! $bookingId !!}
Cancellation code:  {!! $cancelToken !!}

Can't make it? Cancel here (you'll be asked to confirm):
{!! $cancelUrl !!}

— {!! config('app.name') !!}
