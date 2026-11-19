import { useEffect, useState } from 'react'

const ago = (date) => {
  const s = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

/** "Live · updated 12s ago" — shows that slot counts refresh on their own. */
export default function LiveIndicator({ lastUpdated, refreshError }) {
  const [, tick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])

  if (!lastUpdated) return null

  return (
    <p className={`live ${refreshError ? 'live--stale' : ''}`} aria-live="polite">
      <span className="live__dot" aria-hidden="true" />
      {refreshError
        ? `Couldn't refresh (showing data from ${ago(lastUpdated)})`
        : `Live · slots updated ${ago(lastUpdated)}`}
    </p>
  )
}
