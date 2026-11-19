import { useEffect, useState } from 'react'
import { adminApi } from '../api'
import Alert from '../components/Alert'
import EmptyState from '../components/EmptyState'
import InputField from '../components/InputField'
import Pagination from '../components/Pagination'
import Spinner from '../components/Spinner'
import useEvents from '../hooks/useEvents'
import { formatDate, formatTime, todayYmd } from '../utils/format'
import { firstErrors, validateEvent } from '../utils/validation'

const EMPTY = { title: '', description: '', venue: '', event_date: '', start_time: '', max_attendees: '' }

export default function AdminDashboardPage() {
  const [page, setPage] = useState(1)
  const { events, meta, loading, error, refetch } = useEvents({ include_past: 1, page, per_page: 10 })
  const [flash, setFlash] = useState(null)

  // Deleting the last event on the last page would leave an empty page — step back.
  useEffect(() => {
    if (meta && page > meta.last_page) setPage(meta.last_page)
  }, [meta, page])

  return (
    <section className="container">
      <div className="page-head">
        <div>
          <h1>Admin dashboard</h1>
          <p className="muted">Create and remove events. Deleting an event also removes its registrations.</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} onClose={() => setFlash(null)}>{flash.text}</Alert>}

      <div className="admin-grid">
        <CreateEventForm onCreated={(msg) => { setFlash({ type: 'success', text: msg }); refetch() }} />

        <div className="card">
          <h2>All events</h2>
          {error && <Alert type="error">{error}</Alert>}
          {loading && events.length === 0 ? (
            <Spinner />
          ) : events.length === 0 ? (
            <EmptyState title="No events yet">Create your first event.</EmptyState>
          ) : (
            <ul className="admin-events">
              {events.map((ev) => (
                <AdminEventRow key={ev.id} event={ev}
                  onDeleted={(msg) => { setFlash({ type: 'success', text: msg }); refetch() }}
                  onError={(msg) => setFlash({ type: 'error', text: msg })} />
              ))}
            </ul>
          )}
          <Pagination meta={meta} onChange={setPage} disabled={loading} label="events" />
        </div>
      </div>
    </section>
  )
}

function CreateEventForm({ onCreated }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value })
    setErrors({ ...errors, [k]: undefined })
  }

  const submit = async (e) => {
    e.preventDefault()
    const v = validateEvent(form, todayYmd())
    if (Object.keys(v).length) return setErrors(v)

    setBusy(true)
    setServerError(null)
    try {
      const payload = { ...form, max_attendees: Number(form.max_attendees) }
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k])
      const body = await adminApi.createEvent(payload)
      setForm(EMPTY)
      onCreated(`${body.message} "${body.data.title}"`)
    } catch (err) {
      setErrors(firstErrors(err.errors))
      setServerError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>New event</h2>
      {serverError && <Alert type="error">{serverError}</Alert>}
      <InputField label="Title" required value={form.title} onChange={set('title')} error={errors.title} maxLength={150} />
      <div className="row">
        <InputField label="Date" type="date" required min={todayYmd()} value={form.event_date}
          onChange={set('event_date')} error={errors.event_date} />
        <InputField label="Start time" type="time" value={form.start_time} onChange={set('start_time')} error={errors.start_time} />
      </div>
      <div className="row">
        <InputField label="Venue" value={form.venue} onChange={set('venue')} error={errors.venue} maxLength={150} />
        <InputField label="Max attendees" type="number" min={1} required value={form.max_attendees}
          onChange={set('max_attendees')} error={errors.max_attendees} />
      </div>
      <InputField label="Description" as="textarea" rows={3} value={form.description}
        onChange={set('description')} error={errors.description} />
      <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
        {busy ? <><Spinner inline /> Creating…</> : 'Create event'}
      </button>
    </form>
  )
}

function AdminEventRow({ event, onDeleted, onError }) {
  const [busy, setBusy] = useState(false)
  const [regs, setRegs] = useState(null)
  const [open, setOpen] = useState(false)

  const remove = async () => {
    const warn = event.registered_count ? ` ${event.registered_count} confirmed registration(s) will also be removed.` : ''
    if (!window.confirm(`Delete "${event.title}"?${warn}`)) return
    setBusy(true)
    try {
      onDeleted((await adminApi.deleteEvent(event.id)).message)
    } catch (err) {
      onError(err.message)
      setBusy(false)
    }
  }

  const toggle = async () => {
    setOpen((o) => !o)
    if (regs || open) return
    try {
      setRegs((await adminApi.eventRegistrations(event.id)).data)
    } catch (err) {
      onError(err.message)
      setOpen(false)
    }
  }

  return (
    <li className={`admin-event ${event.is_past ? 'admin-event--past' : ''}`}>
      <div className="admin-event__row">
        <div>
          <strong>{event.title}</strong>
          <p className="muted small">
            {formatDate(event.event_date)}{event.start_time && ` · ${formatTime(event.start_time)}`}
            {' · '}{event.registered_count}/{event.max_attendees} booked
            {event.is_past && ' · past'}
          </p>
        </div>
        <div className="admin-event__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={toggle} aria-expanded={open}>
            {open ? 'Hide' : 'Attendees'}
          </button>
          <button type="button" className="btn btn--danger btn--sm" onClick={remove} disabled={busy}>
            {busy ? <Spinner inline /> : 'Delete'}
          </button>
        </div>
      </div>
      {open && (
        regs === null ? <Spinner inline /> : regs.length === 0 ? (
          <p className="muted small">No registrations yet.</p>
        ) : (
          <table className="table">
            <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Status</th></tr></thead>
            <tbody>
              {regs.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td><td>{r.name}</td><td>{r.email}</td>
                  <td><span className={`pill pill--${r.status}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </li>
  )
}
