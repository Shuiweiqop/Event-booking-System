import { useCallback, useEffect, useState } from 'react'

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

  /** Confirmed booking (if any) this browser holds for the given email + date. */
  const findConflict = useCallback(
    (email, date) =>
      bookings.find(
        (b) => b.status === 'confirmed' && b.event_date === date && b.email === email.trim().toLowerCase(),
      ),
    [bookings],
  )

  return { bookings, addBooking, markCancelled, removeBooking, findConflict }
}
