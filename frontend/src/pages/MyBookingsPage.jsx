import { useState } from 'react'
import { Link } from 'react-router-dom'
import { registrationsApi } from '../api'
import Alert from '../components/Alert'
import EmptyState from '../components/EmptyState'
import InputField from '../components/InputField'
import Spinner from '../components/Spinner'
import useMyBookings from '../hooks/useMyBookings'
import { formatDate, todayYmd } from '../utils/format'

export default function MyBookingsPage() {
  const { bookings, markCancelled, removeBooking } = useMyBookings()
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState(null)

  const cancel = async (booking) => {
    if (!window.confirm(`Cancel your booking for "${booking.event?.title}"?`)) return
    setBusyId(booking.id)
    setMessage(null)
    try {
      const body = await registrationsApi.cancel(booking.id, booking.cancel_token)
      markCancelled(booking.id)
      setMessage({ type: 'success', text: body.message })
    } catch (err) {
      // Event deleted by admin / already cancelled elsewhere -> keep local state honest.
      if (err.status === 404 || /already been cancelled/i.test(err.message)) markCancelled(booking.id)
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusyId(null)
    }
  }

  const today = todayYmd()

  return (
    <section className="container narrow">
      <div className="page-head">
        <div>
          <h1>My bookings</h1>
          <p className="muted">Bookings made from this browser.</p>
        </div>
      </div>

      {message && <Alert type={message.type} onClose={() => setMessage(null)}>{message.text}</Alert>}

      {bookings.length === 0 ? (
        <EmptyState title="No bookings yet" action={<Link className="btn btn--primary" to="/">Browse events</Link>} />
      ) : (
        <ul className="booking-list">
          {bookings.map((b) => {
            const past = b.event_date < today
            return (
              <li key={b.id} className={`booking ${b.status === 'cancelled' ? 'booking--cancelled' : ''}`}>
                <div>
                  <strong>{b.event?.title ?? `Event #${b.event_id}`}</strong>
                  <p className="muted small">
                    {formatDate(b.event_date)} · Booking #{b.id} · {b.email}
                  </p>
                </div>
                <div className="booking__actions">
                  <span className={`pill pill--${b.status}`}>{b.status}</span>
                  {b.status === 'confirmed' && !past ? (
                    <button type="button" className="btn btn--danger btn--sm" disabled={busyId === b.id}
                      onClick={() => cancel(b)}>
                      {busyId === b.id ? <Spinner inline /> : 'Cancel'}
                    </button>
                  ) : (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => removeBooking(b.id)}>
                      Remove
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
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
