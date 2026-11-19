import { useEffect, useState } from 'react'
import { adminApi } from '../api'
import Alert from '../components/Alert'
import EmptyState from '../components/EmptyState'
import EventForm from '../components/EventForm'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import Spinner from '../components/Spinner'
import useEvents from '../hooks/useEvents'
import { toFormValues } from '../utils/eventForm'
import { formatDate, formatTime } from '../utils/format'

export default function AdminDashboardPage() {
  const [page, setPage] = useState(1)
  const { events, meta, loading, error, refetch } = useEvents({ include_past: 1, page, per_page: 10 })
  const [flash, setFlash] = useState(null)
  // The edit dialog lives at page level and holds a snapshot of the event, so the list can
  // auto-refresh (or the event can move to another page) underneath without closing it.
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  // Deleting the last event on the last page would leave an empty page — step back.
  useEffect(() => {
    if (meta && page > meta.last_page) setPage(meta.last_page)
  }, [meta, page])

  /** Shared success handler for create / edit / delete. */
  const done = (msg) => {
    setFlash({ type: 'success', text: msg })
    refetch()
  }

  return (
    <section className="container">
      <div className="page-head">
        <div>
          <h1>Admin dashboard</h1>
          <p className="muted">Create, edit and remove events. Deleting an event also removes its registrations.</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} onClose={() => setFlash(null)}>{flash.text}</Alert>}

      <div className="admin-grid">
        <CreateEventForm onCreated={done} />

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
                  onEdit={() => setEditing(ev)}
                  onDeleted={done}
                  onError={(msg) => setFlash({ type: 'error', text: msg })} />
              ))}
            </ul>
          )}
          <Pagination meta={meta} onChange={setPage} disabled={loading} label="events" />
        </div>
      </div>

      {editing && (
        // closeDisabled while saving: the admin must see whether the save worked (e.g. a 409 date conflict).
        <Modal title="Edit event" onClose={() => setEditing(null)} closeDisabled={saving}>
          <EventForm
            mode="edit"
            initial={toFormValues(editing)}
            bookedCount={editing.registered_count}
            submitLabel="Save changes"
            busyLabel="Saving…"
            onBusyChange={setSaving}
            onCancel={() => setEditing(null)}
            onSubmit={async (payload) => {
              const body = await adminApi.updateEvent(editing.id, payload)
              setEditing(null)
              done(`${body.message} "${body.data.title}"`)
            }}
          />
        </Modal>
      )}
    </section>
  )
}

function CreateEventForm({ onCreated }) {
  return (
    <div className="card">
      <h2>New event</h2>
      <EventForm
        submitLabel="Create event"
        busyLabel="Creating…"
        onSubmit={async (payload) => {
          const body = await adminApi.createEvent(payload)
          onCreated(`${body.message} "${body.data.title}"`)
        }}
      />
    </div>
  )
}

function AdminEventRow({ event, onEdit, onDeleted, onError }) {
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
          {!event.is_past && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onEdit}>Edit</button>
          )}
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
