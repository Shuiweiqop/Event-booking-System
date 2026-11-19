/**
 * Split "my bookings" into what's still ahead and the history.
 *
 * upcoming: confirmed and not yet past, soonest first
 * history:  past, cancelled or removed (event deleted), most recent first
 *
 * `today` must be in the app timezone (see todayYmd) so "past" matches the server.
 * Each item gets a `displayStatus`: a confirmed booking whose date has passed shows as "past".
 */
export function groupBookings(bookings, today) {
  const upcoming = []
  const history = []

  for (const b of bookings) {
    const isPast = b.event_date < today
    if (b.status === 'confirmed' && !isPast) {
      upcoming.push({ ...b, displayStatus: 'confirmed' })
    } else {
      history.push({ ...b, displayStatus: b.status === 'confirmed' ? 'past' : b.status })
    }
  }

  const byDate = (a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? '') || a.id - b.id
  upcoming.sort(byDate)
  history.sort((a, b) => byDate(b, a))

  return { upcoming, history }
}
