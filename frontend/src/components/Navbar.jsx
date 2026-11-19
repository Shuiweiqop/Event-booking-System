import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useMyBookings from '../hooks/useMyBookings'

export default function Navbar() {
  const { isAdmin, logout } = useAuth()
  const { bookings } = useMyBookings()
  const active = bookings.filter((b) => b.status === 'confirmed').length

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
          <NavLink to="/admin">Admin</NavLink>
          {isAdmin && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>Log out</button>
          )}
        </nav>
      </div>
    </header>
  )
}
