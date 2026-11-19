import { useState } from 'react'
import { registrationsApi } from '../api'
import useCountdown from '../hooks/useCountdown'
import Alert from './Alert'
import InputField from './InputField'
import Spinner from './Spinner'

/**
 * Step 2 of registration: enter the 6-digit code that was emailed.
 * Handles wrong code (attempts left), expiry, and resend with a cooldown timer.
 */
export default function VerifyCodeStep({ pending, onPendingChange, onVerified, onBack, onRefreshEvents }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const resendIn = useCountdown(pending.resend_available_at)

  const submit = async (e) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setError('Please enter the 6-digit code.')
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      onVerified(await registrationsApi.verify(pending.verification_id, code))
    } catch (err) {
      setError(err.message)
      setCode('')
      // Seat may have gone while the user was checking email.
      if (err.status === 409) onRefreshEvents?.()
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setResending(true)
    setError(null)
    try {
      const body = await registrationsApi.resendCode(pending.verification_id)
      onPendingChange(body.data)
      setCode('')
      setInfo(body.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <p className="verify-intro">
        We sent a 6-digit code to <strong>{pending.email_masked}</strong>. Enter it below to confirm your booking.
      </p>

      {pending.debug_code && (
        <Alert type="warning" title="Demo mode">
          Email isn&apos;t really sent in this demo. Your code is{' '}
          <button type="button" className="link-btn" onClick={() => setCode(pending.debug_code)}>
            <code className="code">{pending.debug_code}</code>
          </button>{' '}
          (click to fill).
        </Alert>
      )}
      {info && <Alert type="info">{info}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      <InputField
        label="Verification code"
        className="field--code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        autoFocus
        value={code}
        disabled={busy}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
          setError(null)
        }}
      />

      <div className="verify-links">
        <button type="button" className="link-btn" onClick={onBack} disabled={busy}>← Change details</button>
        <button type="button" className="link-btn" onClick={resend} disabled={busy || resending || resendIn > 0}>
          {resending ? 'Sending…' : resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
        </button>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy || code.length !== 6}>
          {busy ? <><Spinner inline /> Confirming…</> : 'Confirm booking'}
        </button>
      </div>
    </form>
  )
}
