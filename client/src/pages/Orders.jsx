import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import {
  ShoppingBag, ChefHat, Plus, X, Check, Clock, Truck, Ban,
  Eye, EyeOff, Pencil, Trash2, Package, Star
} from 'lucide-react'

// ── Status config ──────────────────────────────────────────────────────────

const STATUS = {
  pending:   { label: 'Pending',   color: 'bg-amber-100  text-amber-700'  },
  accepted:  { label: 'Accepted',  color: 'bg-blue-100   text-blue-700'   },
  ready:     { label: 'Ready! 🎉', color: 'bg-moss-100   text-moss-700'   },
  picked_up: { label: 'Picked Up', color: 'bg-slate-100  text-slate-500'  },
  declined:  { label: 'Declined',  color: 'bg-red-100    text-red-600'    },
}

const NEXT_STATUS = {
  pending:  'accepted',
  accepted: 'ready',
  ready:    'picked_up',
}

function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, color: 'bg-slate-100 text-slate-500' }
  return <span className={`tag ${s.color}`}>{s.label}</span>
}

// ── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function recipeImage(item) {
  if (!item.image_path) return null
  return `${API_BASE}/uploads/${item.image_path.replace(/^uploads\//, '')}`
}

function formatDate(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Request This modal ─────────────────────────────────────────────────────

function RequestModal({ item, onClose, onSubmit, submitting }) {
  const [qty, setQty]   = useState(1)
  const [note, setNote] = useState('')

  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal p-6 max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif font-semibold text-ink text-lg">Request Meal</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          <span className="font-medium text-ink">{item.title}</span>
          {item.price && <span className="ml-2 text-terra-600 font-medium">{item.price}</span>}
        </p>

        <div className="space-y-4">
          <div>
            <label className="label">Quantity</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors text-lg leading-none"
              >−</button>
              <span className="text-lg font-semibold text-ink w-6 text-center">{qty}</span>
              <button
                onClick={() => setQty(q => Math.min(10, q + 1))}
                className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors text-lg leading-none"
              >+</button>
            </div>
          </div>

          <div>
            <label className="label">Note <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Allergies, special instructions…"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => onSubmit({ qty, note })}
            disabled={submitting}
            className="btn-primary flex-1"
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add to Menu modal ──────────────────────────────────────────────────────

function AddToMenuModal({ groupId, onClose, onAdded }) {
  const [recipes, setRecipes]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [price, setPrice]       = useState('')
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')

  useEffect(() => {
    api.get('/recipes', { params: { group_id: groupId } })
      .then(r => setRecipes(Array.isArray(r.data) ? r.data : r.data?.recipes || []))
      .catch(() => setRecipes([]))
      .finally(() => setLoading(false))
  }, [groupId])

  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  const filtered = recipes.filter(r =>
    r.title?.toLowerCase().includes(search.toLowerCase())
  )

  const handleAdd = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await api.post('/orders/menu', {
        recipe_id: selected.id,
        group_id:  groupId,
        price,
        note,
      })
      onAdded(res.data)
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal p-6 max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif font-semibold text-ink text-lg">Add Recipe to Menu</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <input
          className="input mb-3"
          placeholder="Search recipes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg mb-4">
          {loading ? (
            <p className="text-sm text-slate-400 p-4">Loading recipes…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-400 p-4">No recipes found.</p>
          ) : (
            filtered.map(r => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-slate-100 last:border-0 transition-colors ${
                  selected?.id === r.id
                    ? 'bg-moss-50 text-moss-700 font-medium'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <p className="font-medium">{r.title}</p>
                {r.description && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{r.description}</p>
                )}
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="space-y-3 mb-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Details for "{selected.title}"
            </p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label">Price label <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  className="input"
                  placeholder='e.g. "$12"'
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Menu note <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                className="input"
                placeholder='e.g. "Feeds 2–3 people"'
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleAdd}
            disabled={!selected || saving}
            className="btn-primary flex-1"
          >
            {saving ? 'Adding…' : 'Add to Menu'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inline-editable menu item row (admin) ──────────────────────────────────

function MenuItemRow({ item, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [price, setPrice]     = useState(item.price || '')
  const [note, setNote]       = useState(item.note  || '')
  const [saving, setSaving]   = useState(false)

  const save = async () => {
    setSaving(true)
    await onUpdate(item.id, { price, note })
    setSaving(false)
    setEditing(false)
  }

  const toggle = () => onUpdate(item.id, { available: item.available ? 0 : 1 })

  return (
    <div className={`card p-4 transition-opacity ${item.available ? '' : 'opacity-60'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-ink text-sm">{item.title}</p>
            {item.available ? (
              <span className="tag bg-moss-100 text-moss-700">Visible</span>
            ) : (
              <span className="tag bg-slate-100 text-slate-400">Hidden</span>
            )}
            {item.price && !editing && (
              <span className="tag bg-terra-50 text-terra-600">{item.price}</span>
            )}
          </div>

          {item.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
          )}

          {editing ? (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input
                  className="input text-sm flex-1"
                  placeholder="Price label (e.g. $12)"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
                <input
                  className="input text-sm flex-1"
                  placeholder="Menu note"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(false); setPrice(item.price || ''); setNote(item.note || '') }}
                  className="btn-secondary text-xs py-1"
                >
                  Cancel
                </button>
                <button onClick={save} disabled={saving} className="btn-primary text-xs py-1">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            item.note && <p className="text-xs text-slate-400 mt-1 italic">{item.note}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={toggle}
            title={item.available ? 'Hide from menu' : 'Show on menu'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {item.available ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
          <button
            onClick={() => setEditing(e => !e)}
            title="Edit price & note"
            className="p-1.5 rounded-lg text-slate-400 hover:text-terra-600 hover:bg-terra-50 transition-colors"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => onRemove(item.id)}
            title="Remove from menu"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Request row (admin view) ───────────────────────────────────────────────

function RequestRow({ req: r, onStatus }) {
  const [declining, setDeclining] = useState(false)
  const next = NEXT_STATUS[r.status]

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-ink text-sm">{r.recipe_title}</p>
            <StatusBadge status={r.status} />
            {r.quantity > 1 && (
              <span className="tag bg-slate-100 text-slate-600">×{r.quantity}</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            From <span className="font-medium">{r.requester_name}</span>
            {' · '}{formatDate(r.requested_at)}
          </p>
          {r.note && (
            <p className="text-xs text-slate-400 mt-1 italic">"{r.note}"</p>
          )}
        </div>

        {r.status !== 'picked_up' && r.status !== 'declined' && (
          <div className="flex gap-2 flex-shrink-0">
            {next && (
              <button
                onClick={() => onStatus(r.id, next)}
                className="btn-primary text-xs py-1.5 px-3"
              >
                {next === 'accepted'  && 'Accept'}
                {next === 'ready'     && 'Mark Ready'}
                {next === 'picked_up' && 'Picked Up'}
              </button>
            )}
            {declining ? (
              <div className="flex gap-1">
                <button
                  onClick={() => onStatus(r.id, 'declined')}
                  className="text-xs py-1.5 px-3 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors font-medium"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setDeclining(false)}
                  className="btn-secondary text-xs py-1.5 px-2"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDeclining(true)}
                className="btn-secondary text-xs py-1.5 px-3 text-red-500 hover:text-red-700"
              >
                Decline
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Menu card (client browse view) ────────────────────────────────────────

function MenuCard({ item, onRequest }) {
  const img = recipeImage(item)
  const tags = (() => { try { return JSON.parse(item.tags || '[]') } catch { return [] } })()

  return (
    <div className="card overflow-hidden flex flex-col">
      {img ? (
        <div className="h-40 overflow-hidden bg-slate-100">
          <img
            src={img}
            alt={item.title}
            className="w-full h-full object-cover"
            onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
          />
        </div>
      ) : (
        <div className="h-32 bg-gradient-to-br from-moss-50 to-terra-50 flex items-center justify-center">
          <ChefHat size={32} className="text-moss-300" />
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-serif font-semibold text-ink text-base leading-snug">{item.title}</h3>
          {item.price && (
            <span className="text-terra-600 font-semibold text-sm flex-shrink-0">{item.price}</span>
          )}
        </div>

        {item.description && (
          <p className="text-sm text-slate-600 mb-2 line-clamp-2">{item.description}</p>
        )}

        {item.sides && (
          <p className="text-xs text-slate-500 mb-2">
            <span className="font-medium">Sides: </span>{item.sides}
          </p>
        )}

        {item.note && (
          <p className="text-xs text-slate-400 italic mb-2">"{item.note}"</p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.slice(0, 3).map(t => (
              <span key={t} className="tag bg-slate-100 text-slate-500 text-xs">{t}</span>
            ))}
          </div>
        )}

        <div className="mt-auto">
          <button
            onClick={() => onRequest(item)}
            className="btn-primary w-full text-sm"
          >
            Request This
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Admin view ─────────────────────────────────────────────────────────────

function AdminView({ groupId }) {
  const [tab, setTab]           = useState('menu')
  const [menuItems, setMenu]    = useState([])
  const [requests, setRequests] = useState([])
  const [loadingMenu, setLM]    = useState(true)
  const [loadingReqs, setLR]    = useState(true)
  const [showAddModal, setAdd]  = useState(false)

  const loadMenu = useCallback(async () => {
    setLM(true)
    try {
      const r = await api.get(`/orders/menu/${groupId}/all`)
      setMenu(r.data)
    } catch { setMenu([]) }
    setLM(false)
  }, [groupId])

  const loadRequests = useCallback(async () => {
    setLR(true)
    try {
      const r = await api.get(`/orders/requests/${groupId}`)
      setRequests(r.data)
    } catch { setRequests([]) }
    setLR(false)
  }, [groupId])

  useEffect(() => { loadMenu() }, [loadMenu])
  useEffect(() => { loadRequests() }, [loadRequests])

  const handleUpdate = async (id, updates) => {
    try {
      const r = await api.put(`/orders/menu/${id}`, updates)
      setMenu(prev => prev.map(m => m.id === id ? r.data : m))
    } catch (err) { console.error(err) }
  }

  const handleRemove = async (id) => {
    if (!confirm('Remove this item from the menu?')) return
    try {
      await api.delete(`/orders/menu/${id}`)
      setMenu(prev => prev.filter(m => m.id !== id))
    } catch (err) { console.error(err) }
  }

  const handleStatus = async (id, status) => {
    try {
      const r = await api.put(`/orders/requests/${id}/status`, { status })
      setRequests(prev => prev.map(req => req.id === id ? { ...req, ...r.data } : req))
    } catch (err) { console.error(err) }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('menu')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'menu' ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Menu Manager
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
            tab === 'requests' ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Requests
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-terra-500 text-white text-xs flex items-center justify-center font-bold">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Menu Manager tab */}
      {tab === 'menu' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{menuItems.length} item{menuItems.length !== 1 ? 's' : ''} on menu</p>
            <button onClick={() => setAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={15} />
              Add to Menu
            </button>
          </div>

          {loadingMenu ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="card p-4 h-16 bg-slate-50 animate-pulse" />)}
            </div>
          ) : menuItems.length === 0 ? (
            <div className="card p-8 text-center">
              <Package size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 font-medium">No menu items yet</p>
              <p className="text-slate-400 text-sm mt-1">Add recipes to your menu so clients can browse and request meals.</p>
              <button onClick={() => setAdd(true)} className="btn-primary mt-4">Add First Item</button>
            </div>
          ) : (
            <div className="space-y-3">
              {menuItems.map(item => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Requests tab */}
      {tab === 'requests' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{requests.length} total request{requests.length !== 1 ? 's' : ''}</p>
            <button onClick={loadRequests} className="btn-secondary text-xs py-1.5">Refresh</button>
          </div>

          {loadingReqs ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="card p-4 h-20 bg-slate-50 animate-pulse" />)}
            </div>
          ) : requests.length === 0 ? (
            <div className="card p-8 text-center">
              <ShoppingBag size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 font-medium">No requests yet</p>
              <p className="text-slate-400 text-sm mt-1">Once clients submit requests, they'll show up here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(r => (
                <RequestRow key={r.id} req={r} onStatus={handleStatus} />
              ))}
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <AddToMenuModal
          groupId={groupId}
          onClose={() => setAdd(false)}
          onAdded={item => setMenu(prev => [item, ...prev])}
        />
      )}
    </>
  )
}

// ── Client/Member view ─────────────────────────────────────────────────────

function ClientView({ groupId, userId }) {
  const [tab, setTab]             = useState('browse')
  const [menu, setMenu]           = useState([])
  const [myReqs, setMyReqs]       = useState([])
  const [loadingMenu, setLM]      = useState(true)
  const [loadingReqs, setLR]      = useState(true)
  const [requestItem, setReqItem] = useState(null)
  const [submitting, setSub]      = useState(false)

  const loadMenu = useCallback(async () => {
    setLM(true)
    try {
      const r = await api.get(`/orders/menu/${groupId}`)
      setMenu(r.data)
    } catch { setMenu([]) }
    setLM(false)
  }, [groupId])

  const loadMine = useCallback(async () => {
    setLR(true)
    try {
      const r = await api.get(`/orders/requests/${groupId}/mine`)
      setMyReqs(r.data)
    } catch { setMyReqs([]) }
    setLR(false)
  }, [groupId])

  useEffect(() => { loadMenu() }, [loadMenu])
  useEffect(() => { loadMine() }, [loadMine])

  const handleRequest = async ({ qty, note }) => {
    if (!requestItem) return
    setSub(true)
    try {
      await api.post('/orders/requests', {
        menu_item_id: requestItem.id,
        group_id:     groupId,
        quantity:     qty,
        note,
      })
      setReqItem(null)
      await loadMine()
      setTab('mine')
    } catch (err) {
      console.error(err)
    } finally {
      setSub(false)
    }
  }

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('browse')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'browse' ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Browse Menu
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'mine' ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          My Requests
        </button>
      </div>

      {/* Browse tab */}
      {tab === 'browse' && (
        <>
          {loadingMenu ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="card h-64 bg-slate-50 animate-pulse" />)}
            </div>
          ) : menu.length === 0 ? (
            <div className="card p-10 text-center">
              <ChefHat size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Menu is empty</p>
              <p className="text-slate-400 text-sm mt-1">Check back soon — Krystle will add meals here when available.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menu.map(item => (
                <MenuCard key={item.id} item={item} onRequest={setReqItem} />
              ))}
            </div>
          )}
        </>
      )}

      {/* My Requests tab */}
      {tab === 'mine' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{myReqs.length} request{myReqs.length !== 1 ? 's' : ''}</p>
            <button onClick={loadMine} className="btn-secondary text-xs py-1.5">Refresh</button>
          </div>

          {loadingReqs ? (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="card p-4 h-16 bg-slate-50 animate-pulse" />)}
            </div>
          ) : myReqs.length === 0 ? (
            <div className="card p-8 text-center">
              <ShoppingBag size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 font-medium">No requests yet</p>
              <p className="text-slate-400 text-sm mt-1">
                Browse the menu and click "Request This" to place your first order.
              </p>
              <button onClick={() => setTab('browse')} className="btn-primary mt-4">Browse Menu</button>
            </div>
          ) : (
            <div className="space-y-3">
              {myReqs.map(r => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-ink text-sm">{r.recipe_title}</p>
                        <StatusBadge status={r.status} />
                        {r.quantity > 1 && (
                          <span className="tag bg-slate-100 text-slate-600">×{r.quantity}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{formatDate(r.requested_at)}</p>
                      {r.note && (
                        <p className="text-xs text-slate-400 italic mt-1">"{r.note}"</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {requestItem && (
        <RequestModal
          item={requestItem}
          onClose={() => setReqItem(null)}
          onSubmit={handleRequest}
          submitting={submitting}
        />
      )}
    </>
  )
}

// ── Page root ──────────────────────────────────────────────────────────────

export default function Orders() {
  const { user } = useAuth()
  const group    = user?.groups?.[0]
  const groupId  = group?.id
  const isAdmin  = group?.owner_id === user?.id

  if (!groupId) {
    return (
      <div className="card p-10 text-center max-w-lg mx-auto mt-10">
        <ShoppingBag size={40} className="mx-auto text-slate-300 mb-3" />
        <p className="font-serif font-semibold text-ink text-lg">No group found</p>
        <p className="text-slate-500 text-sm mt-1">You need to be in a group to use Krystle's Kitchen Orders.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-moss-500 flex items-center justify-center flex-shrink-0">
          <ShoppingBag size={20} className="text-white" />
        </div>
        <div>
          <h1 className="font-serif font-bold text-ink text-2xl leading-tight">
            Krystle's Kitchen Orders
          </h1>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? 'Manage your menu and incoming meal requests'
              : 'Browse available meals and submit a request'}
          </p>
        </div>
        {isAdmin && (
          <span className="ml-auto tag bg-moss-100 text-moss-700 font-medium">Admin</span>
        )}
      </div>

      {isAdmin ? (
        <AdminView groupId={groupId} />
      ) : (
        <ClientView groupId={groupId} userId={user?.id} />
      )}
    </div>
  )
}
