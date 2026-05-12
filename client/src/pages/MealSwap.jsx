import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import RatingModal from '../components/RatingModal'
import {
  ArrowLeftRight, Calendar, ChevronDown, ChevronUp,
  Clock, Edit2, Loader, Plus, X, Check, Star
} from 'lucide-react'

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  assigned:    { label: 'Assigned',    bg: 'bg-slate-100',  text: 'text-slate-600', border: 'border-slate-200' },
  in_progress: { label: 'In Progress', bg: 'bg-terra-100',  text: 'text-terra-700', border: 'border-terra-200' },
  ready:       { label: 'Ready',       bg: 'bg-moss-100',   text: 'text-moss-700',  border: 'border-moss-300'  },
  swapped:     { label: 'Swapped',     bg: 'bg-slate-200',  text: 'text-slate-500', border: 'border-slate-300' },
}
const STATUS_ORDER = ['assigned', 'in_progress', 'ready', 'swapped']
const NEXT_STATUS  = { assigned: 'in_progress', in_progress: 'ready', ready: 'swapped', swapped: null }

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target - today) / 86_400_000)
}

function fmtSwapDay(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  })
}

function initials(name = '') {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ user }) {
  if (user?.avatar_path) {
    return (
      <img
        src={`${API_BASE}/uploads/avatars/${user.avatar_path.split('/').pop()}`}
        alt={user.user_name}
        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
    )
  }
  return (
    <div className="w-10 h-10 rounded-full bg-terra-100 flex items-center justify-center flex-shrink-0">
      <span className="text-terra-600 font-semibold text-sm">{initials(user?.user_name)}</span>
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.assigned
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {status === 'ready' && (
        <span className="w-1.5 h-1.5 rounded-full bg-moss-500 mr-1.5 animate-pulse" />
      )}
      {cfg.label}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MealSwap() {
  const { user } = useAuth()
  const groupId = user?.groups?.[0]?.id

  const [data,          setData]          = useState(null)   // { week, entrees }
  const [history,       setHistory]       = useState([])
  const [members,       setMembers]       = useState([])
  const [recipes,       setRecipes]       = useState([])
  const [isAdmin,       setIsAdmin]       = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [showHistory,   setShowHistory]   = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [updateEntreeModal, setUpdateEntreeModal] = useState(null)   // entree object
  const [createModal,   setCreateModal]   = useState(false)
  const [ratingModal,   setRatingModal]   = useState(null)   // { entree, weekId }
  const [ratings,       setRatings]       = useState({})     // entree.id => { stars, comment }

  const load = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    try {
      const [swapRes, groupRes, recipeRes] = await Promise.all([
        api.get('/swaps', { params: { group_id: groupId } }),
        api.get(`/groups/${groupId}`),
        api.get('/recipes', { params: { group_id: groupId } }).catch(() => ({ data: [] })),
      ])
      setData(swapRes.data)
      setMembers(groupRes.data.members || [])
      setIsAdmin(groupRes.data.owner_id === user?.id)
      setRecipes(recipeRes.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [groupId, user?.id])

  useEffect(() => { load() }, [load])

  const loadHistory = async () => {
    if (historyLoaded) return
    try {
      const res = await api.get('/swaps/history', { params: { group_id: groupId } })
      setHistory(res.data)
      setHistoryLoaded(true)
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleHistory = () => {
    if (!showHistory) loadHistory()
    setShowHistory(s => !s)
  }

  const handleUpdateEntree = async (entree, newStatus, notes) => {
    try {
      await api.put(`/swaps/${data.week.id}/entrees/${entree.id}`, { status: newStatus, notes })
      setUpdateEntreeModal(null)
      await load()
    } catch (err) {
      console.error(err)
    }
  }

  const handleCompleteWeek = async () => {
    if (!data?.week) return
    if (!window.confirm('Mark this swap week as complete? All entrées will be marked as Swapped.')) return
    try {
      await api.put(`/swaps/${data.week.id}/complete`)
      setHistoryLoaded(false)
      await load()
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreate = async (form) => {
    try {
      await api.post('/swaps', { group_id: groupId, ...form })
      setCreateModal(false)
      await load()
    } catch (err) {
      console.error(err)
    }
  }

  if (!groupId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <ArrowLeftRight size={32} className="text-slate-300 mb-3" />
        <p className="text-slate-500 text-sm">You need to be in a group to use Entrée Swap.</p>
      </div>
    )
  }

  const week           = data?.week
  const entrees        = data?.entrees || []
  const days           = week ? daysUntil(week.swap_day) : null
  const readyOrSwapped = entrees.filter(e => e.status === 'ready' || e.status === 'swapped').length

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="section-header mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-moss-100 flex items-center justify-center">
              <ArrowLeftRight size={20} className="text-moss-600" />
            </div>
            <div>
              <h1 className="page-title">Entree Swap</h1>
              <p className="text-sm text-slate-500">One entree per couple, swapped on swap day</p>
            </div>
          </div>
          {isAdmin && !week && (
            <button onClick={() => setCreateModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> New Swap Week
            </button>
          )}
          {isAdmin && week && (
            <button onClick={() => setCreateModal(true)} className="btn-ghost text-sm flex items-center gap-1.5">
              <Plus size={14} /> New Week
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader size={24} className="animate-spin text-moss-400" />
        </div>
      ) : week ? (
        <>
          {/* ── Swap Day Banner ── */}
          <div className={`rounded-2xl p-5 mb-6 border ${
            days < 0   ? 'bg-slate-50 border-slate-200' :
            days === 0 ? 'bg-moss-50 border-moss-300'   :
            days <= 3  ? 'bg-terra-50 border-terra-200'  :
                         'bg-cream border-slate-200'
          }`}>
            <div className="flex items-start justify-between flex-wrap gap-4">
              {/* Left: date */}
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  days === 0 ? 'bg-moss-100'  :
                  days < 0   ? 'bg-slate-100' :
                  days <= 3  ? 'bg-terra-100' : 'bg-white border border-slate-200'
                }`}>
                  <Calendar size={20} className={
                    days === 0 ? 'text-moss-600'  :
                    days < 0   ? 'text-slate-400' :
                    days <= 3  ? 'text-terra-500' : 'text-slate-500'
                  } />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Swap Day</p>
                  <p className="text-lg font-serif font-semibold text-ink leading-tight">
                    {fmtSwapDay(week.swap_day)}
                  </p>
                  {week.week_label && (
                    <p className="text-xs text-slate-400 mt-0.5">{week.week_label}</p>
                  )}
                </div>
              </div>

              {/* Right: countdown + progress dots */}
              <div className="flex flex-col items-end gap-2">
                {days === 0 ? (
                  <span className="font-bold text-moss-600 text-sm bg-moss-50 border border-moss-200 px-3 py-1 rounded-full">
                    Today — it's swap day! 🎉
                  </span>
                ) : days < 0 ? (
                  <span className="text-slate-400 text-sm">{Math.abs(days)} days ago</span>
                ) : (
                  <span className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full border ${
                    days <= 3
                      ? 'text-terra-700 bg-terra-50 border-terra-200'
                      : 'text-slate-600 bg-white border-slate-200'
                  }`}>
                    <Clock size={13} />
                    {days} {days === 1 ? 'day' : 'days'} away
                  </span>
                )}

                <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 border border-slate-100">
                  {entrees.map(e => (
                    <div
                      key={e.id}
                      title={`${e.user_name}: ${STATUS_CONFIG[e.status]?.label}`}
                      className={`w-2.5 h-2.5 rounded-full transition-colors ${
                        e.status === 'swapped'     ? 'bg-slate-400' :
                        e.status === 'ready'       ? 'bg-moss-500'  :
                        e.status === 'in_progress' ? 'bg-terra-400' :
                                                     'bg-slate-200'
                      }`}
                    />
                  ))}
                  <span className="text-xs text-slate-400 ml-0.5">
                    {readyOrSwapped}/{entrees.length} ready
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Entree Cards ── */}
          <div className="space-y-3 mb-6">
            {entrees.length === 0 ? (
              <div className="card text-center py-12 text-slate-400 text-sm">
                No entrees assigned to this swap week yet.
              </div>
            ) : (
              entrees.map(entree => {
                const isMyEntree = entree.user_id === user.id
                const isReady    = entree.status === 'ready'
                return (
                  <div
                    key={entree.id}
                    className={`card flex items-start gap-4 transition-all duration-200 ${
                      isReady ? 'ring-2 ring-moss-300 shadow-lg shadow-moss-100' : ''
                    }`}
                  >
                    <Avatar user={entree} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold text-ink text-sm">{entree.user_name}</span>
                        {isMyEntree && (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                            You
                          </span>
                        )}
                        <StatusBadge status={entree.status} />
                      </div>

                      <p className="text-base font-medium text-ink">{entree.entree_name}</p>

                      {entree.recipe_title && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Recipe: {entree.recipe_title}
                        </p>
                      )}
                      {entree.sides && entree.sides.length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Sides: {entree.sides.join(', ')}
                        </p>
                      )}
                      {entree.notes && (
                        <p className="text-sm text-slate-500 mt-1 italic">{entree.notes}</p>
                      )}
                    </div>

                    {isMyEntree && week.status === 'active' && entree.status !== 'swapped' && (
                      <button
                        onClick={() => setUpdateEntreeModal(entree)}
                        className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0"
                      >
                        <Edit2 size={13} />
                        Update
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* ── Admin: complete swap ── */}
          {isAdmin && week.status === 'active' && (
            <div className="flex items-center justify-between py-4 border-t border-slate-100 mb-6">
              <p className="text-sm text-slate-400">Everyone exchanged their meals?</p>
              <button onClick={handleCompleteWeek} className="btn-secondary text-sm flex items-center gap-1.5">
                <Check size={14} /> Mark Swap Complete
              </button>
            </div>
          )}
        </>
      ) : (
        /* No active swap week */
        <div className="card text-center py-16 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <ArrowLeftRight size={24} className="text-slate-300" />
          </div>
          <p className="font-semibold text-ink">No active swap week</p>
          <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
            {isAdmin
              ? 'Create a swap week to assign entrées and set the swap day.'
              : 'Ask your group admin to set up the next swap week.'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setCreateModal(true)}
              className="btn-primary mt-5 inline-flex items-center gap-2"
            >
              <Plus size={16} /> New Swap Week
            </button>
          )}
        </div>
      )}

      {/* ── Past Swaps ── */}
      <div className="mb-8">
        <button
          onClick={handleToggleHistory}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
        >
          {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          Past Swaps
        </button>

        {showHistory && (
          <div className="mt-3 space-y-4">
            {history.length === 0 ? (
              <p className="text-sm text-slate-400 pl-1">No past swaps yet.</p>
            ) : (
              history.map(({ week: hw, entrees: he }) => (
                <div key={hw.id} className="card">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-ink text-sm">{fmtSwapDay(hw.swap_day)}</p>
                      {hw.week_label && <p className="text-xs text-slate-400 mt-0.5">{hw.week_label}</p>}
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                      Completed
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {he.map(e => (
                      <div key={e.id} className="flex items-center justify-between gap-2 text-sm group">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-medium text-ink">{e.user_name}</span>
                              <span className="text-slate-500">— {e.entree_name}</span>
                            </div>
                            {e.sides && e.sides.length > 0 && (
                              <p className="text-xs text-slate-400 mt-0.5">Sides: {e.sides.join(', ')}</p>
                            )}
                          </div>
                        </div>
                        {e.user_id !== user?.id && (
                          <button
                            onClick={() => setRatingModal({ entree: e, weekId: hw.id })}
                            className="text-slate-300 hover:text-terra-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                            title="Rate this entree"
                          >
                            <Star size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {updateEntreeModal && (
        <UpdateStatusModal
          entree={updateEntreeModal}
          onSave={handleUpdateEntree}
          onClose={() => setUpdateEntreeModal(null)}
        />
      )}
      {createModal && (
        <CreateSwapModal
          members={members}
          recipes={recipes}
          onSave={handleCreate}
          onClose={() => setCreateModal(false)}
        />
      )}
      {ratingModal && (
        <RatingModal
          isOpen={!!ratingModal}
          entree={ratingModal.entree}
          weekId={ratingModal.weekId}
          onClose={() => setRatingModal(null)}
          onSave={() => {
            setRatingModal(null)
            loadHistory()
          }}
        />
      )}
    </div>
  )
}

// ─── Update Status Modal ──────────────────────────────────────────────────────
function UpdateStatusModal({ entree, onSave, onClose }) {
  const [status, setStatus] = useState(entree.status)
  const [notes,  setNotes]  = useState(entree.notes || '')
  const [sides,  setSides]  = useState(entree.sides ? entree.sides.join(', ') : '')
  const [saving, setSaving] = useState(false)

  const nextStatus = NEXT_STATUS[entree.status]

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      // Save entree update (status, notes)
      await onSave(entree, status, notes)

      // Save sides separately if they changed
      if (sides !== (entree.sides ? entree.sides.join(', ') : '')) {
        const sidesArray = sides
          ? sides.split(',').map(s => s.trim()).filter(Boolean)
          : []
        try {
          await api.post(`/swaps/${entree.week_id}/entrees/${entree.id}/sides`, { sides: sidesArray })
        } catch (err) {
          console.error('Failed to save sides:', err)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-serif font-semibold text-ink">Update Your Entree</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <p className="font-medium text-ink text-sm mb-1">{entree.entree_name}</p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              Current: <StatusBadge status={entree.status} />
            </div>
          </div>

          {/* Quick advance */}
          {nextStatus && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">Quick update</p>
              <button
                type="button"
                onClick={() => setStatus(nextStatus)}
                className={`w-full text-sm font-semibold py-2 rounded-lg border transition-all ${
                  status === nextStatus
                    ? 'bg-moss-500 text-white border-moss-500'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-moss-300 hover:bg-moss-50'
                }`}
              >
                Mark as {STATUS_CONFIG[nextStatus].label}
              </button>
            </div>
          )}

          {/* Full status picker */}
          <div>
            <label className="label">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map(s => {
                const cfg    = STATUS_CONFIG[s]
                const active = status === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      active
                        ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-1 ring-offset-1 ring-current`
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Allergens, containers, anything the group should know…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Suggested Sides</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="e.g. roasted vegetables, rice pilaf (comma-separated)"
              value={sides}
              onChange={e => setSides(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">Optional - suggest side dishes to accompany this entree</p>
          </div>

          <div className="flex gap-2 pt-1">
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="btn-ghost px-4">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-4 flex items-center gap-1.5">
              {saving ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Create Swap Week Modal (admin) ───────────────────────────────────────────
function CreateSwapModal({ members, recipes, onSave, onClose }) {
  const [swapDay,    setSwapDay]    = useState('')
  const [weekLabel,  setWeekLabel]  = useState('')
  const [entreeRows, setEntreeRows] = useState(
    () => members.map(m => ({ user_id: m.id, entree_name: '', recipe_id: '', notes: '', sides: '' }))
  )
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const updateRow = (idx, field, val) => {
    setEntreeRows(rows => {
      const next = [...rows]
      next[idx] = { ...next[idx], [field]: val }
      if (field === 'recipe_id' && val) {
        const r = recipes.find(r => r.id === val)
        if (r && !next[idx].entree_name) next[idx].entree_name = r.title
      }
      return next
    })
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!swapDay) { setErr('Please set a swap day.'); return }
    const filled = entreeRows.filter(r => r.user_id && r.entree_name.trim()).map(r => ({
      ...r,
      sides: r.sides
        ? r.sides.split(',').map(s => s.trim()).filter(Boolean)
        : []
    }))
    if (filled.length === 0) { setErr('Assign at least one entree.'); return }
    setSaving(true)
    try {
      await onSave({ swap_day: swapDay, week_label: weekLabel, entrees: filled })
    } catch {
      setErr('Failed to create swap week.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-serif font-semibold text-ink">New Swap Week</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
            {err && <p className="text-red-500 text-xs">{err}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Swap Day *</label>
                <input
                  type="date"
                  className="input"
                  value={swapDay}
                  onChange={e => setSwapDay(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Label (optional)</label>
                <input
                  className="input"
                  placeholder="e.g. May Swap #2"
                  value={weekLabel}
                  onChange={e => setWeekLabel(e.target.value)}
                />
              </div>
            </div>

            <div>
              <p className="label mb-2">Entree Assignments</p>
              <div className="space-y-3">
                {members.map((member, idx) => (
                  <div key={member.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-ink mb-2">{member.name}</p>
                    <div className="space-y-2">
                      <select
                        className="input text-sm"
                        value={entreeRows[idx]?.recipe_id || ''}
                        onChange={e => updateRow(idx, 'recipe_id', e.target.value)}
                      >
                        <option value="">— link a recipe (optional) —</option>
                        {recipes.map(r => (
                          <option key={r.id} value={r.id}>{r.title}</option>
                        ))}
                      </select>
                      <input
                        className="input text-sm"
                        placeholder="Entree name *"
                        value={entreeRows[idx]?.entree_name || ''}
                        onChange={e => updateRow(idx, 'entree_name', e.target.value)}
                      />
                      <input
                        className="input text-sm"
                        placeholder="Suggested sides (optional)"
                        value={entreeRows[idx]?.sides || ''}
                        onChange={e => updateRow(idx, 'sides', e.target.value)}
                      />
                      <input
                        className="input text-sm"
                        placeholder="Notes (optional)"
                        value={entreeRows[idx]?.notes || ''}
                        onChange={e => updateRow(idx, 'notes', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="btn-ghost px-4">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-4 flex items-center gap-1.5">
              {saving ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
              Create Swap Week
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
