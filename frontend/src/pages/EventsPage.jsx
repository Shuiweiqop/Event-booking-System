import { useCallback, useEffect, useState } from 'react'
import Alert from '../components/Alert'
import EmptyState from '../components/EmptyState'
import EventCard from '../components/EventCard'
import EventFilters from '../components/EventFilters'
import LiveIndicator from '../components/LiveIndicator'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import RegistrationForm from '../components/RegistrationForm'
import Spinner from '../components/Spinner'
import useEvents from '../hooks/useEvents'
import useMyBookings from '../hooks/useMyBookings'

const INITIAL_FILTERS = { search: '', date: '', include_past: false }
const PER_PAGE = 8

export default function EventsPage() {
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const { events, meta, loading, error, refreshError, lastUpdated, refetch } = useEvents({
    ...filters,
    include_past: filters.include_past ? 1 : '',
    page,
    per_page: PER_PAGE,
  })
  const { bookings } = useMyBookings()

  // New filters -> back to page 1.
  const changeFilters = useCallback((next) => {
    setFilters(next)
    setPage(1)
  }, [])

  const changePage = (p) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // The list can shrink under us (auto-refresh, events passing) — never sit on an empty page.
  useEffect(() => {
    if (meta && page > meta.last_page) setPage(meta.last_page)
  }, [meta, page])

  const bookedIds = new Set(bookings.filter((b) => b.status === 'confirmed').map((b) => b.event_id))
  const closeModal = useCallback(() => setSelected(null), [])

  return (
    <section className="container">
      <div className="page-head">
        <div>
          <h1>Upcoming events</h1>
          <p className="muted">Pick an event and reserve your seat. You can book one event per day.</p>
        </div>
        <LiveIndicator lastUpdated={lastUpdated} refreshError={refreshError} />
      </div>

      <EventFilters value={filters} onChange={changeFilters} />

      {error && (
        <Alert type="error" title="Couldn't load events">
          {error}{' '}
          <button type="button" className="link-btn" onClick={refetch}>Try again</button>
        </Alert>
      )}

      {loading && events.length === 0 ? (
        <Spinner label="Loading events…" />
      ) : !error && events.length === 0 ? (
        <EmptyState title="No events found">Try a different date or clear the filters.</EmptyState>
      ) : (
        <>
          <div className={`event-list ${loading ? 'is-refreshing' : ''}`} aria-busy={loading}>
            {events.map((event) => (
              <EventCard key={event.id} event={event} booked={bookedIds.has(event.id)} onRegister={setSelected} />
            ))}
          </div>
          <Pagination meta={meta} onChange={changePage} disabled={loading} label="events" />
        </>
      )}

      {selected && (
        <Modal title="Register for event" onClose={closeModal}>
          <RegistrationForm event={selected} onSuccess={refetch} onClose={closeModal} />
        </Modal>
      )}
    </section>
  )
}
