import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Accessible dialog:
 * - closes on Esc / backdrop click
 * - traps Tab / Shift+Tab inside the dialog while open
 * - focuses the first field (or the dialog) on open and returns focus to the element that
 *   opened it (e.g. the "Register" button) on close
 */
export default function Modal({ title, onClose, children }) {
  const ref = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const opener = document.activeElement
    const dialog = ref.current
    const focusables = () => [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[hidden]'))

    // Prefer the first form field over the close button.
    const firstField = dialog.querySelector('input:not([disabled]), textarea:not([disabled]), select:not([disabled])')
    ;(firstField ?? dialog).focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const inside = dialog.contains(document.activeElement)

      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus()
    }
  }, []) // run once per open; onClose is read through a ref

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={ref}>
        <header className="modal__header">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
