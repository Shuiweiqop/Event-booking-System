import { useEffect, useState } from 'react'

/** Seconds remaining until an ISO timestamp (0 when reached or when no target). */
export default function useCountdown(targetIso) {
  const calc = () => (targetIso ? Math.max(0, Math.ceil((new Date(targetIso) - Date.now()) / 1000)) : 0)
  const [left, setLeft] = useState(calc)

  useEffect(() => {
    setLeft(calc())
    if (!targetIso) return undefined
    const t = setInterval(() => {
      const next = calc()
      setLeft(next)
      if (next === 0) clearInterval(t)
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso])

  return left
}
