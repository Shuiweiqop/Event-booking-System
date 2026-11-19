import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { registrationsApi } from '../api'
import Alert from '../components/Alert'
import EmptyState from '../components/EmptyState'
import InputField from '../components/InputField'
import Spinner from '../components/Spinner'
import useMyBookings from '../hooks/useMyBookings'
import { groupBookings } from '../utils/bookings'
import { formatDate, todayYmd } from '../utils/format'

export default function MyBookingsPage() {
  const { bookings, markCancelled, removeBooking, syncWithServer } = useMyBookings()
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState(null)
  const [syncing, setSyncing] = useState(false)

  // The browser copy can be stale (event moved by an admin, cancelled on another device,
  // event deleted) — refresh it from the server every time the page is opened.
  useEffect(() => {
    setSyncing(true)
    syncWithServer().finally(() => setSyncing(false))
  }, [syncWithServer])

  const cancel = async (booking) => {
    if (!window.confirm(`Cancel your booking for "${booking.event?.title}"?`)) return
    setBusyId(booking.id)
    setMessage(null)
    try {
      const body = await registrationsApi.cancel(booking.id, booking.cancel_token)
      markCancelled(booking.id)
      setMessage({ type: 'success', text: body.message })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
      // Already cancelled elsewhere / event deleted: pull the real state.
      syncWithServer()
    } finally {
      setBusyId(null)
    }
  }

  const { upcoming, history } = groupBookings(bookings, todayYmd())

  const renderItem = (b) => (
    <li key={b.id} className={`booking ${['cancelled', 'removed'].includes(b.displayStatus) ? 'booking--cancelled' : b.displayStatus === 'past' ? 'booking--past' : ''}`}>
      <div>
        <strong>{b.event?.title ?? `Event #${b.event_id}`}</strong>
        <p className="muted small">
          {formatDate(b.event_date)} · Booking #{b.id} · {b.email}
        </p>
        {b.status === 'removed' && (
          <p className="small text-warn">This event was removed by the organiser.</p>
        )}
      </div>
      <div className="booking__actions">
        <span className={`pill pill--${b.displayStatus}`}>{b.displayStatus}</span>
        {b.displayStatus === 'confirmed' ? (
          <button type="button" className="btn btn--danger btn--sm" disabled={busyId === b.id}
            onClick={() => cancel(b)}>
            {busyId === b.id ? <Spinner inline /> : 'Cancel'}
          </button>
        ) : (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => removeBooking(b.id)}
            aria-label={`Remove booking #${b.id} from this list`}>
            Remove
          </button>
        )}
      </div>
    </li>
  )

  return (
    <section className="container narrow">
      <div className="page-head">
        <div>
          <h1>My bookings</h1>
          <p className="muted">Bookings made from this browser.</p>
        </div>
        {syncing && bookings.length > 0 && <Spinner inline label="Updating bookings…" />}
      </div>

      {message && <Alert type={message.type} onClose={() => setMessage(null)}>{message.text}</Alert>}

      {bookings.length === 0 ? (
        <EmptyState title="No bookings yet" action={<Link className="btn btn--primary" to="/">Browse events</Link>} />
      ) : (
        <>
          <section aria-labelledby="upcoming-heading" className="booking-group">
            <h2 id="upcoming-heading" className="booking-group__title">
              Upcoming <span className="muted">({upcoming.length})</span>
            </h2>
            {upcoming.length === 0 ? (
              <p className="muted">
                No upcoming bookings. <Link to="/">Browse events</Link>
              </p>
            ) : (
              <ul className="booking-list">{upcoming.map(renderItem)}</ul>
            )}
          </section>

          {history.length > 0 && (
            <details className="booking-group booking-history">
              <summary className="booking-group__title">
                History <span className="muted">({history.length})</span>
                <span className="muted small"> · past, cancelled and removed</span>
              </summary>
              <ul className="booking-list">{history.map(renderItem)}</ul>
            </details>
          )}
        </>
      )}

      <CancelByCode onCancelled={markCancelled} />
    </section>
  )
}

/** Cancel a booking made on another device using its ID + cancellation code. */
function CancelByCode({ onCancelled }) {
  const [form, setForm] = useState({ id: '', code: '' })
  const [state, setState] = useState({ busy: false, msg: null })

  const submit = async (e) => {
    e.preventDefault()
    if (!form.id.trim() || !form.code.trim()) {
      setState({ busy: false, msg: { type: 'error', text: 'Booking ID and cancellation code are required.' } })
      return
    }
    setState({ busy: true, msg: null })
    try {
      const id = Number(form.id.replace('#', ''))
      const body = await registrationsApi.cancel(id, form.code.trim())
      onCancelled(id)
      setForm({ id: '', code: '' })
      setState({ busy: false, msg: { type: 'success', text: body.message } })
    } catch (err) {
      setState({ busy: false, msg: { type: 'error', text: err.message } })
    }
  }

  return (
    <details className="panel">
      <summary>Cancel with a booking code</summary>
      <form onSubmit={submit} className="inline-form" noValidate>
        <InputField label="Booking ID" value={form.id} required inputMode="numeric"
          onChange={(e) => setForm({ ...form, id: e.target.value })} />
        <InputField label="Cancellation code" value={form.code} required
          onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <button type="submit" className="btn btn--danger" disabled={state.busy}>
          {state.busy ? <Spinner inline /> : 'Cancel booking'}
        </button>
      </form>
      {state.msg && <Alert type={state.msg.type}>{state.msg.text}</Alert>}
    </details>
  )
}
