import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import {
  Users, Search, X, Mail, CheckCircle, ArrowRight,
  ArrowLeft, Plus, Loader, Copy, Check
} from 'lucide-react'

const STEPS = ['Name your group', 'Add members', 'Send invites']

export default function CreateGroup() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [step, setStep] = useState(0)
  const [groupName, setGroupName] = useState('')
  const [nameError, setNameError] = useState('')
  const [groupId, setGroupId] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [creating, setCreating] = useState(false)

  // Member selection state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState([]) // [{id?, name, email, type: 'user'|'email'}]
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')
  const searchRef = useRef(null)
  const searchTimeout = useRef(null)

  // Send state
  const [sending, setSending] = useState(false)
  const [sendResults, setSendResults] = useState(null)
  const [copied, setCopied] = useState(false)

  // ── Step 1: create the group ──────────────────────────────────────────────
  const handleCreateGroup = async e => {
    e.preventDefault()
    if (!groupName.trim()) { setNameError('Group name is required'); return }
    setCreating(true)
    setNameError('')
    try {
      const res = await api.post('/groups', { name: groupName.trim() })
      setGroupId(res.data.id)
      setInviteCode(res.data.invite_code)
      await refreshUser()
      setStep(1)
    } catch (err) {
      setNameError(err.response?.data?.error || 'Failed to create group')
    } finally {
      setCreating(false)
    }
  }

  // ── User search typeahead ─────────────────────────────────────────────────
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    clearTimeout(searchTimeout.current)
    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(searchQuery)}`)
        // Filter out already-selected
        const selectedEmails = new Set(selectedMembers.map(m => m.email.toLowerCase()))
        setSearchResults(res.data.filter(u => !selectedEmails.has(u.email.toLowerCase())))
      } catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 300)
  }, [searchQuery, selectedMembers])

  const addUserFromSearch = user => {
    setSelectedMembers(prev => [...prev, { id: user.id, name: user.name, email: user.email, type: 'user' }])
    setSearchQuery('')
    setSearchResults([])
    searchRef.current?.focus()
  }

  const addEmail = () => {
    const e = emailInput.trim().toLowerCase()
    if (!e) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setEmailError('Enter a valid email address'); return }
    if (selectedMembers.some(m => m.email.toLowerCase() === e)) { setEmailError('Already added'); return }
    setSelectedMembers(prev => [...prev, { name: e, email: e, type: 'email' }])
    setEmailInput('')
    setEmailError('')
  }

  const removeMember = email => {
    setSelectedMembers(prev => prev.filter(m => m.email !== email))
  }

  // ── Step 3: send invites ──────────────────────────────────────────────────
  const handleSendInvites = async () => {
    if (selectedMembers.length === 0) { navigate('/'); return }
    setSending(true)
    try {
      const invites = selectedMembers.map(m => ({ email: m.email, user_id: m.id }))
      const res = await api.post(`/groups/${groupId}/invite`, { invites })
      setSendResults(res.data.results)
      await refreshUser()
      setStep(2)
    } catch (err) {
      setSendResults([{ status: 'error', reason: err.response?.data?.error || 'Failed to send' }])
      setStep(2)
    } finally {
      setSending(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft size={15} /> Back to dashboard
        </button>
        <h1 className="text-2xl font-serif font-semibold text-ink">Create a group</h1>
        <p className="text-slate-500 mt-1 text-sm">Bring up to 5 people together to share recipes, costs, inventory, and your garden.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                ${i < step ? 'bg-moss-500 text-white' : i === step ? 'bg-moss-500 text-white ring-4 ring-moss-100' : 'bg-slate-200 text-slate-500'}`}>
                {i < step ? <Check size={15} /> : i + 1}
              </div>
              <span className={`text-xs mt-1 font-medium whitespace-nowrap ${i === step ? 'text-moss-700' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 ${i < step ? 'bg-moss-400' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP 0: Name ── */}
      {step === 0 && (
        <div className="card">
          <h2 className="text-lg font-serif font-semibold text-ink mb-1">What's your group called?</h2>
          <p className="text-sm text-slate-500 mb-5">Choose a name your crew will recognise.</p>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="label">Group name</label>
              <input
                className="input"
                placeholder="e.g. Krystle's Crew"
                value={groupName}
                onChange={e => { setGroupName(e.target.value); setNameError('') }}
                autoFocus
              />
              {nameError && <p className="text-red-500 text-sm mt-1">{nameError}</p>}
            </div>
            <button type="submit" disabled={creating} className="btn-primary w-full flex items-center justify-center gap-2">
              {creating ? <Loader size={16} className="animate-spin" /> : <><span>Create group</span><ArrowRight size={16} /></>}
            </button>
          </form>
        </div>
      )}

      {/* ── STEP 1: Add members ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-lg font-serif font-semibold text-ink mb-1">Add members</h2>
            <p className="text-sm text-slate-500 mb-5">
              Search for people already on the hub, or enter any email to send them an invite. You can add up to 4 more members.
            </p>

            {/* Search existing users */}
            <label className="label">Search by name or email</label>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                className="input pl-9"
                placeholder="Type a name or email…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searching && <Loader size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
            </div>

            {/* Dropdown results */}
            {searchResults.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-3 overflow-hidden shadow-sm">
                {searchResults.map(u => (
                  <button key={u.id} onClick={() => addUserFromSearch(u)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-moss-50 text-left transition-colors">
                    <div className="w-8 h-8 rounded-full bg-moss-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-moss-700 text-sm font-semibold">{u.name[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{u.name}</p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    </div>
                    <Plus size={15} className="text-moss-500 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-sm text-slate-400 mb-3">No registered users found. Use the email field below to invite them.</p>
            )}

            {/* Email invite */}
            <label className="label mt-2">Invite by email</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  placeholder="someone@email.com"
                  value={emailInput}
                  onChange={e => { setEmailInput(e.target.value); setEmailError('') }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                  type="email"
                />
              </div>
              <button type="button" onClick={addEmail} className="btn-primary px-4">Add</button>
            </div>
            {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
          </div>

          {/* Selected members list */}
          {selectedMembers.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">
                Added ({selectedMembers.length} of 4 slots)
              </h3>
              <div className="space-y-2">
                {selectedMembers.map(m => (
                  <div key={m.email} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${m.type === 'user' ? 'bg-moss-100' : 'bg-terra-100'}`}>
                      {m.type === 'user'
                        ? <span className="text-moss-700 text-sm font-semibold">{m.name[0].toUpperCase()}</span>
                        : <Mail size={14} className="text-terra-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{m.name}</p>
                      {m.type === 'user' && m.name !== m.email &&
                        <p className="text-xs text-slate-500 truncate">{m.email}</p>
                      }
                      {m.type === 'email' &&
                        <p className="text-xs text-slate-400">Invite email will be sent</p>
                      }
                    </div>
                    <button onClick={() => removeMember(m.email)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => navigate('/')} className="btn-ghost flex-1">Skip for now</button>
            <button
              onClick={handleSendInvites}
              disabled={sending || selectedMembers.length === 0}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {sending
                ? <Loader size={16} className="animate-spin" />
                : <><span>{selectedMembers.length === 0 ? 'Skip' : 'Send invites'}</span><ArrowRight size={16} /></>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Done ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card text-center py-8">
            <div className="w-16 h-16 rounded-full bg-moss-100 flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-moss-600" />
            </div>
            <h2 className="text-xl font-serif font-semibold text-ink mb-1">
              {groupName} is ready!
            </h2>
            <p className="text-slate-500 text-sm">Your group has been created and invites are on their way.</p>
          </div>

          {/* Results */}
          {sendResults && sendResults.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">Invite results</h3>
              <div className="space-y-2">
                {sendResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <StatusDot status={r.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink truncate">{r.email || '—'}</p>
                      <p className="text-xs text-slate-400">{statusLabel(r)}</p>
                    </div>
                    {r.accept_url && (
                      <a href={r.accept_url} className="text-xs text-moss-600 underline" target="_blank" rel="noreferrer">
                        Copy link
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite code */}
          <div className="card border-moss-200 bg-moss-50">
            <p className="text-sm font-medium text-moss-700 mb-2">Share the invite code</p>
            <p className="text-xs text-moss-600 mb-3">Anyone with this code can join from the dashboard.</p>
            <div className="flex items-center gap-2">
              <span className="flex-1 font-mono text-xl font-bold text-moss-800 tracking-widest bg-white px-4 py-2.5 rounded-lg border border-moss-200">
                {inviteCode}
              </span>
              <button onClick={copyCode} className="btn-ghost border border-moss-300 flex items-center gap-1.5 text-moss-700">
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <button onClick={() => navigate('/')} className="btn-primary w-full flex items-center justify-center gap-2">
            Go to dashboard <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }) {
  const colors = {
    added: 'bg-moss-500',
    invited: 'bg-moss-500',
    invited_no_email: 'bg-yellow-400',
    already_member: 'bg-slate-300',
    already_invited: 'bg-slate-300',
    skipped: 'bg-slate-300',
    error: 'bg-red-400',
  }
  return (
    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status] || 'bg-slate-300'}`} />
  )
}

function statusLabel(r) {
  switch (r.status) {
    case 'added':            return 'Added to group'
    case 'invited':          return 'Invite email sent'
    case 'invited_no_email': return 'Invite created (email not sent — check SMTP config)'
    case 'already_member':   return 'Already a member'
    case 'already_invited':  return 'Already invited'
    case 'skipped':          return r.reason || 'Skipped'
    case 'error':            return r.reason || 'Error'
    default:                 return r.status
  }
}
