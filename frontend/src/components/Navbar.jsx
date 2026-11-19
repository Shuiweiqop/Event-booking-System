import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useMyBookings from '../hooks/useMyBookings'
import { groupBookings } from '../utils/bookings'
import { todayYmd } from '../utils/format'

export default function Navbar() {
  const { isAdmin, logout } = useAuth()
  const { bookings } = useMyBookings()
  // Badge = upcoming bookings only (a confirmed booking for a past event is history).
  const active = groupBookings(bookings, todayYmd()).upcoming.length

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <NavLink to="/" className="brand">
          <span className="brand__mark" aria-hidden="true">◆</span> EventHub
        </NavLink>
        <nav className="navbar__links">
          <NavLink to="/" end>Events</NavLink>
          <NavLink to="/my-bookings">
            My Bookings {active > 0 && <span className="badge">{active}</span>}
          </NavLink>
          {/* No public entry point to the back office: admins open /admin directly.
              (UX only — the API itself is protected by Sanctum + the `admin` middleware.) */}
          {isAdmin && (
            <>
              <NavLink to="/admin">Admin</NavLink>
              <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>Log out</button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
