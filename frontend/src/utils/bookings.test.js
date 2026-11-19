import { describe, expect, it } from 'vitest'
import { groupBookings } from './bookings'

const b = (id, event_date, status = 'confirmed') => ({ id, event_date, status })
const TODAY = '2026-11-19'

describe('groupBookings', () => {
  it('puts confirmed future bookings in upcoming, soonest first', () => {
    const { upcoming } = groupBookings([b(1, '2026-12-10'), b(2, '2026-11-25'), b(3, '2026-11-19')], TODAY)
    expect(upcoming.map((x) => x.id)).toEqual([3, 2, 1]) // today counts as upcoming
  })

  it('puts past, cancelled and removed bookings in history, most recent first', () => {
    const { upcoming, history } = groupBookings([
      b(1, '2026-11-01'), // past
      b(2, '2026-12-01', 'cancelled'), // future but cancelled
      b(3, '2026-11-10', 'removed'), // event deleted
      b(4, '2026-12-20'), // upcoming
    ], TODAY)

    expect(upcoming.map((x) => x.id)).toEqual([4])
    expect(history.map((x) => x.id)).toEqual([2, 3, 1])
  })

  it('labels a confirmed booking whose date has passed as "past"', () => {
    const { history } = groupBookings([b(1, '2026-11-01'), b(2, '2026-11-02', 'cancelled')], TODAY)
    expect(history.find((x) => x.id === 1).displayStatus).toBe('past')
    expect(history.find((x) => x.id === 2).displayStatus).toBe('cancelled')
  })

  it('handles an empty list', () => {
    expect(groupBookings([], TODAY)).toEqual({ upcoming: [], history: [] })
  })
})
