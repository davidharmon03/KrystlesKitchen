import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSync } from '../contexts/SyncContext'
import api from '../api'
import { User, Save, Loader, Check, Camera, Upload, LogOut, Bell, RefreshCw, Download, CreditCard } from 'lucide-react'
import SocialLinks, { PLATFORMS } from '../components/SocialLinks'

const PREF_GROUPS = [
  {
    label: 'Email',
    items: [
      { key: 'email_digest', label: 'Weekly Email Digest', desc: 'Receive the group summary email each week' },
    ],
  },
  {
    label: 'In-App Notifications',
    items: [
      { key: 'in_app_swap',      label: 'Meal Swap',   desc: 'New swap weeks and entrée-ready alerts' },
      { key: 'in_app_korner',    label: 'Corner',      desc: 'Bulk buy runs posted to the group' },
      { key: 'in_app_kuzine',    label: 'Cuisine',     desc: 'Meals and inventory activity' },
      { key: 'in_app_kultivate', label: 'Garden',      desc: 'Harvest logs from group members' },
      { key: 'in_app_orders',    label: 'Kitchen Orders', desc: 'Order requests, ready alerts, and declines' },
    ],
  },
  {
    label: 'Reminders',
    items: [
      { key: 'expiry_reminders', label: 'Expiry Reminders', desc: 'Alerts when inventory items are nearing use-by date' },
    ],
  },
]

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-moss-400 focus:ring-offset-1 ${
        on ? 'bg-moss-500' : 'bg-slate-200'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-150 ${
        on ? 'translate-x-4' : 'translate-x-0'
      }`} />
    </button>
  )
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const PLATFORM_PLACEHOLDERS = {
  website:   'https://yoursite.com',
  instagram: '@yourhandle',
  tiktok:    '@yourhandle',
  youtube:   '@yourchannel or full URL',
  facebook:  'username or full URL',
  twitter:   '@yourhandle',
  pinterest: '@yourhandle',
}

function AvatarEditor({ user, onUploaded }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)

  const avatarSrc = preview
    || (user?.avatar_path ? `${API_BASE}/uploads/${user.avatar_path}` : null)

  const handleFile = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    uploadFile(file)
  }

  const uploadFile = async file => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const res = await api.post('/auth/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      onUploaded(res.data)
    } catch (err) {
      console.error('Avatar upload failed:', err)
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt="Avatar"
            className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-terra-100 border-4 border-white shadow-md flex items-center justify-center">
            <span className="text-terra-600 font-bold text-3xl">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
        )}
        <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading
            ? <Loader size={20} className="text-white animate-spin" />
            : <Camera size={20} className="text-white" />
          }
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      <div className="text-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-xs text-moss-600 hover:text-moss-800 font-medium flex items-center gap-1 mx-auto"
        >
          <Upload size={11} />
          {uploading ? 'Uploading…' : 'Change photo'}
        </button>
        <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG or GIF · max 5 MB</p>
      </div>
    </div>
  )
}

export default function Profile() {
  const { user, logout, refreshUser } = useAuth()
  const { syncMode, setSyncMode, syncStatus, pendingCount, syncNow } = useSync()
  const navigate = useNavigate()

  const [name,        setName]        = useState(user?.name || '')
  const [links,       setLinks]       = useState({})
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState('')
  const [downloading, setDownloading] = useState(false)

  // Notification preferences
  const [prefs,       setPrefs]       = useState(null)   // null = loading
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsSaved,  setPrefsSaved]  = useState(false)
  const [prefsError,  setPrefsError]  = useState('')

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setLinks(user.social_links || {})
    }
  }, [user])

  const loadPrefs = useCallback(async () => {
    try {
      const res = await api.get('/auth/notification-prefs')
      setPrefs(res.data)
    } catch { setPrefsError('Could not load notification preferences.') }
  }, [])

  useEffect(() => { loadPrefs() }, [loadPrefs])

  const setPref = (key, val) => setPrefs(prev => ({ ...prev, [key]: val }))

  const savePrefs = async () => {
    setPrefsSaving(true)
    setPrefsError('')
    try {
      const res = await api.put('/auth/notification-prefs', prefs)
      setPrefs(res.data)
      setPrefsSaved(true)
      setTimeout(() => setPrefsSaved(false), 2500)
    } catch { setPrefsError('Failed to save preferences.') }
    finally { setPrefsSaving(false) }
  }

  const setLink = (key, val) => setLinks(prev => ({ ...prev, [key]: val }))

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.put('/auth/profile', { name: name.trim(), social_links: links })
      await refreshUser()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUploaded = async () => {
    await refreshUser()
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await api.get('/export/my-data', { responseType: 'blob' })
      const url  = URL.createObjectURL(res.data)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `krystles-hub-export-${new Date().toISOString().split('T')[0]}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silent — user sees no file download
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="section-header mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-moss-100 flex items-center justify-center">
            <User size={20} className="text-moss-600" />
          </div>
          <div>
            <h1 className="page-title">My Profile</h1>
            <p className="text-sm text-slate-500">Avatar, name, and social links</p>
          </div>
        </div>
      </div>

      {/* Avatar */}
      <div className="card mb-6 flex justify-center py-6">
        <AvatarEditor user={user} onUploaded={handleAvatarUploaded} />
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic info */}
        <div className="card">
          <h2 className="font-serif font-semibold text-ink mb-4">Account</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Display name</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input bg-slate-50 text-slate-400 cursor-not-allowed"
                value={user?.email || ''}
                readOnly
              />
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
            </div>
          </div>
        </div>

        {/* Social links */}
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-serif font-semibold text-ink">Social Accounts</h2>
            <SocialLinks links={links} size="sm" />
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Add your handles or URLs — they'll appear as clickable icons on your group member card.
          </p>

          <div className="space-y-3">
            {PLATFORMS.map(p => (
              <div key={p.key} className="flex items-center gap-3">
                <div className={`w-5 h-5 flex-shrink-0 ${p.color}`}>
                  {p.icon}
                </div>
                <div className="flex-1">
                  <input
                    className="input text-sm py-1.5"
                    placeholder={PLATFORM_PLACEHOLDERS[p.key] || p.label}
                    value={links[p.key] || ''}
                    onChange={e => setLink(p.key, e.target.value)}
                  />
                </div>
                <span className="text-xs text-slate-400 w-20 flex-shrink-0 hidden sm:block">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-6"
          >
            {saving
              ? <><Loader size={15} className="animate-spin" /> Saving…</>
              : saved
                ? <><Check size={15} /> Saved!</>
                : <><Save size={15} /> Save changes</>
            }
          </button>
        </div>
      </form>

      {/* Notification Preferences */}
      <div className="mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-terra-100 flex items-center justify-center">
            <Bell size={20} className="text-terra-500" />
          </div>
          <div>
            <h2 className="font-serif font-semibold text-ink">Notification Preferences</h2>
            <p className="text-sm text-slate-500">Choose what you want to be notified about</p>
          </div>
        </div>

        {prefsError && (
          <p className="text-sm text-red-500 mb-3">{prefsError}</p>
        )}

        {prefs === null ? (
          <div className="card flex items-center justify-center py-8">
            <Loader size={18} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {PREF_GROUPS.map(group => (
              <div key={group.label} className="card">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{group.label}</h3>
                <div className="space-y-3">
                  {group.items.map(item => (
                    <div key={item.key} className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{item.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                      <Toggle on={prefs[item.key] !== false} onChange={val => setPref(item.key, val)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={savePrefs}
                disabled={prefsSaving}
                className="btn-primary flex items-center gap-2 px-6"
              >
                {prefsSaving
                  ? <><Loader size={15} className="animate-spin" /> Saving…</>
                  : prefsSaved
                    ? <><Check size={15} /> Saved!</>
                    : <><Save size={15} /> Save preferences</>
                }
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sync Settings */}
      {user?.groups?.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-moss-100 flex items-center justify-center">
              <RefreshCw size={20} className="text-moss-600" />
            </div>
            <div>
              <h2 className="font-serif font-semibold text-ink">Group Sync</h2>
              <p className="text-sm text-slate-500">Control when your activity syncs with the group</p>
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">Auto-sync with group</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {syncMode === 'auto'
                    ? 'Your last-active time updates automatically whenever you use the app.'
                    : 'Manual mode — use "Sync Now" to update your last-synced timestamp.'}
                </p>
              </div>
              <Toggle on={syncMode === 'auto'} onChange={on => setSyncMode(on ? 'auto' : 'manual')} />
            </div>

            {syncMode === 'manual' && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">
                    {pendingCount > 0
                      ? <span className="text-amber-600 font-medium">{pendingCount} action{pendingCount !== 1 ? 's' : ''} pending sync</span>
                      : <span className="text-slate-400">No pending changes</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={syncNow}
                  disabled={syncStatus === 'syncing'}
                  className="btn-primary flex items-center gap-2 text-sm px-4 py-1.5"
                >
                  <RefreshCw size={14} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                  {syncStatus === 'syncing' ? 'Syncing…' : 'Sync Now'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Billing */}
      <div className="mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <CreditCard size={20} className="text-amber-600" />
          </div>
          <div>
            <h2 className="font-serif font-semibold text-ink">Plan & Billing</h2>
            <p className="text-sm text-slate-500">Manage your subscription</p>
          </div>
        </div>
        <div className="card flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink capitalize">{user?.plan || 'Free'} plan</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {user?.plan === 'pro' ? 'All features unlocked' : 'Upgrade to unlock pro features'}
            </p>
          </div>
          <Link to="/billing" className="btn-primary flex items-center gap-2 text-sm px-4 py-2 flex-shrink-0">
            <CreditCard size={14} />
            {user?.plan === 'pro' ? 'Manage' : 'Upgrade'}
          </Link>
        </div>
      </div>

      {/* Data Export */}
      <div className="mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <Download size={20} className="text-slate-600" />
          </div>
          <div>
            <h2 className="font-serif font-semibold text-ink">Export Your Data</h2>
            <p className="text-sm text-slate-500">Download everything as a ZIP archive</p>
          </div>
        </div>
        <div className="card flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Full data export</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Recipes (JSON) · Inventory, Spending, Swaps, Garden (CSV)
            </p>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn-ghost flex items-center gap-2 text-sm flex-shrink-0"
          >
            {downloading
              ? <><Loader size={14} className="animate-spin" /> Preparing…</>
              : <><Download size={14} /> Download</>
            }
          </button>
        </div>
      </div>

      {/* Sign out */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex justify-center">
        <button
          onClick={() => logout().then(() => navigate('/login'))}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </div>
  )
}
