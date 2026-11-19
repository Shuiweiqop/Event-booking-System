import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { registrationsApi } from '../api'
import Alert from '../components/Alert'
import Spinner from '../components/Spinner'
import useMyBookings from '../hooks/useMyBookings'
import { formatDate, todayYmd } from '../utils/format'

const STASH_KEY = 'eventhub.cancelLink'

/**
 * Read id + token from the link once, then remove the token from the address bar
 * (so it doesn't sit in browser history). It is kept in sessionStorage — this tab
 * only — so a page refresh still works.
 */
function useCancelLinkParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [params] = useState(() => {
    const id = searchParams.get('id')
    const token = searchParams.get('token')
    if (id && token) {
      try {
        sessionStorage.setItem(STASH_KEY, JSON.stringify({ id, token }))
      } catch { /* storage blocked: fine, we still have them in memory */ }
      return { id, token }
    }
    try {
      return JSON.parse(sessionStorage.getItem(STASH_KEY)) ?? {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    if (searchParams.has('token')) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  return params
}

/**
 * Landing page for the cancel link in the confirmation email.
 * Opening the link only SHOWS the booking — cancelling needs an explicit click, because
 * email clients and link scanners often open links automatically.
 */
export default function CancelBookingPage() {
  const { id, token } = useCancelLinkParams()
  const { markCancelled } = useMyBookings()
  const [booking, setBooking] = useState(null)
  const [state, setState] = useState(id && token ? 'loading' : 'invalid') // loading | ready | invalid | done
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id || !token) return
    registrationsApi
      .get(id, token)
      .then((body) => {
        setBooking(body.data)
        setState('ready')
      })
      .catch((err) => {
        setError(err.message)
        setState('invalid')
      })
  }, [id, token])

  const cancel = async () => {
    setBusy(true)
    setError(null)
    try {
      const body = await registrationsApi.cancel(booking.id, token)
      setBooking(body.data)
      markCancelled(booking.id)
      setState('done')
      try {
        sessionStorage.removeItem(STASH_KEY)
      } catch { /* ignore */ }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const isPast = booking && booking.event_date < todayYmd()

  return (
    <section className="container narrow">
      <div className="card cancel-card">
        <h1>Cancel booking</h1>

        {state === 'loading' && <Spinner label="Loading your booking…" />}

        {state === 'invalid' && (
          <>
            <Alert type="error" title="This cancel link is not valid">
              {error ?? 'The link is incomplete.'} Please use the link from your confirmation email, or cancel with your
              booking ID and cancellation code.
            </Alert>
            <Link className="btn btn--ghost" to="/my-bookings">Go to My Bookings</Link>
          </>
        )}

        {booking && (
          <dl className="confirmation__details">
            <dt>Event</dt><dd><strong>{booking.event?.title}</strong></dd>
            <dt>Date</dt><dd>{formatDate(booking.event_date)}</dd>
            {booking.event?.venue && (<><dt>Venue</dt><dd>{booking.event.venue}</dd></>)}
            <dt>Name</dt><dd>{booking.name}</dd>
            <dt>Booking</dt><dd>#{booking.id} · <span className={`pill pill--${booking.status}`}>{booking.status}</span></dd>
          </dl>
        )}

        {state === 'ready' && booking.status === 'cancelled' && (
          <Alert type="info">This booking was already cancelled. Nothing else to do.</Alert>
        )}
        {state === 'ready' && booking.status === 'confirmed' && isPast && (
          <Alert type="info">This event has already taken place, so the booking can no longer be cancelled.</Alert>
        )}
        {state === 'ready' && booking.status === 'confirmed' && !isPast && (
          <>
            <p>Do you want to cancel this booking? Your seat will be released for someone else.</p>
            {error && <Alert type="error">{error}</Alert>}
            <div className="form-actions form-actions--start">
              <button type="button" className="btn btn--danger" onClick={cancel} disabled={busy}>
                {busy ? <><Spinner inline /> Cancelling…</> : 'Yes, cancel my booking'}
              </button>
              <Link className="btn btn--ghost" to="/">Keep my booking</Link>
            </div>
          </>
        )}

        {state === 'done' && (
          <>
            <Alert type="success" title="Your booking has been cancelled.">
              Your seat has been released. You can book another event on that date.
            </Alert>
            <Link className="btn btn--primary" to="/">Browse events</Link>
          </>
        )}
      </div>
    </section>
  )
}
