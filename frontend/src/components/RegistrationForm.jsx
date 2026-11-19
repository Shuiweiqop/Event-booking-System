import { useState } from 'react'
import { registrationsApi } from '../api'
import useMyBookings from '../hooks/useMyBookings'
import { formatDate, formatTime } from '../utils/format'
import { firstErrors, validateRegistration } from '../utils/validation'
import Alert from './Alert'
import InputField from './InputField'
import Spinner from './Spinner'
import VerifyCodeStep from './VerifyCodeStep'

/**
 * Registration for one event, in three steps:
 *   details  -> field validation, POST /registrations (rules pre-checked by the server, code emailed)
 *   verify   -> enter the code (VerifyCodeStep), POST /registrations/verify
 *   done     -> confirmation with booking ID + cancellation code
 * Only field formats are checked here. Booking rules (same date, full, past) are decided by the
 * server alone: a local copy of "my bookings" can be stale (e.g. an admin moved an event), and
 * blocking on it would wrongly stop requests the server allows.
 */
export default function RegistrationForm({ event, onSuccess, onClose }) {
  const [form, setForm] = useState({ name: '', email: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [pending, setPending] = useState(null) // verification in progress
  const [result, setResult] = useState(null)
  const { addBooking } = useMyBookings()

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((er) => ({ ...er, [field]: undefined }))
    setServerError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const clientErrors = validateRegistration(form)
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }

    setSubmitting(true)
    setServerError(null)
    try {
      const body = await registrationsApi.requestCode({ eventId: event.id, name: form.name.trim(), email: form.email.trim() })
      setPending(body.data)
    } catch (err) {
      setErrors(firstErrors(err.errors))
      setServerError(err.message)
      // Event may have filled up / been deleted meanwhile — refresh the listing.
      if (err.status === 409 || err.status === 404) onSuccess?.()
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerified = (body) => {
    addBooking(body.data.registration, body.data.cancel_token)
    setResult(body)
    onSuccess?.()
  }

  if (pending && !result) {
    return (
      <>
        <EventSummary event={event} />
        <VerifyCodeStep
          pending={pending}
          onPendingChange={setPending}
          onVerified={handleVerified}
          onBack={() => setPending(null)}
          onRefreshEvents={onSuccess}
        />
      </>
    )
  }

  if (result) {
    const reg = result.data.registration
    return (
      <div className="confirmation">
        <Alert type="success" title={result.message}>
          You&apos;re booked for <strong>{event.title}</strong> on {formatDate(event.event_date)}.
        </Alert>
        <dl className="confirmation__details">
          <dt>Booking ID</dt><dd>#{reg.id}</dd>
          <dt>Name</dt><dd>{reg.name}</dd>
          <dt>Email</dt><dd>{reg.email}</dd>
          <dt>Cancellation code</dt><dd><code className="code">{result.data.cancel_token}</code></dd>
        </dl>
        <p className="muted small">
          This booking is saved under <strong>My Bookings</strong> in this browser. The booking ID and cancellation code
          were also emailed to you, so you can cancel from another device.
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>Done</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <EventSummary event={event} />

      {serverError && <Alert type="error" title="Registration failed">{serverError}</Alert>}

      <InputField label="Full name" name="name" autoComplete="name" required maxLength={100}
        value={form.name} onChange={update('name')} error={errors.name} disabled={submitting} />
      <InputField label="Email" name="email" type="email" autoComplete="email" required maxLength={150}
        value={form.email} onChange={update('email')} error={errors.email} disabled={submitting}
        hint="One booking per email per day." />

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? <><Spinner inline /> Sending code…</> : 'Send verification code'}
        </button>
      </div>
    </form>
  )
}

function EventSummary({ event }) {
  return (
    <div className="event-summary">
      <strong>{event.title}</strong>
      <span>
        {formatDate(event.event_date)}
        {event.start_time && ` · ${formatTime(event.start_time)}`} · {event.available_slots} slot
        {event.available_slots === 1 ? '' : 's'} left
      </span>
    </div>
  )
}
