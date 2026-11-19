import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eventsApi } from '../api'
import useEvents from './useEvents'

vi.mock('../api', () => ({ eventsApi: { list: vi.fn() } }))

const page = (slots) => ({ data: [{ id: 1, title: 'A', available_slots: slots }], meta: { current_page: 1, last_page: 1 } })

let hidden = false
const setHidden = (value) => {
  hidden = value
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  eventsApi.list.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

const advance = (ms) => act(() => vi.advanceTimersByTimeAsync(ms))

describe('useEvents auto-refresh', () => {
  it('loads once on mount', async () => {
    eventsApi.list.mockResolvedValue(page(5))
    const { result } = renderHook(() => useEvents({}))

    await advance(0)
    expect(result.current.loading).toBe(false)
    expect(result.current.events[0].available_slots).toBe(5)
    expect(eventsApi.list).toHaveBeenCalledTimes(1)
  })

  it('refreshes every 30 seconds and updates slot counts', async () => {
    eventsApi.list.mockResolvedValueOnce(page(5)).mockResolvedValue(page(2))
    const { result } = renderHook(() => useEvents({}))
    await advance(0)

    await advance(29_000)
    expect(eventsApi.list).toHaveBeenCalledTimes(1)

    await advance(1_000)
    expect(eventsApi.list).toHaveBeenCalledTimes(2)
    expect(result.current.events[0].available_slots).toBe(2)
  })

  it('pauses while the tab is hidden and catches up when it becomes visible', async () => {
    eventsApi.list.mockResolvedValue(page(5))
    renderHook(() => useEvents({}))
    await advance(0)

    act(() => setHidden(true))
    await advance(120_000) // 4 intervals pass while hidden
    expect(eventsApi.list).toHaveBeenCalledTimes(1)

    act(() => setHidden(false))
    await advance(0)
    expect(eventsApi.list).toHaveBeenCalledTimes(2) // immediate refresh on return
  })

  it('refreshes when the window regains focus', async () => {
    eventsApi.list.mockResolvedValue(page(5))
    renderHook(() => useEvents({}))
    await advance(0)

    act(() => window.dispatchEvent(new Event('focus')))
    await advance(0)
    expect(eventsApi.list).toHaveBeenCalledTimes(2)
  })

  it('a failed background refresh keeps the current list instead of showing an error', async () => {
    eventsApi.list.mockResolvedValueOnce(page(5)).mockRejectedValueOnce(new Error('Network down'))
    const { result } = renderHook(() => useEvents({}))
    await advance(0)

    await advance(30_000)
    expect(result.current.error).toBeNull()
    expect(result.current.refreshError).toBe('Network down')
    expect(result.current.events[0].available_slots).toBe(5)
    expect(result.current.loading).toBe(false)
  })

  it('background refreshes do not toggle the loading state', async () => {
    let resolve
    eventsApi.list.mockResolvedValueOnce(page(5)).mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    const { result } = renderHook(() => useEvents({}))
    await advance(0)

    await advance(30_000) // refresh in flight
    expect(result.current.loading).toBe(false)
    await act(async () => resolve(page(1)))
    await advance(0)
    expect(result.current.events[0].available_slots).toBe(1)
  })

  it('can be disabled with refreshInterval: 0', async () => {
    eventsApi.list.mockResolvedValue(page(5))
    renderHook(() => useEvents({}, { refreshInterval: 0 }))
    await advance(0)
    await advance(120_000)
    expect(eventsApi.list).toHaveBeenCalledTimes(1)
  })

  it('stops refreshing after unmount', async () => {
    eventsApi.list.mockResolvedValue(page(5))
    const { unmount } = renderHook(() => useEvents({}))
    await advance(0)
    unmount()
    await advance(90_000)
    expect(eventsApi.list).toHaveBeenCalledTimes(1)
  })
})
