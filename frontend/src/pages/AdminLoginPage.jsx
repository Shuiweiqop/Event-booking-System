import { useState } from 'react'
import Alert from '../components/Alert'
import InputField from '../components/InputField'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'

export default function AdminLoginPage() {
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.email.trim() || !form.password) {
      setError('Email and password are required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await login(form.email.trim(), form.password)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="container auth">
      <form className="card auth__card" onSubmit={submit} noValidate>
        <h1>Admin sign in</h1>
        <p className="muted small">Manage events and view registrations.</p>
        {error && <Alert type="error">{error}</Alert>}
        <InputField label="Email" type="email" autoComplete="username" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <InputField label="Password" type="password" autoComplete="current-password" required value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? <><Spinner inline /> Signing in…</> : 'Sign in'}
        </button>
        <p className="muted small center">Demo: admin@example.com / Admin@123</p>
      </form>
    </section>
  )
}
