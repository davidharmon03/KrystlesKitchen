import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck, Package, Leaf, ShoppingCart, Users, Calendar, ChefHat, X } from 'lucide-react'
import api from '../api'

const TYPE_META = {
  meal_added:       { icon: Package,      color: 'text-terra-500',  bg: 'bg-terra-50' },
  item_expiring:    { icon: Package,      color: 'text-amber-500',  bg: 'bg-amber-50' },
  bulk_buy_posted:  { icon: ShoppingCart, color: 'text-moss-600',   bg: 'bg-moss-50'  },
  harvest_logged:   { icon: Leaf,         color: 'text-moss-500',   bg: 'bg-moss-50'  },
  invite_received:  { icon: Users,        color: 'text-slate-600',  bg: 'bg-slate-50' },
  swap_scheduled:   { icon: Calendar,     color: 'text-terra-400',  bg: 'bg-terra-50' },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function NotificationBell() {
  const [open,           setOpen]           = useState(false)
  const [notifications,  setNotifications]  = useState([])
  const [loading,        setLoading]        = useState(false)
  const panelRef  = useRef(null)
  const navigate  = useNavigate()

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data)
    } catch {}
  }, [])

  // Initial load + 60s poll
  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [load])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unreadCount = notifications.filter(n => !n.is_read).length

  const markRead = async id => {
    try {
      await api.put(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n))
    } catch {}
  }

  const markAllRead = async () => {
    setLoading(true)
    try {
      await api.put('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
    } catch {} finally { setLoading(false) }
  }

  const handleClick = async (n) => {
    if (!n.is_read) await markRead(n.id)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-1.5 rounded-lg text-slate-500 hover:text-moss-700 hover:bg-moss-50 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-semibold text-sm text-ink">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="text-xs text-moss-600 hover:text-moss-800 font-medium flex items-center gap-1"
                >
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell size={24} className="mx-auto text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">All caught up!</p>
              </div>
            ) : (
              notifications.map(n => {
                const meta = TYPE_META[n.type] || { icon: Bell, color: 'text-slate-400', bg: 'bg-slate-50' }
                const Icon = meta.icon
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-moss-50/40' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-full ${meta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon size={14} className={meta.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-xs font-semibold leading-snug ${n.is_read ? 'text-slate-500' : 'text-ink'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-moss-500 flex-shrink-0 mt-1" />}
                      </div>
                      {n.message && (
                        <p className="text-xs text-slate-500 leading-snug mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
