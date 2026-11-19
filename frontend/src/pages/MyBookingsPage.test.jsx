import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrationsApi } from '../api'
import MyBookingsPage from './MyBookingsPage'

vi.mock('../api', () => ({ registrationsApi: { get: vi.fn(), cancel: vi.fn() } }))

const booking = (id, title, event_date, status = 'confirmed') => ({
  id, event_id: id, email: 'jane@example.com', event_date, status, cancel_token: `t${id}`,
  event: { id, title, event_date },
})

beforeEach(() => {
  // Server unreachable -> the page keeps the cached copy (sync behaviour is tested in useMyBookings.test).
  registrationsApi.get.mockReset().mockRejectedValue(Object.assign(new Error('offline'), { status: 0 }))
  localStorage.setItem('eventhub.bookings', JSON.stringify([
    booking(1, 'Old Workshop', '2000-01-01'), // past
    booking(2, 'Far Future Meetup', '2099-12-01'),
    booking(3, 'Cancelled Talk', '2099-06-01', 'cancelled'),
    booking(4, 'Soon Conference', '2099-01-15'),
    booking(5, 'Deleted Event', '2099-03-01', 'removed'),
  ]))
})

const renderPage = () => render(<MemoryRouter><MyBookingsPage /></MemoryRouter>)

describe('<MyBookingsPage />', () => {
  it('lists upcoming bookings first, soonest first, with cancel buttons', async () => {
    renderPage()
    const upcoming = screen.getByRole('region', { name: /Upcoming/ })

    const titles = within(upcoming).getAllByRole('listitem').map((li) => within(li).getByRole('strong', { hidden: true }).textContent)
    expect(titles).toEqual(['Soon Conference', 'Far Future Meetup'])
    expect(within(upcoming).getAllByRole('button', { name: 'Cancel' })).toHaveLength(2)
    expect(screen.getByText('(2)')).toBeInTheDocument()
  })

  it('collects past, cancelled and removed bookings in a collapsed history, newest first', () => {
    const { container } = renderPage()
    const history = container.querySelector('details.booking-history')

    expect(history).not.toHaveAttribute('open')
    expect(within(history).getByText(/History/)).toBeInTheDocument()
    const titles = [...history.querySelectorAll('li strong')].map((el) => el.textContent)
    expect(titles).toEqual(['Cancelled Talk', 'Deleted Event', 'Old Workshop'])
  })

  it('shows a past confirmed booking as "past", not "confirmed", and offers no cancel', () => {
    const { container } = renderPage()
    const old = [...container.querySelectorAll('details li')].find((li) => li.textContent.includes('Old Workshop'))

    expect(within(old).getByText('past')).toBeInTheDocument()
    expect(within(old).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    // attended, not cancelled: no strike-through style
    expect(old).toHaveClass('booking--past')
    expect(old).not.toHaveClass('booking--cancelled')
  })

  it('says when there is nothing upcoming but keeps the history', () => {
    localStorage.setItem('eventhub.bookings', JSON.stringify([booking(1, 'Old Workshop', '2000-01-01')]))
    const { container } = renderPage()

    expect(screen.getByText(/No upcoming bookings/)).toBeInTheDocument()
    expect(container.querySelector('details.booking-history')).toBeInTheDocument()
  })
})
