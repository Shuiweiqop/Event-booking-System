import { useState } from 'react'
import { EMPTY_EVENT } from '../utils/eventForm'
import { todayYmd } from '../utils/format'
import { firstErrors, validateEvent } from '../utils/validation'
import Alert from './Alert'
import InputField from './InputField'
import Spinner from './Spinner'

/**
 * Shared create / edit form for events.
 *
 * `onSubmit(payload)` must return a promise; a rejected promise with `errors` (422) is mapped
 * onto the fields. In edit mode empty optional fields are sent as null (so they can be cleared);
 * in create mode they are omitted.
 * `bookedCount` (edit mode) enforces the "capacity ≥ confirmed bookings" rule client-side and
 * warns that moving the date moves those bookings too.
 */
export default function EventForm({
  initial = EMPTY_EVENT,
  mode = 'create',
  bookedCount = 0,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [busy, setBusy] = useState(false)
  const isEdit = mode === 'edit'

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value })
    setErrors({ ...errors, [k]: undefined })
    setServerError(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    const v = validateEvent(form, todayYmd(), { minCapacity: bookedCount })
    if (Object.keys(v).length) return setErrors(v)

    const payload = { ...form, max_attendees: Number(form.max_attendees) }
    for (const k of ['description', 'venue', 'start_time']) {
      if (payload[k] === '') {
        if (isEdit) payload[k] = null
        else delete payload[k]
      }
    }

    setBusy(true)
    setServerError(null)
    try {
      await onSubmit(payload)
      if (!isEdit) setForm(EMPTY_EVENT)
    } catch (err) {
      setErrors(firstErrors(err.errors))
      setServerError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const dateMoved = isEdit && bookedCount > 0 && form.event_date && form.event_date !== initial.event_date

  return (
    <form onSubmit={submit} noValidate>
      {serverError && <Alert type="error">{serverError}</Alert>}
      <InputField label="Title" required value={form.title} onChange={set('title')} error={errors.title} maxLength={150} />
      <div className="row">
        <InputField label="Date" type="date" required min={todayYmd()} value={form.event_date}
          onChange={set('event_date')} error={errors.event_date}
          hint={dateMoved ? `${bookedCount} booking(s) will move to the new date.` : undefined} />
        <InputField label="Start time" type="time" value={form.start_time} onChange={set('start_time')} error={errors.start_time} />
      </div>
      <div className="row">
        <InputField label="Venue" value={form.venue} onChange={set('venue')} error={errors.venue} maxLength={150} />
        <InputField label="Max attendees" type="number" min={Math.max(1, bookedCount)} required value={form.max_attendees}
          onChange={set('max_attendees')} error={errors.max_attendees}
          hint={isEdit && bookedCount > 0 ? `At least ${bookedCount} (confirmed bookings).` : undefined} />
      </div>
      <InputField label="Description" as="textarea" rows={3} value={form.description}
        onChange={set('description')} error={errors.description} />
      <div className="form-actions">
        {onCancel && <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button type="submit" className={`btn btn--primary ${onCancel ? '' : 'btn--block'}`} disabled={busy}>
          {busy ? <><Spinner inline /> {busyLabel}</> : submitLabel}
        </button>
      </div>
    </form>
  )
}
