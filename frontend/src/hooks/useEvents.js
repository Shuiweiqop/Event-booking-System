import { useCallback, useEffect, useState } from 'react'
import { eventsApi } from '../api'

/**
 * Loads events for the given filters. Re-fetches when filters change and
 * aborts the in-flight request so stale responses never overwrite new ones.
 */
export default function useEvents(filters = {}) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const key = JSON.stringify(filters)

  useEffect(() => {
    const controller = new AbortController()
    const params = Object.fromEntries(Object.entries(JSON.parse(key)).filter(([, v]) => v !== '' && v != null))

    setLoading(true)
    setError(null)
    eventsApi
      .list(params, controller.signal)
      .then((body) => setEvents(body.data))
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [key, reloadKey])

  const refetch = useCallback(() => setReloadKey((k) => k + 1), [])

  return { events, loading, error, refetch }
}
