import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import axios from 'axios'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')

    if (form.newPassword.length < 8) {
      return setError('Password must be at least 8 characters.')
    }
    if (form.newPassword !== form.confirmPassword) {
      return setError('Passwords do not match.')
    }
    if (!token) {
      return setError('Missing reset token. Please use the link from your email.')
    }

    setLoading(true)
    try {
      await axios.post('/api/auth/reset-password', {
        token,
        newPassword: form.newPassword,
      })
      setSuccess(true)
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.msg
        || err.response?.data?.error
        || 'Something went wrong. The link may have expired.'
      setError(msg)
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
          <h2 className="text-xl font-serif font-semibold text-ink mb-2">Set a new password</h2>

          {success ? (
            <div className="text-center py-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: '#6B7C5C' + '20' }}
              >
                <svg className="w-6 h-6" style={{ color: '#6B7C5C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-medium mb-1" style={{ color: '#6B7C5C' }}>Password updated</p>
              <p className="text-sm text-slate-500 mb-6">
                Your password has been changed. You can now sign in with your new password.
              </p>
              <Link
                to="/login"
                className="inline-block px-6 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#6B7C5C' }}
              >
                Sign In
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-6">
                Choose a new password (minimum 8 characters).
              </p>

              {!token && (
                <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
                  No reset token found. Please use the link from your email.
                </div>
              )}

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      className="input pr-10"
                      placeholder="••••••••"
                      value={form.newPassword}
                      onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
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
                  <label className="label">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      className="input pr-10"
                      placeholder="••••••••"
                      value={form.confirmPassword}
                      onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
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

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="btn-primary w-full mt-2"
                >
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-5">
                <Link to="/login" className="font-medium hover:underline" style={{ color: '#6B7C5C' }}>
                  Back to Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
