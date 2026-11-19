import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrationsApi } from '../api'
import CancelBookingPage from './CancelBookingPage'

vi.mock('../api', () => ({ registrationsApi: { get: vi.fn(), cancel: vi.fn() } }))

const booking = (overrides = {}) => ({
  id: 5,
  name: 'Jane',
  email: 'jane@example.com',
  event_date: '2099-01-15',
  status: 'confirmed',
  event: { id: 1, title: 'React Hooks Deep Dive', event_date: '2099-01-15', venue: 'Hall A' },
  ...overrides,
})

let location
function LocationSpy() {
  location = useLocation()
  return null
}

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/cancel" element={<><CancelBookingPage /><LocationSpy /></>} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  registrationsApi.get.mockReset()
  registrationsApi.cancel.mockReset()
  sessionStorage.clear()
  localStorage.clear()
})

describe('<CancelBookingPage />', () => {
  it('shows the booking but does NOT cancel just by opening the link', async () => {
    registrationsApi.get.mockResolvedValue({ data: booking() })
    renderAt('/cancel?id=5&token=secret')

    expect(await screen.findByText('React Hooks Deep Dive')).toBeInTheDocument()
    expect(registrationsApi.get).toHaveBeenCalledWith('5', 'secret')
    expect(registrationsApi.cancel).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Yes, cancel my booking' })).toBeEnabled()
  })

  it('removes the token from the address bar', async () => {
    registrationsApi.get.mockResolvedValue({ data: booking() })
    renderAt('/cancel?id=5&token=secret')

    await screen.findByText('React Hooks Deep Dive')
    expect(location.search).toBe('')
  })

  it('cancels after the explicit click', async () => {
    registrationsApi.get.mockResolvedValue({ data: booking() })
    registrationsApi.cancel.mockResolvedValue({ data: booking({ status: 'cancelled' }) })
    renderAt('/cancel?id=5&token=secret')

    await userEvent.click(await screen.findByRole('button', { name: 'Yes, cancel my booking' }))

    expect(registrationsApi.cancel).toHaveBeenCalledWith(5, 'secret')
    expect(await screen.findByText('Your booking has been cancelled.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes, cancel my booking' })).not.toBeInTheDocument()
  })

  it('shows an error for an invalid link', async () => {
    registrationsApi.get.mockRejectedValue(Object.assign(new Error('Booking not found or cancellation code is invalid.'), { status: 404 }))
    renderAt('/cancel?id=5&token=wrong')

    expect(await screen.findByText('This cancel link is not valid')).toBeInTheDocument()
    expect(screen.getByText(/Booking not found or cancellation code is invalid/)).toBeInTheDocument()
  })

  it('treats a link without a token as invalid without calling the API', () => {
    renderAt('/cancel?id=5')

    expect(screen.getByText('This cancel link is not valid')).toBeInTheDocument()
    expect(registrationsApi.get).not.toHaveBeenCalled()
  })

  it('says so when the booking is already cancelled', async () => {
    registrationsApi.get.mockResolvedValue({ data: booking({ status: 'cancelled' }) })
    renderAt('/cancel?id=5&token=secret')

    expect(await screen.findByText(/already cancelled/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes, cancel my booking' })).not.toBeInTheDocument()
  })

  it('does not offer cancellation for a past event', async () => {
    registrationsApi.get.mockResolvedValue({ data: booking({ event_date: '2000-01-01' }) })
    renderAt('/cancel?id=5&token=secret')

    expect(await screen.findByText(/already taken place/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes, cancel my booking' })).not.toBeInTheDocument()
  })
})
