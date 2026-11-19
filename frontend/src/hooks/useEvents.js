import { useCallback, useEffect, useRef, useState } from 'react'
import { eventsApi } from '../api'

export const DEFAULT_REFRESH_MS = 30_000

/**
 * Loads events for the given filters and keeps them fresh.
 *
 * - Re-fetches when filters change; aborts the in-flight request so stale responses never win.
 * - Auto-refresh: every `refreshInterval` ms while the tab is visible, and immediately when the
 *   tab becomes visible again / the window regains focus. Paused while the tab is hidden.
 * - Background refreshes are "silent": no loading state, and a failed refresh keeps the
 *   current list (exposed as `refreshError`) instead of replacing it with an error screen.
 */
export default function useEvents(filters = {}, { refreshInterval = DEFAULT_REFRESH_MS } = {}) {
  const [events, setEvents] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshError, setRefreshError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const controllerRef = useRef(null)

  const key = JSON.stringify(filters)

  const load = useCallback(
    (silent) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      const params = Object.fromEntries(Object.entries(JSON.parse(key)).filter(([, v]) => v !== '' && v != null))

      if (!silent) {
        setLoading(true)
        setError(null)
      }

      return eventsApi
        .list(params, controller.signal)
        .then((body) => {
          setEvents(body.data)
          setMeta(body.meta ?? null)
          setError(null)
          setRefreshError(null)
          setLastUpdated(new Date())
        })
        .catch((err) => {
          if (controller.signal.aborted) return
          if (silent) setRefreshError(err.message)
          else setError(err.message)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    },
    [key],
  )

  // Initial load + whenever filters change or refetch() is called.
  useEffect(() => {
    load(false)
    return () => controllerRef.current?.abort()
  }, [load, reloadKey])

  // Auto-refresh.
  useEffect(() => {
    if (!refreshInterval) return undefined

    let timer = null
    const stop = () => {
      clearInterval(timer)
      timer = null
    }
    const start = () => {
      stop()
      timer = setInterval(() => load(true), refreshInterval)
    }
    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        load(true) // catch up immediately after the user comes back
        start()
      }
    }
    const onFocus = () => {
      if (!document.hidden) load(true)
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [load, refreshInterval])

  const refetch = useCallback(() => setReloadKey((k) => k + 1), [])

  return { events, meta, loading, error, refreshError, lastUpdated, refetch }
}
