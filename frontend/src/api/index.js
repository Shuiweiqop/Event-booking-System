import client from './client'

// Every endpoint resolves to the backend's { success, message, data } body.
const unwrap = (promise) => promise.then((res) => res.data)

export const eventsApi = {
  list: (params, signal) => unwrap(client.get('/events', { params, signal })),
  get: (id) => unwrap(client.get(`/events/${id}`)),
}

export const registrationsApi = {
  // Step 1: checks the rules and emails a 6-digit code (no seat taken yet).
  requestCode: ({ eventId, name, email }) =>
    unwrap(client.post('/registrations', { event_id: eventId, name, email })),
  // Step 2: confirms the booking.
  verify: (verificationId, code) =>
    unwrap(client.post('/registrations/verify', { verification_id: verificationId, code })),
  resendCode: (verificationId) =>
    unwrap(client.post(`/registrations/verifications/${verificationId}/resend`)),
  cancel: (id, cancelToken) =>
    unwrap(client.post(`/registrations/${id}/cancel`, { cancel_token: cancelToken })),
}

export const adminApi = {
  login: (email, password) => unwrap(client.post('/admin/login', { email, password })),
  logout: () => unwrap(client.post('/admin/logout')),
  me: () => unwrap(client.get('/admin/me')),
  createEvent: (payload) => unwrap(client.post('/admin/events', payload)),
  deleteEvent: (id) => unwrap(client.delete(`/admin/events/${id}`)),
  eventRegistrations: (id) => unwrap(client.get(`/admin/events/${id}/registrations`)),
}
