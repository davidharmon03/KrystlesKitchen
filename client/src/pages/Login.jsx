import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-moss-900 via-moss-700 to-moss-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center mx-auto mb-4 ring-2 ring-white ring-opacity-30">
            <span className="text-white font-serif font-bold text-3xl leading-none">K</span>
          </div>
          <h1 className="text-white font-serif text-3xl font-semibold">Krystle's Brand Hub</h1>
          <p className="text-moss-200 text-sm mt-1 italic">Healthy. Organic. Community-driven.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-serif font-semibold text-ink mb-6">Welcome back</h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email" required
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} required
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
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
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            <div className="text-center mt-3">
              <Link to="/forgot-password" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                Forgot your password?
              </Link>
            </div>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            New here?{' '}
            <Link to="/register" className="text-moss-600 font-medium hover:text-moss-700">
              Create an account
            </Link>
          </p>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center mb-2">Demo accounts</p>
            <div className="space-y-1">
              {[
                ['krystle@example.com', 'Krystle'],
                ['marcus@example.com', 'Marcus'],
                ['dana@example.com', 'Dana'],
              ].map(([email, name]) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => setForm({ email, password: 'password123' })}
                  className="w-full text-left px-3 py-1.5 rounded text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <span className="font-medium text-moss-700">{name}</span> — {email}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
