import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrationsApi } from '../api'
import useMyBookings from './useMyBookings'

vi.mock('../api', () => ({ registrationsApi: { get: vi.fn() } }))

const stored = (list) => localStorage.setItem('eventhub.bookings', JSON.stringify(list))
const booking = (o = {}) => ({
  id: 1, event_id: 7, email: 'jane@example.com', event_date: '2099-01-10', status: 'confirmed',
  cancel_token: 'tok', event: { id: 7, title: 'Meetup', event_date: '2099-01-10' }, ...o,
})

beforeEach(() => {
  localStorage.clear()
  registrationsApi.get.mockReset()
})

describe('useMyBookings.syncWithServer', () => {
  it('picks up a date moved by the admin and a cancellation done elsewhere', async () => {
    stored([booking(), booking({ id: 2, cancel_token: 'tok2' })])
    registrationsApi.get.mockImplementation(async (id) => ({
      data: id === 1
        ? { status: 'confirmed', event_date: '2099-02-20', event: { id: 7, title: 'Meetup', event_date: '2099-02-20' } }
        : { status: 'cancelled', event_date: '2099-01-10', event: { id: 7, title: 'Meetup', event_date: '2099-01-10' } },
    }))
    const { result } = renderHook(() => useMyBookings())

    await act(() => result.current.syncWithServer())

    expect(registrationsApi.get).toHaveBeenCalledWith(1, 'tok')
    const [a, b] = result.current.bookings
    expect(a.event_date).toBe('2099-02-20')
    expect(a.event.event_date).toBe('2099-02-20')
    expect(b.status).toBe('cancelled')
    expect(JSON.parse(localStorage.getItem('eventhub.bookings'))[0].event_date).toBe('2099-02-20')
  })

  it('marks a booking as removed when the server no longer has it (event deleted)', async () => {
    stored([booking()])
    registrationsApi.get.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }))
    const { result } = renderHook(() => useMyBookings())

    await act(() => result.current.syncWithServer())

    expect(result.current.bookings[0].status).toBe('removed')
  })

  it('keeps the cached copy when the server cannot be reached', async () => {
    stored([booking()])
    registrationsApi.get.mockRejectedValue(Object.assign(new Error('offline'), { status: 0 }))
    const { result } = renderHook(() => useMyBookings())

    await act(() => result.current.syncWithServer())

    expect(result.current.bookings[0]).toMatchObject({ status: 'confirmed', event_date: '2099-01-10' })
  })
})
