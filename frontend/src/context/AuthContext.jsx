import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { adminApi } from '../api'
import { TOKEN_KEY } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [admin, setAdmin] = useState(null)

  // Server rejected the token (expired / revoked) -> client.js fires this.
  useEffect(() => {
    const onLogout = () => {
      setToken(null)
      setAdmin(null)
    }
    window.addEventListener('eventhub:logout', onLogout)
    return () => window.removeEventListener('eventhub:logout', onLogout)
  }, [])

  // Verify a stored token on load.
  useEffect(() => {
    if (!token) return
    adminApi.me().then((b) => setAdmin(b.data)).catch(() => {})
  }, [token])

  const login = useCallback(async (email, password) => {
    const body = await adminApi.login(email, password)
    localStorage.setItem(TOKEN_KEY, body.data.token)
    setToken(body.data.token)
    setAdmin(body.data.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await adminApi.logout()
    } catch {
      /* token may already be invalid — log out locally regardless */
    }
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setAdmin(null)
  }, [])

  const value = useMemo(() => ({ isAdmin: !!token, admin, login, logout }), [token, admin, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
