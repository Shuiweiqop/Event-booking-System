import axios from 'axios'

export const TOKEN_KEY = 'eventhub.adminToken'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Attach the admin bearer token (if logged in) to every request.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/**
 * Normalise every failure into an Error with { message, status, errors }
 * so components never need to dig through axios internals.
 */
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) return Promise.reject(error)

    const status = error.response?.status ?? 0
    const body = error.response?.data
    let message = body?.message

    if (!message) {
      message = status === 0
        ? 'Cannot reach the server. Please check your connection and that the API is running.'
        : 'Something went wrong. Please try again.'
    }

    if (status === 401 && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('eventhub:logout'))
    }

    const err = new Error(message)
    err.status = status
    err.errors = body?.errors ?? {}
    return Promise.reject(err)
  },
)

export default client
