import { useCallback, useEffect, useState } from 'react'
import { registrationsApi } from '../api'

const KEY = 'eventhub.bookings'

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? []
  } catch {
    return []
  }
}

/**
 * Bookings made from this browser, kept in localStorage together with their
 * cancel token (the API has no user accounts — the token proves ownership).
 * Synced across tabs and components via a custom event.
 *
 * The local copy is only a cache: the server is the source of truth. An admin can move
 * an event's date, a booking can be cancelled from another device, or an event can be
 * deleted — syncWithServer() refreshes every booking from GET /registrations/{id}.
 * (The booking rules themselves are never decided from this cache.)
 */
export default function useMyBookings() {
  const [bookings, setBookings] = useState(read)

  useEffect(() => {
    const sync = () => setBookings(read())
    window.addEventListener('storage', sync)
    window.addEventListener('eventhub:bookings', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('eventhub:bookings', sync)
    }
  }, [])

  const save = useCallback((next) => {
    localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('eventhub:bookings'))
  }, [])

  const addBooking = useCallback((registration, cancelToken) => {
    save([{ ...registration, cancel_token: cancelToken }, ...read().filter((b) => b.id !== registration.id)])
  }, [save])

  const markCancelled = useCallback((id) => {
    save(read().map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)))
  }, [save])

  const removeBooking = useCallback((id) => save(read().filter((b) => b.id !== id)), [save])

  /**
   * Refresh date, status and event details of every stored booking from the server.
   * 404 = the booking no longer exists (its event was deleted) -> status "removed".
   * Network/other errors keep the cached copy as it is.
   */
  const syncWithServer = useCallback(async () => {
    const fresh = await Promise.all(
      read().map(async (b) => {
        if (!b.cancel_token) return b
        try {
          const { data } = await registrationsApi.get(b.id, b.cancel_token)
          return { ...b, status: data.status, event_date: data.event_date, event: data.event ?? b.event }
        } catch (err) {
          return err.status === 404 ? { ...b, status: 'removed' } : b
        }
      }),
    )
    // Merge into the latest storage, in case something changed while we were fetching.
    const byId = new Map(fresh.map((b) => [b.id, b]))
    save(read().map((b) => byId.get(b.id) ?? b))
  }, [save])

  return { bookings, addBooking, markCancelled, removeBooking, syncWithServer }
}
