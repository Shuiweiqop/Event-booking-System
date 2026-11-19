export const EMPTY_EVENT = { title: '', description: '', venue: '', event_date: '', start_time: '', max_attendees: '' }

/** API event -> form values (nulls become empty strings). */
export const toFormValues = (event) => ({
  title: event.title ?? '',
  description: event.description ?? '',
  venue: event.venue ?? '',
  event_date: event.event_date ?? '',
  start_time: event.start_time ?? '',
  max_attendees: String(event.max_attendees ?? ''),
})
