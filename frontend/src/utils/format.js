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

export const todayYmd = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
