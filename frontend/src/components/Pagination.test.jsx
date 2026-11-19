import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { pageItems } from '../utils/pagination'
import Pagination from './Pagination'

const meta = (current, last, extra = {}) => ({
  current_page: current, last_page: last, per_page: 8, total: last * 8, from: (current - 1) * 8 + 1, to: current * 8, ...extra,
})

describe('pageItems', () => {
  it('shows every page when there are few', () => {
    expect(pageItems(1, 3)).toEqual([1, 2, 3])
  })
  it('collapses gaps with an ellipsis around the current page', () => {
    expect(pageItems(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10])
  })
  it('handles the first and last page', () => {
    expect(pageItems(1, 10)).toEqual([1, 2, '…', 10])
    expect(pageItems(10, 10)).toEqual([1, '…', 9, 10])
  })
})

describe('<Pagination />', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(<Pagination meta={meta(1, 1)} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a summary and marks the current page', () => {
    render(<Pagination meta={meta(2, 3, { total: 20, from: 9, to: 16 })} onChange={() => {}} label="events" />)
    expect(screen.getByText('Showing 9–16 of 20 events')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
  })

  it('disables Prev on the first page and Next on the last page', () => {
    const { rerender } = render(<Pagination meta={meta(1, 3)} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '← Prev' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next →' })).toBeEnabled()

    rerender(<Pagination meta={meta(3, 3)} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled()
  })

  it('calls onChange with the requested page', async () => {
    const onChange = vi.fn()
    render(<Pagination meta={meta(2, 3)} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Next →' }))
    await userEvent.click(screen.getByRole('button', { name: '← Prev' }))
    await userEvent.click(screen.getByRole('button', { name: 'Page 3' }))
    await userEvent.click(screen.getByRole('button', { name: 'Page 2' })) // current page: no call

    expect(onChange.mock.calls).toEqual([[3], [1], [3]])
  })
})
