import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import { Eye, EyeOff } from 'lucide-react'

export default function Register() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const inviteEmail = searchParams.get('email') || ''

  const [form, setForm] = useState({ name: '', email: inviteEmail, password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)

  // If they arrived via invite link, pre-fill the email
  useEffect(() => {
    if (inviteEmail) setForm(f => ({ ...f, email: inviteEmail }))
  }, [inviteEmail])

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      // Register with invite_token so the server can auto-add them to the group
      const res = await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        invite_token: inviteToken || undefined,
      })
      // Store token and log them in
      localStorage.setItem('kbh_token', res.data.token)
      localStorage.setItem('kbh_user', JSON.stringify(res.data.user))
      // Re-fetch with groups via login flow
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-moss-900 via-moss-700 to-moss-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center mx-auto mb-4 ring-2 ring-white ring-opacity-30">
            <span className="text-white font-serif font-bold text-3xl leading-none">K</span>
          </div>
          <h1 className="text-white font-serif text-3xl font-semibold">Krystle's Brand Hub</h1>
          <p className="text-moss-200 text-sm mt-1 italic">
            {inviteToken ? 'Accept your invitation and join the hub.' : 'Join the community.'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-serif font-semibold text-ink mb-1">Create your account</h2>
          {inviteToken && (
            <p className="text-sm text-moss-600 mb-4 bg-moss-50 border border-moss-200 rounded-lg px-3 py-2">
              You've been invited to a group. Create your account to accept.
            </p>
          )}

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Your name</label>
              <input type="text" required className="input" placeholder="Krystle" value={form.name} onChange={set('name')} autoFocus={!inviteEmail} />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email" required className="input" placeholder="you@example.com"
                value={form.email} onChange={set('email')}
                readOnly={!!inviteEmail}
                style={inviteEmail ? { background: '#f8f7f4' } : {}}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} required
                  className="input pr-10"
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={set('password')}
                  autoFocus={!!inviteEmail}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'} required
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={set('confirm')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Creating account…' : inviteToken ? 'Create Account & Join Group' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Already have an account?{' '}
            <Link to={inviteToken ? `/login?invite=${inviteToken}` : '/login'} className="text-moss-600 font-medium hover:text-moss-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
