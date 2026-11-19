import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { toFormValues } from '../utils/eventForm'
import EventForm from './EventForm'

const event = {
  id: 1, title: 'Laravel Meetup', description: 'Talks', venue: 'Hall A',
  event_date: '2099-03-10', start_time: '10:00', max_attendees: 30, registered_count: 12,
}

const renderEdit = (onSubmit = vi.fn().mockResolvedValue()) =>
  render(
    <EventForm mode="edit" initial={toFormValues(event)} bookedCount={event.registered_count}
      submitLabel="Save changes" busyLabel="Saving…" onSubmit={onSubmit} onCancel={() => {}} />,
  )

describe('<EventForm /> edit mode', () => {
  it('is pre-filled with the event', () => {
    renderEdit()
    expect(screen.getByLabelText(/Title/)).toHaveValue('Laravel Meetup')
    expect(screen.getByLabelText(/Max attendees/)).toHaveValue(30)
    expect(screen.getByText('At least 12 (confirmed bookings).')).toBeInTheDocument()
  })

  it('blocks capacity below the confirmed bookings without calling the API', async () => {
    const onSubmit = vi.fn()
    renderEdit(onSubmit)

    const cap = screen.getByLabelText(/Max attendees/)
    await userEvent.clear(cap)
    await userEvent.type(cap, '5')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(screen.getByText("Capacity can't be lower than the 12 confirmed booking(s).")).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('warns that bookings move when the date changes', async () => {
    renderEdit()
    const date = screen.getByLabelText(/Date/)
    await userEvent.clear(date)
    await userEvent.type(date, '2099-04-01')

    expect(screen.getByText('12 booking(s) will move to the new date.')).toBeInTheDocument()
  })

  it('sends cleared optional fields as null so they can be removed', async () => {
    const onSubmit = vi.fn().mockResolvedValue()
    renderEdit(onSubmit)

    await userEvent.clear(screen.getByLabelText(/Venue/))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ venue: null, max_attendees: 30, title: 'Laravel Meetup' }))
  })

  it('shows the server error (e.g. date conflict) and keeps the form open', async () => {
    const onSubmit = vi.fn().mockRejectedValue(Object.assign(
      new Error("Can't move the event to 2099-04-01: 2 attendee(s) already have another booking on that date."),
      { status: 409, errors: {} },
    ))
    renderEdit(onSubmit)

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText(/2 attendee\(s\) already have another booking/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Title/)).toHaveValue('Laravel Meetup')
  })
})

describe('<EventForm /> create mode', () => {
  it('omits empty optional fields and resets after success', async () => {
    const onSubmit = vi.fn().mockResolvedValue()
    render(<EventForm submitLabel="Create event" busyLabel="Creating…" onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText(/Title/), 'New Event')
    await userEvent.type(screen.getByLabelText(/Date/), '2099-05-05')
    await userEvent.type(screen.getByLabelText(/Max attendees/), '20')
    await userEvent.click(screen.getByRole('button', { name: 'Create event' }))

    expect(onSubmit).toHaveBeenCalledWith({ title: 'New Event', event_date: '2099-05-05', max_attendees: 20 })
    expect(screen.getByLabelText(/Title/)).toHaveValue('')
  })
})
