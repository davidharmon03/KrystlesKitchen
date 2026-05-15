import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import {
  ChefHat, DollarSign, Package, Leaf, Tag,
  Users, Plus, ArrowRight, Copy, Check, AlertTriangle, ShieldCheck, User
} from 'lucide-react'
import SocialLinks from '../components/SocialLinks'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function relativeTime(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h  < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function syncDotColor(iso) {
  if (!iso) return 'bg-slate-200'
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000
  if (days < 1)  return 'bg-moss-400'
  if (days < 3)  return 'bg-amber-400'
  return 'bg-red-400'
}

export default function Dashboard() {
  const { user } = useAuth()
  const channels = [
    {
      to: '/kitchen', label: 'Kitchen', sub: 'Recipes & How-Tos',
      icon: ChefHat, bg: 'bg-terra-50', border: 'border-terra-200',
      iconBg: 'bg-terra-100', iconColor: 'text-terra-600',
      description: 'Healthy organic recipes, freezer-friendly cooking, and professional prep techniques.',
    },
    {
      to: '/corner', label: 'Corner', sub: 'Group Finance Hub',
      icon: DollarSign, bg: 'bg-moss-50', border: 'border-moss-200',
      iconBg: 'bg-moss-100', iconColor: 'text-moss-600',
      description: 'Receipt tracking, The Equalizer, and Meal Credits — split costs fairly across your group.',
    },
    {
      to: '/cuisine', label: 'Cuisine', sub: 'Prep & Inventory',
      icon: Package, bg: 'bg-slate-50', border: 'border-slate-200',
      iconBg: 'bg-slate-100', iconColor: 'text-slate-600',
      description: 'Inventory management, bulk-buy coordination, and vacuum seal logging.',
    },
    {
      to: '/garden', label: 'Garden', sub: 'Plants & Harvests',
      icon: Leaf, bg: 'bg-moss-50', border: 'border-moss-200',
      iconBg: 'bg-moss-100', iconColor: 'text-moss-500',
      description: 'Track your garden plants, log harvests, and auto-stock inventory from your Garden.',
    },
  ]
  const navigate = useNavigate()
  const [recentRecipes, setRecentRecipes] = useState([])
  const [groupMembers,  setGroupMembers]  = useState([])
  const [copiedCode, setCopiedCode] = useState(false)

  const activeGroup = user?.groups?.[0]

  useEffect(() => {
    if (activeGroup) {
      api.get(`/recipes?groupId=${activeGroup.id}`)
        .then(r => setRecentRecipes(r.data.slice(0, 3)))
        .catch(() => {})
      api.get(`/groups/${activeGroup.id}`)
        .then(r => setGroupMembers(r.data.members || []))
        .catch(() => {})
    }
  }, [activeGroup?.id])

  const copyCode = () => {
    if (!activeGroup?.invite_code) return
    navigator.clipboard.writeText(activeGroup.invite_code).then(() => {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    })
  }

  return (
    <div className="max-w-5xl mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-serif font-semibold text-ink">
          Good {getGreeting()}, {user?.name?.split(' ')[0]} 🌿
        </h1>
        <p className="text-slate-500 mt-1 text-sm md:text-base">Welcome to your brand hub. What are we prepping today?</p>
      </div>

      {/* Account Status Card */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Avatar */}
          <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
            <span className="text-slate-600 font-semibold text-base">{user?.name?.[0]?.toUpperCase()}</span>
          </div>

          {/* Identity + group status */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="font-semibold text-ink">{user?.name}</span>

              {/* System role badge */}
              {user?.role === 'superadmin' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-terra-100 text-terra-700 border border-terra-200">
                  <ShieldCheck size={11} /> Superadmin
                </span>
              )}
              {user?.role === 'admin' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-moss-100 text-moss-700 border border-moss-200">
                  <ShieldCheck size={11} /> Admin
                </span>
              )}
              {(!user?.role || user?.role === 'member') && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                  <User size={11} /> Member
                </span>
              )}

              {/* Group membership badge */}
              {activeGroup ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Check size={11} /> Group Member
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200">
                  Free Account
                </span>
              )}
            </div>

            <p className="text-sm text-slate-500">{user?.email}</p>

            {/* Group detail */}
            {activeGroup ? (
              <p className="text-sm text-slate-600 mt-1">
                <span className="text-slate-400">Member of:</span>{' '}
                <span className="font-medium text-ink">{activeGroup.name}</span>
                {activeGroup.role && (
                  <span className="ml-2 text-xs text-slate-400 capitalize">· {activeGroup.role}</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-1">
                Not in a group yet — join or create one to unlock Kitchen, Corner, Cuisine, and Garden features.
              </p>
            )}

            {/* Password warning */}
            {user?.must_change_password && (
              <Link to="/profile" className="inline-flex items-center gap-1.5 text-amber-600 text-sm mt-1.5 hover:text-amber-700 font-medium">
                <AlertTriangle size={13} /> Please update your password
              </Link>
            )}
          </div>

          {/* CTA for no-group state */}
          {!activeGroup && (
            <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
              <button
                onClick={() => navigate('/welcome')}
                className="btn-terra text-sm flex items-center gap-1.5 flex-1 sm:flex-none justify-center"
              >
                <Users size={15} /> Join or Create
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Group Banner */}
      {!activeGroup ? (
        <div className="card border-terra-200 bg-terra-50 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-terra-800 font-serif">No group yet</h3>
            <p className="text-terra-700 text-sm mt-0.5">Create or join a group of up to 5 to unlock the Corner, Cuisine, and Garden channels.</p>
          </div>
          <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
            <button onClick={() => navigate('/welcome')} className="btn-terra flex items-center gap-2 flex-1 sm:flex-none justify-center">
              <Users size={16} /> Join or Create
            </button>
          </div>
        </div>
      ) : (
        <div className="card border-moss-200 bg-moss-50 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-moss-500 flex items-center justify-center flex-shrink-0">
            <Users size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-moss-800 font-serif">{activeGroup.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-moss-600 text-sm">Invite code:</span>
              <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded text-moss-700 text-sm border border-moss-200">
                {activeGroup.invite_code}
              </span>
              <button onClick={copyCode} className="flex items-center gap-1 text-xs text-moss-500 hover:text-moss-700">
                {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                {copiedCode ? 'Copied' : 'Copy'}
              </button>
              <span className="text-moss-400 text-xs">{activeGroup.member_count}/5 members</span>
            </div>
          </div>
          {activeGroup.member_count < 5 && (
            <Link to="/create-group" className="btn-ghost text-sm flex items-center gap-1.5 flex-shrink-0">
              <Plus size={15} /> Invite more
            </Link>
          )}
        </div>
      )}

      {/* Group members */}
      {groupMembers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Group Members</h2>
          <div className="flex flex-wrap gap-3">
            {groupMembers.map(m => {
              const isMe = m.id === user?.id
              return (
                <div key={m.id} className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-moss-100 flex items-center justify-center">
                      <span className="text-moss-700 font-semibold text-sm">{m.name?.[0]?.toUpperCase()}</span>
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${syncDotColor(m.last_synced_at)}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink leading-tight">
                      {m.name}{isMe && <span className="ml-1.5 text-xs text-slate-400 font-normal">you</span>}
                    </p>
                    {m.last_synced_at ? (
                      <p className={`text-[10px] mt-0.5 ${
                        (Date.now() - new Date(m.last_synced_at).getTime()) / 86_400_000 >= 3
                          ? 'text-amber-500' : 'text-slate-400'
                      }`}>
                        Synced {relativeTime(m.last_synced_at)}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-300 mt-0.5">Never synced</p>
                    )}
                    <SocialLinks links={m.social_links} size="sm" className="mt-1" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Channel cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {channels.map(ch => (
          <Link key={ch.to} to={ch.to} className={`card ${ch.bg} ${ch.border} hover:shadow-md transition-shadow group`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${ch.iconBg} flex items-center justify-center flex-shrink-0`}>
                <ch.icon size={20} className={ch.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif font-semibold text-ink">{ch.label}</h3>
                  <ArrowRight size={15} className="text-slate-400 group-hover:text-moss-600 transition-colors" />
                </div>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{ch.sub}</p>
                <p className="text-sm text-slate-600 mt-2 leading-snug">{ch.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent recipes */}
      {recentRecipes.length > 0 && (
        <div>
          <div className="section-header">
            <h2 className="text-lg font-serif font-semibold text-ink">Recent Recipes</h2>
            <Link to="/kitchen" className="text-sm text-moss-600 hover:text-moss-700 font-medium flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentRecipes.map(r => (
              <div key={r.id} className="card hover:shadow-md transition-shadow">
                <h4 className="font-medium text-ink text-sm leading-snug">{r.title}</h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {r.tags?.slice(0, 2).map(t => <span key={t} className="tag-moss">{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Label Generator CTA */}
      <div className="mt-6 card border-parchment bg-parchment flex items-center gap-4">
        <Tag size={28} className="text-terra-500 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-serif font-semibold text-ink">Label Generator</h3>
          <p className="text-sm text-slate-600 mt-0.5">Print parchment-ready instruction cards for vacuum-sealed bags.</p>
        </div>
        <Link to="/labels" className="btn-terra text-sm flex-shrink-0">Open</Link>
      </div>

    </div>
  )
}
