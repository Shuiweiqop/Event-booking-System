import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrationsApi } from '../api'
import RegistrationForm from './RegistrationForm'

vi.mock('../api', () => ({ registrationsApi: { requestCode: vi.fn(), get: vi.fn() } }))

const event = { id: 9, title: 'Laravel Meetup', event_date: '2099-03-10', start_time: null, available_slots: 5 }

beforeEach(() => {
  localStorage.clear()
  registrationsApi.requestCode.mockReset()
})

const fillAndSubmit = async () => {
  await userEvent.type(screen.getByLabelText(/Full name/), 'Jane')
  await userEvent.type(screen.getByLabelText(/Email/), 'jane@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }))
}

describe('<RegistrationForm />', () => {
  it('lets the server decide even if a (possibly stale) local booking exists on that date', async () => {
    // Local cache says Jane has another event on this date — but an admin may have moved it.
    localStorage.setItem('eventhub.bookings', JSON.stringify([
      { id: 1, event_id: 3, email: 'jane@example.com', event_date: '2099-03-10', status: 'confirmed' },
    ]))
    registrationsApi.requestCode.mockResolvedValue({
      data: { verification_id: 'v1', email_masked: 'j***@example.com', expires_at: null, resend_available_at: null },
    })
    render(<RegistrationForm event={event} onClose={() => {}} />)

    await fillAndSubmit()

    expect(registrationsApi.requestCode).toHaveBeenCalledWith({ eventId: 9, name: 'Jane', email: 'jane@example.com' })
    expect(await screen.findByText(/We sent a 6-digit code to/)).toBeInTheDocument()
  })

  it("shows the server's same-date error", async () => {
    registrationsApi.requestCode.mockRejectedValue(Object.assign(
      new Error('You already registered for an event on this date.'), { status: 409, errors: {} },
    ))
    render(<RegistrationForm event={event} onClose={() => {}} />)

    await fillAndSubmit()

    expect(await screen.findByText('You already registered for an event on this date.')).toBeInTheDocument()
  })

  it('validates required fields before calling the API', async () => {
    render(<RegistrationForm event={event} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }))

    expect(screen.getByText('Name is required.')).toBeInTheDocument()
    expect(screen.getByText('Email is required.')).toBeInTheDocument()
    expect(registrationsApi.requestCode).not.toHaveBeenCalled()
  })
})
