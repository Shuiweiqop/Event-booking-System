import { Link, Route, Routes } from 'react-router-dom'
import EmptyState from './components/EmptyState'
import Navbar from './components/Navbar'
import { useAuth } from './context/AuthContext'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminLoginPage from './pages/AdminLoginPage'
import CancelBookingPage from './pages/CancelBookingPage'
import EventsPage from './pages/EventsPage'
import MyBookingsPage from './pages/MyBookingsPage'

export default function App() {
  const { isAdmin } = useAuth()

  return (
    <>
      <Navbar />
      <main className="main">
        <Routes>
          <Route path="/" element={<EventsPage />} />
          <Route path="/my-bookings" element={<MyBookingsPage />} />
          <Route path="/cancel" element={<CancelBookingPage />} />
          <Route path="/admin" element={isAdmin ? <AdminDashboardPage /> : <AdminLoginPage />} />
          <Route path="*" element={
            <div className="container">
              <EmptyState title="Page not found" action={<Link className="btn btn--primary" to="/">Back to events</Link>} />
            </div>
          } />
        </Routes>
      </main>
      <footer className="footer container muted small">EventHub · Mini Event Booking System</footer>
    </>
  )
}
