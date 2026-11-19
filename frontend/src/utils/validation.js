const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Client-side checks give instant feedback; the API re-validates everything. */
export function validateRegistration({ name, email }) {
  const errors = {}
  if (!name.trim()) errors.name = 'Name is required.'
  else if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters.'
  else if (name.trim().length > 100) errors.name = 'Name must be at most 100 characters.'

  if (!email.trim()) errors.email = 'Email is required.'
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Please enter a valid email address.'

  return errors
}

/** `minCapacity`: when editing, capacity can't go below the confirmed bookings. */
export function validateEvent({ title, event_date, max_attendees, start_time }, today, { minCapacity = 0 } = {}) {
  const errors = {}
  if (!title.trim()) errors.title = 'Title is required.'
  if (!event_date) errors.event_date = 'Date is required.'
  else if (event_date < today) errors.event_date = 'Date cannot be in the past.'
  if (start_time && !/^\d{2}:\d{2}$/.test(start_time)) errors.start_time = 'Use HH:MM.'
  const n = Number(max_attendees)
  if (max_attendees === '' || !Number.isInteger(n) || n < 1) errors.max_attendees = 'Capacity must be a whole number ≥ 1.'
  else if (n < minCapacity) errors.max_attendees = `Capacity can't be lower than the ${minCapacity} confirmed booking(s).`
  return errors
}

/** Map a 422 response's { field: [msg] } into { field: msg }. */
export const firstErrors = (errors = {}) =>
  Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
