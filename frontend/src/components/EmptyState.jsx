export default function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">◇</div>
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  )
}
