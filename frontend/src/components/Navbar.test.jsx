import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../context/AuthContext'
import Navbar from './Navbar'

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))

const renderNavbar = () => render(<MemoryRouter><Navbar /></MemoryRouter>)

beforeEach(() => localStorage.clear())

describe('<Navbar />', () => {
  it('does not advertise the admin area to regular visitors', () => {
    useAuth.mockReturnValue({ isAdmin: false, logout: vi.fn() })
    renderNavbar()

    expect(screen.getByRole('link', { name: 'Events' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /My Bookings/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  })

  it('shows Admin and Log out once an admin is logged in', async () => {
    const logout = vi.fn()
    useAuth.mockReturnValue({ isAdmin: true, logout })
    renderNavbar()

    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin')
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(logout).toHaveBeenCalled()
  })

  it('badge counts upcoming bookings only (not cancelled, not past)', () => {
    useAuth.mockReturnValue({ isAdmin: false, logout: vi.fn() })
    localStorage.setItem('eventhub.bookings', JSON.stringify([
      { id: 1, status: 'confirmed', event_date: '2099-01-01' },
      { id: 2, status: 'cancelled', event_date: '2099-01-02' },
      { id: 3, status: 'confirmed', event_date: '2099-01-03' },
      { id: 4, status: 'confirmed', event_date: '2000-01-01' }, // past
    ]))
    renderNavbar()

    expect(screen.getByRole('link', { name: /My Bookings/ })).toHaveTextContent('2')
  })
})
