import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// This page handles /accept-invite?token=XXX&email=YYY
// The server's GET /api/groups/accept-invite/:token redirects here.
// If the user is logged in we try to join via token; if not we send them to register/login.
export default function AcceptInvite() {
  const [params] = useSearchParams()
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const token = params.get('token')
  const email = params.get('email')

  useEffect(() => {
    if (!token) { navigate('/login'); return }

    if (user) {
      // Already logged in — the server already added them when it redirected here
      // (the GET /api/groups/accept-invite/:token handled it server-side for existing users)
      // Just refresh user data and head to dashboard
      refreshUser().then(() => navigate('/?joined=1'))
      return
    }

    // Not logged in — redirect to register pre-filling email
    const query = new URLSearchParams({ invite: token })
    if (email) query.set('email', email)
    navigate(`/register?${query.toString()}`)
  }, [token, user]) // eslint-disable-line

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-moss-300 border-t-moss-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-moss-700 font-serif italic">Accepting invitation…</p>
      </div>
    </div>
  )
}
