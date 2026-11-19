import { dateParts, formatTime } from '../utils/format'

/**
 * One event in the listing. The register button is disabled when the event is
 * full or past (the API enforces the same rules — this is just UX).
 */
export default function EventCard({ event, booked, onRegister }) {
  const { day, month, weekday } = dateParts(event.event_date)
  const pct = Math.min(100, Math.round((event.registered_count / event.max_attendees) * 100))
  const low = !event.is_full && event.available_slots <= Math.max(2, event.max_attendees * 0.2)

  let buttonLabel = 'Register'
  if (event.is_past) buttonLabel = 'Event ended'
  else if (event.is_full) buttonLabel = 'Fully booked'
  else if (booked) buttonLabel = "You're registered"

  const disabled = event.is_past || event.is_full || booked

  return (
    <article className={`event-card ${disabled ? 'event-card--muted' : ''}`}>
      <div className="event-card__date" aria-hidden="true">
        <span className="event-card__month">{month}</span>
        <span className="event-card__day">{day}</span>
        <span className="event-card__weekday">{weekday}</span>
      </div>

      <div className="event-card__main">
        <h3 className="event-card__title">{event.title}</h3>
        <p className="event-card__meta">
          <time dateTime={event.event_date}>{event.event_date}</time>
          {event.start_time && <> · {formatTime(event.start_time)}</>}
          {event.venue && <> · {event.venue}</>}
        </p>
        {event.description && <p className="event-card__desc">{event.description}</p>}

        <div className="slots">
          <div className="slots__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
            aria-label="Seats taken">
            <span style={{ width: `${pct}%` }} className={event.is_full ? 'is-full' : low ? 'is-low' : ''} />
          </div>
          <span className={`slots__text ${event.is_full ? 'text-danger' : low ? 'text-warn' : ''}`}>
            {event.is_full ? 'No slots left' : `${event.available_slots} of ${event.max_attendees} slots available`}
          </span>
        </div>
      </div>

      <div className="event-card__action">
        <button type="button" className="btn btn--primary" disabled={disabled} onClick={() => onRegister(event)}>
          {buttonLabel}
        </button>
      </div>
    </article>
  )
}
