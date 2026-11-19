// event_date is a plain "YYYY-MM-DD" (no timezone) — parse as a local date.
const toLocalDate = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const formatDate = (ymd) =>
  toLocalDate(ymd).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export const dateParts = (ymd) => {
  const d = toLocalDate(ymd)
  return {
    day: d.getDate(),
    month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
  }
}

export const formatTime = (hhmm) => {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Must match the backend's APP_TIMEZONE: the server decides what "today" / "past" means. */
export const APP_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE || 'Asia/Kuala_Lumpur'

/**
 * Today's date (YYYY-MM-DD) in the app timezone — NOT the browser's. Otherwise an admin in
 * UTC+13 would see today's events as "past", and one west of Malaysia would be allowed to pick
 * a date the server then rejects.
 */
export const todayYmd = (now = new Date(), timeZone = APP_TIMEZONE) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
