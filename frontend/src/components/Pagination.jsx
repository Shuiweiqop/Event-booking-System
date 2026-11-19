import { pageItems } from '../utils/pagination'

/** Prev / numbered pages / Next. Renders nothing when everything fits on one page. */
export default function Pagination({ meta, onChange, disabled = false, label = 'items' }) {
  if (!meta || meta.last_page <= 1) return null

  const { current_page: current, last_page: last, from, to, total } = meta

  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination__summary muted small">
        Showing {from}–{to} of {total} {label}
      </p>
      <div className="pagination__controls">
        <button type="button" className="btn btn--ghost btn--sm" disabled={disabled || current <= 1}
          onClick={() => onChange(current - 1)}>
          ← Prev
        </button>
        {pageItems(current, last).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="pagination__gap" aria-hidden="true">…</span>
          ) : (
            <button key={p} type="button" disabled={disabled}
              className={`btn btn--sm ${p === current ? 'btn--primary' : 'btn--ghost'}`}
              aria-current={p === current ? 'page' : undefined}
              aria-label={`Page ${p}`}
              onClick={() => p !== current && onChange(p)}>
              {p}
            </button>
          ),
        )}
        <button type="button" className="btn btn--ghost btn--sm" disabled={disabled || current >= last}
          onClick={() => onChange(current + 1)}>
          Next →
        </button>
      </div>
    </nav>
  )
}
