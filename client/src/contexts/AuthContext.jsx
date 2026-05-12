import { createContext, useContext, useState, useEffect } from 'react'
import api, { setRefreshToken, clearRefreshToken, getRefreshToken } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kbh_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('kbh_token')
    if (!token) { setLoading(false); return }
    api.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => { localStorage.removeItem('kbh_token'); localStorage.removeItem('kbh_user'); setUser(null) })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    localStorage.setItem('kbh_token', res.data.token)
    localStorage.setItem('kbh_user', JSON.stringify(res.data.user))
    if (res.data.refreshToken) setRefreshToken(res.data.refreshToken)
    setUser(res.data.user)
    // Fetch full user with groups
    const me = await api.get('/auth/me')
    setUser(me.data)
    localStorage.setItem('kbh_user', JSON.stringify(me.data))
    return me.data
  }

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password })
    localStorage.setItem('kbh_token', res.data.token)
    localStorage.setItem('kbh_user', JSON.stringify(res.data.user))
    if (res.data.refreshToken) setRefreshToken(res.data.refreshToken)
    setUser(res.data.user)
    return res.data.user
  }

  const logout = async () => {
    // Revoke the refresh token server-side before clearing local state
    const rt = getRefreshToken()
    if (rt) {
      try {
        await api.post('/auth/logout', { refreshToken: rt })
      } catch {
        // Revocation failed (network error, etc.) — proceed with local logout anyway
      }
    }
    localStorage.removeItem('kbh_token')
    localStorage.removeItem('kbh_user')
    clearRefreshToken()
    setUser(null)
  }

  const refreshUser = async () => {
    const me = await api.get('/auth/me')
    setUser(me.data)
    localStorage.setItem('kbh_user', JSON.stringify(me.data))
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
