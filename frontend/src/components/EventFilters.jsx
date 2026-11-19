import { useEffect, useState } from 'react'

/** Search + date filter. Search input is debounced so we don't fire a request per keystroke. */
export default function EventFilters({ value, onChange }) {
  const [search, setSearch] = useState(value.search)

  useEffect(() => {
    const t = setTimeout(() => search !== value.search && onChange({ ...value, search }), 350)
    return () => clearTimeout(t)
  }, [search, value, onChange])

  const hasFilters = value.search || value.date || value.include_past

  return (
    <div className="filters" role="search">
      <input
        type="search"
        className="filters__search"
        placeholder="Search by title or venue…"
        aria-label="Search events"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <input
        type="date"
        aria-label="Filter by date"
        value={value.date}
        onChange={(e) => onChange({ ...value, date: e.target.value })}
      />
      <label className="filters__check">
        <input
          type="checkbox"
          checked={value.include_past}
          onChange={(e) => onChange({ ...value, include_past: e.target.checked })}
        />
        Show past events
      </label>
      {hasFilters && (
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setSearch('')
            onChange({ search: '', date: '', include_past: false })
          }}
        >
          Clear
        </button>
      )}
    </div>
  )
}
