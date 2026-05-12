import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import { CreditCard, CheckCircle, XCircle, Loader, ArrowLeft, Star, Zap } from 'lucide-react'

const PRO_FEATURES = [
  'Unlimited recipes',
  'Priority support',
  'Advanced analytics',
  'Export your data anytime',
  'Early access to new features',
]

export default function Billing() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const success  = searchParams.get('success') === 'true'
  const canceled = searchParams.get('canceled') === 'true'

  const [status,   setStatus]   = useState(null)   // null = loading
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    api.get('/billing/status')
      .then(res => setStatus(res.data))
      .catch(() => setStatus({ plan: 'free' }))
  }, [])

  const handleUpgrade = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/billing/create-checkout')
      window.location.href = res.data.url
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start checkout')
      setLoading(false)
    }
  }

  const handlePortal = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/billing/portal')
      window.location.href = res.data.url
    } catch (err) {
      setError(err.response?.data?.error || 'Could not open billing portal')
      setLoading(false)
    }
  }

  const isPro = status?.plan === 'pro'

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="section-header mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-moss-100 flex items-center justify-center">
            <CreditCard size={20} className="text-moss-600" />
          </div>
          <div>
            <h1 className="page-title">Billing & Plan</h1>
            <p className="text-sm text-slate-500">Manage your subscription</p>
          </div>
        </div>
        <Link to="/profile" className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600">
          <ArrowLeft size={14} /> Back to profile
        </Link>
      </div>

      {/* Success / cancel banners */}
      {success && (
        <div className="card mb-6 bg-moss-50 border-moss-200 flex items-center gap-3">
          <CheckCircle size={20} className="text-moss-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-moss-800">You're now on Pro!</p>
            <p className="text-sm text-moss-600">Thanks for upgrading. All pro features are now active.</p>
          </div>
        </div>
      )}
      {canceled && (
        <div className="card mb-6 bg-amber-50 border-amber-200 flex items-center gap-3">
          <XCircle size={20} className="text-amber-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Checkout canceled</p>
            <p className="text-sm text-amber-600">No charge was made. You can upgrade whenever you're ready.</p>
          </div>
        </div>
      )}

      {status === null ? (
        <div className="card flex items-center justify-center py-16">
          <Loader size={24} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Current plan card */}
          <div className="card mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Current Plan</p>
                <div className="flex items-center gap-2">
                  {isPro
                    ? <Star size={18} className="text-amber-500" />
                    : <Zap size={18} className="text-slate-400" />
                  }
                  <p className="text-2xl font-serif font-semibold text-ink">
                    {isPro ? 'Pro' : 'Free'}
                  </p>
                </div>
                {isPro && (
                  <p className="text-xs text-moss-600 mt-1 font-medium">All features unlocked</p>
                )}
              </div>
              {isPro ? (
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">Active</span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">Free tier</span>
              )}
            </div>
          </div>

          {/* Pro features / upgrade */}
          {!isPro ? (
            <div className="card mb-6">
              <h2 className="font-serif font-semibold text-ink mb-1">Upgrade to Pro</h2>
              <p className="text-sm text-slate-500 mb-4">Unlock the full Krystle's Cottage experience.</p>

              <ul className="space-y-2 mb-6">
                {PRO_FEATURES.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle size={15} className="text-moss-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader size={15} className="animate-spin" /> Redirecting…</>
                  : <><Star size={15} /> Upgrade to Pro</>
                }
              </button>
            </div>
          ) : (
            <div className="card mb-6">
              <h2 className="font-serif font-semibold text-ink mb-1">Manage Subscription</h2>
              <p className="text-sm text-slate-500 mb-4">
                Update payment method, view invoices, or cancel your plan via the Stripe billing portal.
              </p>

              {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

              <button
                onClick={handlePortal}
                disabled={loading}
                className="btn-primary flex items-center gap-2"
              >
                {loading
                  ? <><Loader size={15} className="animate-spin" /> Opening portal…</>
                  : <><CreditCard size={15} /> Open Billing Portal</>
                }
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
