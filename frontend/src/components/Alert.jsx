const ICONS = { success: '✓', error: '!', info: 'i', warning: '!' }

export default function Alert({ type = 'info', title, children, onClose }) {
  return (
    <div className={`alert alert--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span className="alert__icon" aria-hidden="true">{ICONS[type]}</span>
      <div className="alert__body">
        {title && <strong className="alert__title">{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {onClose && (
        <button type="button" className="alert__close" onClick={onClose} aria-label="Dismiss">×</button>
      )}
    </div>
  )
}
