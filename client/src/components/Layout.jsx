import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSync } from '../contexts/SyncContext'
import {
  ChefHat, DollarSign, Package, Leaf, Tag, LayoutDashboard,
  LogOut, Menu, X, Wrench, Calendar, Camera, ArrowLeftRight, HelpCircle, Lightbulb, ShoppingBag, MessageSquare,
  RefreshCw, Wifi, WifiOff, Clock
} from 'lucide-react'
import { firstName } from '../utils/userName'
import NotificationBell from './NotificationBell'
import InstallPrompt from './InstallPrompt'

function relativeTime(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function SyncBadge({ onLinkClick }) {
  const { syncMode, syncStatus, lastSyncedAt, pendingCount, syncNow } = useSync()

  const statusConfig = {
    synced:  { dot: 'bg-moss-400',   label: 'Synced',      icon: null },
    pending: { dot: 'bg-amber-400',  label: 'Pending',     icon: null },
    offline: { dot: 'bg-red-400',    label: 'Offline',     icon: WifiOff },
    syncing: { dot: 'bg-blue-400 animate-pulse', label: 'Syncing…', icon: null },
  }
  const cfg = statusConfig[syncStatus] || statusConfig.synced
  const ts  = relativeTime(lastSyncedAt)

  return (
    <div className="mx-3 mb-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <span className="text-xs font-medium text-slate-600 truncate">{cfg.label}</span>
          {ts && <span className="text-[10px] text-slate-400 truncate hidden sm:inline">{ts}</span>}
        </div>
        {syncMode === 'manual' ? (
          <button
            onClick={() => { syncNow(); onLinkClick?.() }}
            disabled={syncStatus === 'syncing'}
            className="flex items-center gap-1 text-[10px] font-semibold text-moss-600 hover:text-moss-800 disabled:opacity-40 flex-shrink-0"
          >
            <RefreshCw size={10} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            {pendingCount > 0 ? `Sync (${pendingCount})` : 'Sync Now'}
          </button>
        ) : (
          <Clock size={11} className="text-slate-300 flex-shrink-0" />
        )}
      </div>
    </div>
  )
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function AvatarCircle({ user, size = 'md' }) {
  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  }
  const sz = sizes[size] || sizes.md
  if (user?.avatar_path) {
    return (
      <img
        src={`${API_BASE}/uploads/avatars/${user.avatar_path.split('/').pop()}`}
        alt={user.name}
        className={`${sz} rounded-full object-cover flex-shrink-0`}
        onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling?.style?.removeProperty('display') }}
      />
    )
  }
  return (
    <div className={`${sz} rounded-full bg-terra-100 flex items-center justify-center flex-shrink-0`}>
      <span className="text-terra-600 font-semibold">{user?.name?.[0]?.toUpperCase()}</span>
    </div>
  )
}

export { AvatarCircle }

export default function Layout() {
  const { user, logout } = useAuth()
  const fn = firstName(user)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const activeGroup = user?.groups?.[0]

  const channels = [
    { to: '/kitchen',     label: `${fn}'s Kitchen`,   icon: ChefHat,         color: 'text-terra-500' },
    { to: '/korner',      label: `${fn}'s Corner`,     icon: DollarSign,      color: 'text-moss-600'  },
    { to: '/kuzine',      label: `${fn}'s Cuisine`,    icon: Package,         color: 'text-slate-600' },
    { to: '/orders',      label: 'Kitchen Orders',     icon: ShoppingBag,     color: 'text-moss-600'  },
    { to: '/kultivate',   label: `${fn}'s Garden`,     icon: Leaf,            color: 'text-moss-500'  },
    { to: '/equipment',   label: 'Equipment',          icon: Wrench,          color: 'text-terra-400' },
    { to: '/labels',      label: 'Label Generator',    icon: Tag,             color: 'text-slate-400' },
    { to: '/calendar',    label: 'Group Calendar',     icon: Calendar,        color: 'text-moss-500'  },
    { to: '/gallery',     label: 'Meal Gallery',       icon: Camera,          color: 'text-terra-400' },
    { to: '/swap',        label: 'Meal Swap',          icon: ArrowLeftRight,  color: 'text-moss-600'  },
    { to: '/suggestions', label: 'Suggestions',        icon: Lightbulb,       color: 'text-terra-400' },
    { to: '/chat',        label: 'Group Chat',         icon: MessageSquare,   color: 'text-moss-500'  },
  ]

  const closeDrawer = () => setDrawerOpen(false)

  // Shared nav content — used by both desktop sidebar and mobile drawer
  const renderNav = (onLinkClick) => (
    <>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <NavLink to="/" end onClick={onLinkClick}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? 'bg-moss-50 text-moss-700' : 'text-slate-600 hover:bg-slate-50'}`}>
          <LayoutDashboard size={17} className="flex-shrink-0" />
          Dashboard
        </NavLink>

        <div className="pt-3 pb-1 px-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Channels</p>
        </div>

        {channels.map(ch => (
          <NavLink key={ch.to} to={ch.to} onClick={onLinkClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-moss-50 text-moss-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <ch.icon size={17} className={`flex-shrink-0 ${ch.color}`} />
            <span className="truncate">{ch.label}</span>
          </NavLink>
        ))}
      </nav>

      {activeGroup && (
        <div className="px-4 py-3 border-t border-slate-100 bg-moss-50">
          <p className="text-xs text-slate-500 font-medium">Active Group</p>
          <p className="text-sm font-semibold text-moss-700 truncate">{activeGroup.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">Code: <span className="font-mono font-semibold">{activeGroup.invite_code}</span></p>
        </div>
      )}

      <SyncBadge onLinkClick={onLinkClick} />

      <div className="px-4 py-2 border-t border-slate-100 space-y-0.5">
        <NavLink to="/help" onClick={onLinkClick}
          className={({ isActive }) =>
            `flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
              isActive ? 'text-moss-700 bg-moss-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
          <HelpCircle size={14} />
          Help & Guide
        </NavLink>
        <button
          onClick={() => logout().then(() => navigate('/login'))}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>

      <div className="px-4 py-4 border-t border-slate-100 flex items-center gap-3">
        <Link to="/profile" onClick={onLinkClick}
          className="flex items-center gap-3 flex-1 min-w-0 group">
          <AvatarCircle user={user} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate group-hover:text-moss-700 transition-colors">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">Edit profile</p>
          </div>
        </Link>
      </div>

      <div className="px-4 pb-3 text-center">
        <p className="text-[10px] text-slate-300">Krystle's Cottage v1.0.0</p>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-cream overflow-x-hidden">

      {/* ── Desktop sidebar — hidden on mobile ── */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 flex-shrink-0">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-moss-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-serif font-bold text-lg leading-none">{fn[0]?.toUpperCase()}</span>
            </div>
            <div>
              <p className="font-serif font-semibold text-ink text-sm leading-tight">{fn}'s Cottage</p>
            </div>
          </div>
        </div>
        {renderNav(() => {})}
      </aside>

      {/* ── Mobile drawer — slide-in from left ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={closeDrawer}
          />
          {/* Drawer panel */}
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col shadow-xl md:hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-moss-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-serif font-bold text-sm leading-none">{fn[0]?.toUpperCase()}</span>
                </div>
                <p className="font-serif font-semibold text-ink text-sm">{fn}'s Cottage</p>
              </div>
              <button
                onClick={closeDrawer}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            {renderNav(closeDrawer)}
          </aside>
        </>
      )}

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header bar */}
        <header className="flex items-center gap-2 px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden p-1 -ml-1 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          {/* App name — mobile only, centered */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-7 h-7 rounded-full bg-moss-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-serif font-bold text-sm">K</span>
            </div>
            <span className="font-serif font-semibold text-ink text-sm">{fn}'s Cottage</span>
          </div>

          <div className="flex-1" />
          <NotificationBell />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
          <Outlet />
        </main>

      </div>

      <InstallPrompt />
    </div>
  )
}
