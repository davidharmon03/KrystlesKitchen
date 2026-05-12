import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import { Lightbulb, ThumbsUp, ThumbsDown, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'

// ── badge components ───────────────────────────────────────────────────────

function SuggestionStatusBadge({ status }) {
  const map = {
    open:     'bg-slate-100 text-slate-600',
    accepted: 'bg-moss-100 text-moss-700',
    declined: 'bg-gray-100 text-gray-500',
    used:     'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`tag ${map[status] || 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  )
}

function FeatureStatusBadge({ status }) {
  const map = {
    submitted: 'bg-slate-100 text-slate-600',
    reviewing: 'bg-terra-100 text-terra-600',
    planned:   'bg-amber-100 text-amber-700',
    shipped:   'bg-moss-100 text-moss-700',
    declined:  'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`tag ${map[status] || 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  )
}

function CategoryBadge({ category }) {
  const map = {
    bug:         'bg-red-100 text-red-700',
    feature:     'bg-moss-100 text-moss-700',
    improvement: 'bg-terra-100 text-terra-600',
    other:       'bg-slate-100 text-slate-600',
  }
  return (
    <span className={`tag ${map[category] || 'bg-slate-100 text-slate-500'}`}>
      {category}
    </span>
  )
}

// ── suggest meal modal ─────────────────────────────────────────────────────

function SuggestMealModal({ onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({ meal_name: '', description: '', recipe_id: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleKey = e => { if (e.key === 'Escape') onClose() }
  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  })

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-serif font-semibold text-ink text-lg">Suggest an Entrée</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Entrée name *</label>
            <input
              className="input"
              placeholder="e.g. Thai Green Curry"
              value={form.meal_name}
              onChange={e => set('meal_name', e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="What's the vibe? Any special notes?"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Recipe link <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              className="input"
              placeholder="https://..."
              value={form.recipe_id}
              onChange={e => set('recipe_id', e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button
            onClick={() => onSubmit(form)}
            disabled={!form.meal_name.trim() || submitting}
            className="btn-primary flex-1 text-sm"
          >
            {submitting ? 'Submitting…' : 'Suggest Entrée'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── submit idea modal ──────────────────────────────────────────────────────

function SubmitIdeaModal({ onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'feature' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleKey = e => { if (e.key === 'Escape') onClose() }
  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  })

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-serif font-semibold text-ink text-lg">Submit an Idea</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input
              className="input"
              placeholder="Short summary of your idea or issue"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.category}
              onChange={e => set('category', e.target.value)}
            >
              <option value="feature">Feature Request</option>
              <option value="bug">Bug Report</option>
              <option value="improvement">Improvement</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[100px] resize-none"
              placeholder="Describe the idea, bug, or improvement in detail…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button
            onClick={() => onSubmit(form)}
            disabled={!form.title.trim() || submitting}
            className="btn-primary flex-1 text-sm"
          >
            {submitting ? 'Submitting…' : 'Submit Idea'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── suggestion card ────────────────────────────────────────────────────────

function SuggestionCard({ s, isAdmin, onVote, onStatus }) {
  const upvotes   = Number(s.upvotes)
  const downvotes = Number(s.downvotes)
  const net       = upvotes - downvotes

  return (
    <div className="card flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-serif font-semibold text-ink leading-snug">{s.meal_name}</h4>
        <SuggestionStatusBadge status={s.status} />
      </div>

      {/* Body */}
      {s.description && (
        <p className="text-slate-500 text-sm leading-relaxed flex-1">{s.description}</p>
      )}
      {s.recipe_id && (
        <a
          href={s.recipe_id.startsWith('http') ? s.recipe_id : '#'}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-moss-600 hover:underline"
        >
          View recipe →
        </a>
      )}
      <p className="text-xs text-slate-400">Suggested by {s.suggested_by_name}</p>

      {/* Vote row */}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-100">
        <button
          onClick={() => onVote(s.id, 'up')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
            s.my_vote === 'up'
              ? 'bg-moss-100 text-moss-700'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          <ThumbsUp size={14} />
          <span>{upvotes}</span>
        </button>

        <button
          onClick={() => onVote(s.id, 'down')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
            s.my_vote === 'down'
              ? 'bg-terra-100 text-terra-700'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          <ThumbsDown size={14} />
          <span>{downvotes}</span>
        </button>

        {net !== 0 && (
          <span className={`text-xs font-semibold ml-auto ${net > 0 ? 'text-moss-600' : 'text-terra-600'}`}>
            {net > 0 ? '+' : ''}{net}
          </span>
        )}
      </div>

      {/* Admin actions */}
      {isAdmin && s.status === 'open' && (
        <div className="flex gap-1.5 pt-2 border-t border-slate-100">
          <button
            onClick={() => onStatus(s.id, 'accepted')}
            className="flex-1 text-xs py-1.5 px-2 rounded-md bg-moss-50 text-moss-700 hover:bg-moss-100 font-medium transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => onStatus(s.id, 'declined')}
            className="flex-1 text-xs py-1.5 px-2 rounded-md text-slate-500 hover:bg-slate-100 font-medium transition-colors"
          >
            Decline
          </button>
          <button
            onClick={() => onStatus(s.id, 'used')}
            className="flex-1 text-xs py-1.5 px-2 rounded-md text-amber-700 hover:bg-amber-50 font-medium transition-colors"
          >
            Used
          </button>
        </div>
      )}
      {isAdmin && s.status === 'accepted' && (
        <div className="flex gap-1.5 pt-2 border-t border-slate-100">
          <button
            onClick={() => onStatus(s.id, 'used')}
            className="flex-1 text-xs py-1.5 px-2 rounded-md text-amber-700 hover:bg-amber-50 font-medium transition-colors"
          >
            Mark Used
          </button>
          <button
            onClick={() => onStatus(s.id, 'open')}
            className="flex-1 text-xs py-1.5 px-2 rounded-md text-slate-500 hover:bg-slate-100 font-medium transition-colors"
          >
            Reopen
          </button>
        </div>
      )}
    </div>
  )
}

// ── meal ideas tab ─────────────────────────────────────────────────────────

const MEAL_FILTERS = [
  { key: 'open',     label: 'Open'     },
  { key: 'accepted', label: 'Accepted' },
  { key: 'past',     label: 'Past'     },
]

function MealIdeasTab({ user, activeGroup, isAdmin }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState('open')
  const [showModal, setShowModal]     = useState(false)
  const [submitting, setSubmitting]   = useState(false)

  const load = useCallback(() => {
    if (!activeGroup?.id) return
    setLoading(true)
    api.get(`/suggestions?group_id=${activeGroup.id}&status=${filter}`)
      .then(r => setSuggestions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeGroup?.id, filter])

  useEffect(() => { load() }, [load])

  const handleVote = async (id, vote) => {
    try {
      const res = await api.post(`/suggestions/${id}/vote`, { vote })
      setSuggestions(prev => prev.map(s => {
        if (s.id !== id) return s
        const old     = s.my_vote
        const newVote = res.data.my_vote
        let upvotes   = Number(s.upvotes)
        let downvotes = Number(s.downvotes)
        if (old   === 'up')   upvotes--
        if (old   === 'down') downvotes--
        if (newVote === 'up')   upvotes++
        if (newVote === 'down') downvotes++
        return { ...s, my_vote: newVote, upvotes, downvotes }
      }))
    } catch {}
  }

  const handleStatus = async (id, status) => {
    try {
      await api.put(`/suggestions/${id}/status`, { status })
      setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status } : s))
    } catch {}
  }

  const handleSubmit = async (form) => {
    setSubmitting(true)
    try {
      const res = await api.post('/suggestions', {
        group_id:    activeGroup.id,
        meal_name:   form.meal_name,
        description: form.description,
        recipe_id:   form.recipe_id || null,
      })
      if (filter === 'open') setSuggestions(prev => [res.data, ...prev])
      setShowModal(false)
    } catch {}
    finally { setSubmitting(false) }
  }

  if (!activeGroup) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-full bg-moss-100 flex items-center justify-center mx-auto mb-4">
          <Lightbulb size={24} className="text-moss-600" />
        </div>
        <h3 className="font-serif font-semibold text-ink text-lg mb-2">Join a group first</h3>
        <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
          Meal suggestions are shared within your group. Create or join a group from your dashboard to get started.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {/* Filter bar */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {MEAL_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-slate-500 hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          <Plus size={15} />
          Suggest an Entrée
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-full" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-14">
          <p className="text-slate-400 text-sm">
            No {filter} suggestions yet.
            {filter === 'open' && (
              <> <button onClick={() => setShowModal(true)} className="text-moss-600 hover:underline">Be the first to suggest an entrée.</button></>
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suggestions.map(s => (
            <SuggestionCard
              key={s.id}
              s={s}
              isAdmin={isAdmin}
              userId={user?.id}
              onVote={handleVote}
              onStatus={handleStatus}
            />
          ))}
        </div>
      )}

      {showModal && (
        <SuggestMealModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  )
}

// ── feature request row ────────────────────────────────────────────────────

const FEATURE_STATUSES = ['submitted', 'reviewing', 'planned', 'shipped', 'declined']

function FeatureRequestRow({ r, isAdmin, expanded, onToggle, onVote, onStatus }) {
  const dateStr = new Date(r.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        {/* Upvote button */}
        <button
          onClick={() => onVote(r.id)}
          className={`flex flex-col items-center gap-0.5 min-w-[42px] px-2 py-2 rounded-lg transition-colors ${
            r.my_vote
              ? 'bg-moss-100 text-moss-700'
              : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          <ThumbsUp size={14} />
          <span className="text-xs font-semibold leading-none">{Number(r.votes)}</span>
        </button>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <button className="w-full text-left" onClick={onToggle}>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-medium text-ink text-sm leading-snug">{r.title}</span>
              <CategoryBadge category={r.category} />
              <FeatureStatusBadge status={r.status} />
            </div>
            <p className="text-xs text-slate-400">
              by {r.submitted_by} · {dateStr}
            </p>
          </button>

          {expanded && r.description && (
            <p className="text-sm text-slate-600 mt-3 pt-3 border-t border-slate-100 leading-relaxed">
              {r.description}
            </p>
          )}

          {isAdmin && (
            <div className="mt-2">
              <select
                value={r.status}
                onChange={e => { e.stopPropagation(); onStatus(r.id, e.target.value) }}
                onClick={e => e.stopPropagation()}
                className="text-xs border border-slate-200 rounded-md px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-moss-400 cursor-pointer"
              >
                {FEATURE_STATUSES.map(s => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Expand chevron */}
        {r.description && (
          <button
            onClick={onToggle}
            className="text-slate-400 hover:text-slate-600 transition-colors mt-0.5 flex-shrink-0"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>
    </div>
  )
}

// ── app feedback tab ───────────────────────────────────────────────────────

function AppFeedbackTab({ user, isAdmin }) {
  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded]   = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/feature-requests')
      .then(r => setRequests(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleVote = async (id) => {
    try {
      const res = await api.post(`/feature-requests/${id}/vote`)
      setRequests(prev => prev.map(r => {
        if (r.id !== id) return r
        const delta = res.data.my_vote ? 1 : -1
        return { ...r, votes: Number(r.votes) + delta, my_vote: res.data.my_vote }
      }))
    } catch {}
  }

  const handleStatus = async (id, status) => {
    try {
      await api.put(`/feature-requests/${id}`, { status })
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    } catch {}
  }

  const handleSubmit = async (form) => {
    setSubmitting(true)
    try {
      const res = await api.post('/feature-requests', form)
      setRequests(prev => [res.data, ...prev])
      setShowModal(false)
    } catch {}
    finally { setSubmitting(false) }
  }

  const toggleExpand = (id) => setExpanded(prev => prev === id ? null : id)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500">Vote on ideas or flag bugs. All members see this list.</p>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          <Plus size={15} />
          Submit an Idea
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse h-16" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-14">
          <p className="text-slate-400 text-sm">
            No ideas yet.{' '}
            <button onClick={() => setShowModal(true)} className="text-moss-600 hover:underline">
              Be the first to submit one.
            </button>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <FeatureRequestRow
              key={r.id}
              r={r}
              isAdmin={isAdmin}
              expanded={expanded === r.id}
              onToggle={() => toggleExpand(r.id)}
              onVote={handleVote}
              onStatus={handleStatus}
            />
          ))}
        </div>
      )}

      {showModal && (
        <SubmitIdeaModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  )
}

// ── main page ──────────────────────────────────────────────────────────────

const TABS = [
  { key: 'meals',    label: 'Meal Ideas'   },
  { key: 'feedback', label: 'App Feedback' },
]

export default function Suggestions() {
  const { user } = useAuth()
  const [tab, setTab] = useState('meals')
  const activeGroup = user?.groups?.[0]
  const isAdmin     = !!(user?.groups?.some(g => g.owner_id === user?.id))

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="section-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-moss-100 flex items-center justify-center flex-shrink-0">
            <Lightbulb size={20} className="text-moss-600" />
          </div>
          <div>
            <h1 className="page-title">Suggestions</h1>
            <p className="text-slate-500 text-sm">Vote on meal ideas and shape how the app grows</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-slate-200 mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'text-moss-700 border-moss-600'
                : 'text-slate-500 border-transparent hover:text-ink hover:border-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'meals' ? (
        <MealIdeasTab user={user} activeGroup={activeGroup} isAdmin={isAdmin} />
      ) : (
        <AppFeedbackTab user={user} isAdmin={isAdmin} />
      )}
    </div>
  )
}
