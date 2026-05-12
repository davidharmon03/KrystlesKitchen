import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import {
  Wrench, Package, ShoppingBag, Plus, ExternalLink,
  Star, Pencil, Trash2, X, Loader, ChevronDown, ChevronUp,
  Users, RefreshCw, Archive
} from 'lucide-react'

const TABS = ['Catalog', "My Group's Gear", 'Standard Supplies']

const CAT_META = {
  hardware:           { label: 'Hardware',           color: 'bg-terra-100 text-terra-700',  border: 'border-terra-200' },
  expendables:        { label: 'Expendables',        color: 'bg-slate-100 text-slate-600',  border: 'border-slate-200' },
  storage_containers: { label: 'Storage Containers', color: 'bg-moss-100 text-moss-700',    border: 'border-moss-200'  },
}

const CONDITION_META = {
  good:             { label: 'Good',             color: 'bg-moss-100 text-moss-700'     },
  fair:             { label: 'Fair',             color: 'bg-yellow-100 text-yellow-700' },
  needs_replacing:  { label: 'Needs Replacing',  color: 'bg-red-100 text-red-700'       },
}

const SUPPLY_META = {
  container:   { label: 'Container',   color: 'bg-moss-100 text-moss-700'   },
  consumable:  { label: 'Consumable',  color: 'bg-amber-100 text-amber-700' },
}

function CatBadge({ cat }) {
  const m = CAT_META[cat] || { label: cat, color: 'bg-slate-100 text-slate-600' }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.color}`}>{m.label}</span>
}

function ConditionBadge({ cond }) {
  const m = CONDITION_META[cond] || { label: cond, color: 'bg-slate-100 text-slate-600' }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.color}`}>{m.label}</span>
}

function SupplyBadge({ type }) {
  const m = SUPPLY_META[type] || { label: type || 'container', color: 'bg-slate-100 text-slate-600' }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.color}`}>{m.label}</span>
}

export default function Equipment() {
  const { user } = useAuth()
  const [tab, setTab] = useState(0)
  const activeGroup = user?.groups?.[0]

  // ── Catalog state
  const [catalog, setCatalog]       = useState([])
  const [catFilter, setCatFilter]   = useState('all')
  const [catLoading, setCatLoading] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  // ── Gear state
  const [gear, setGear]               = useState([])
  const [gearLoading, setGearLoading] = useState(false)
  const [members, setMembers]         = useState([])

  // ── Supplies state
  const [supplies, setSupplies]               = useState([])
  const [suppliesLoading, setSuppliesLoading] = useState(false)
  const [supplyFilter, setSupplyFilter]       = useState('all')

  // ── Modals
  const [addGearModal, setAddGearModal]         = useState(null)
  const [editGearModal, setEditGearModal]       = useState(null)
  const [addSupplyModal, setAddSupplyModal]     = useState(false)
  const [editSupplyModal, setEditSupplyModal]   = useState(null)
  const [deleteConfirm, setDeleteConfirm]       = useState(null)

  const loadCatalog = useCallback(async () => {
    setCatLoading(true)
    try {
      const res = await api.get('/equipment/catalog')
      setCatalog(res.data)
    } catch {}
    finally { setCatLoading(false) }
  }, [])

  const loadGear = useCallback(async () => {
    if (!activeGroup) return
    setGearLoading(true)
    try {
      const [gearRes, groupRes] = await Promise.all([
        api.get(`/equipment/${activeGroup.id}/gear`),
        api.get(`/groups/${activeGroup.id}`),
      ])
      setGear(gearRes.data)
      setMembers(groupRes.data.members || [])
    } catch {}
    finally { setGearLoading(false) }
  }, [activeGroup?.id])

  const loadSupplies = useCallback(async () => {
    if (!activeGroup) return
    setSuppliesLoading(true)
    try {
      const res = await api.get(`/equipment/${activeGroup.id}/containers`)
      setSupplies(res.data)
    } catch {}
    finally { setSuppliesLoading(false) }
  }, [activeGroup?.id])

  useEffect(() => { loadCatalog() }, [loadCatalog])
  useEffect(() => { if (tab === 1) loadGear() },     [tab, loadGear])
  useEffect(() => { if (tab === 2) loadSupplies() }, [tab, loadSupplies])

  const filteredCatalog = catFilter === 'all' ? catalog : catalog.filter(i => i.category === catFilter)
  const grouped = filteredCatalog.reduce((acc, item) => {
    const k = item.category; (acc[k] = acc[k] || []).push(item); return acc
  }, {})

  const filteredSupplies = supplyFilter === 'all'
    ? supplies
    : supplies.filter(s => s.supply_type === supplyFilter)

  // ── Gear handlers
  const handleAddGear = async formData => {
    try {
      await api.post(`/equipment/${activeGroup.id}/gear`, formData)
      await loadGear()
      setAddGearModal(null)
    } catch (err) { alert(err.response?.data?.error || 'Failed to add') }
  }

  const handleEditGear = async formData => {
    try {
      await api.put(`/equipment/${activeGroup.id}/gear/${editGearModal.id}`, formData)
      await loadGear()
      setEditGearModal(null)
    } catch (err) { alert(err.response?.data?.error || 'Failed to update') }
  }

  // ── Supply handlers
  const handleAddSupply = async formData => {
    try {
      await api.post(`/equipment/${activeGroup.id}/containers`, formData)
      await loadSupplies()
      setAddSupplyModal(false)
    } catch (err) { alert(err.response?.data?.error || 'Failed to add') }
  }

  const handleEditSupply = async formData => {
    try {
      await api.put(`/equipment/${activeGroup.id}/containers/${editSupplyModal.id}`, formData)
      await loadSupplies()
      setEditSupplyModal(null)
    } catch (err) { alert(err.response?.data?.error || 'Failed to update') }
  }

  const handleDelete = async () => {
    try {
      if (deleteConfirm.type === 'gear') {
        await api.delete(`/equipment/${activeGroup.id}/gear/${deleteConfirm.id}`)
        await loadGear()
      } else if (deleteConfirm.type === 'supply') {
        await api.delete(`/equipment/${activeGroup.id}/containers/${deleteConfirm.id}`)
        await loadSupplies()
      }
    } catch {}
    setDeleteConfirm(null)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-semibold text-ink flex items-center gap-2">
          <Wrench size={22} className="text-terra-500" /> Equipment
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Catalog of recommended gear, your group's current equipment, and shared supply standards.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${tab === i ? 'border-moss-500 text-moss-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB 0: Catalog ── */}
      {tab === 0 && (
        <div>
          <div className="flex flex-wrap gap-2 mb-5">
            {['all', 'hardware', 'expendables', 'storage_containers'].map(f => (
              <button key={f} onClick={() => setCatFilter(f)}
                className={`px-3 py-1.5 text-sm rounded-full border font-medium transition-colors
                  ${catFilter === f ? 'bg-moss-500 text-white border-moss-500' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {f === 'all' ? 'All' : CAT_META[f]?.label || f}
              </button>
            ))}
          </div>

          {catLoading ? <Spinner /> : Object.keys(grouped).length === 0 ? (
            <p className="text-slate-400 text-sm">No items found.</p>
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-base font-serif font-semibold text-ink">{CAT_META[cat]?.label || cat}</h2>
                    <span className="text-xs text-slate-400">{items.length} items</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {items.map(item => (
                      <CatalogCard
                        key={item.id}
                        item={item}
                        expanded={expandedId === item.id}
                        onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        onAddToGear={activeGroup ? () => setAddGearModal(item) : null}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 1: My Group's Gear ── */}
      {tab === 1 && (
        <div>
          {!activeGroup ? <NoGroup /> : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">{gear.length} item{gear.length !== 1 ? 's' : ''} tracked</p>
                <button onClick={() => setAddGearModal({ custom: true })}
                  className="btn-primary flex items-center gap-1.5 text-sm">
                  <Plus size={15} /> Add custom item
                </button>
              </div>

              {gearLoading ? <Spinner /> : gear.length === 0 ? (
                <div className="card text-center py-10 text-slate-400">
                  <Package size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No gear tracked yet.</p>
                  <p className="text-sm mt-1">Browse the Catalog tab and click "Add to My Gear" to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {gear.map(item => (
                    <GearRow
                      key={item.id}
                      item={item}
                      onEdit={() => setEditGearModal(item)}
                      onDelete={() => setDeleteConfirm({ type: 'gear', id: item.id, name: item.catalog_name || item.custom_name })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: Standard Supplies ── */}
      {tab === 2 && (
        <div>
          {!activeGroup ? <NoGroup /> : (
            <>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-base font-serif font-semibold text-ink">Standard Supplies</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Container types and consumables all households agree to stock. Standardizing means lids,
                    bags, and jars are interchangeable when meals move between households.
                  </p>
                </div>
                <button onClick={() => setAddSupplyModal(true)}
                  className="btn-primary flex items-center gap-1.5 text-sm flex-shrink-0">
                  <Plus size={15} /> Add
                </button>
              </div>

              {/* Supply type filter */}
              <div className="flex gap-2 mb-4">
                {['all', 'container', 'consumable'].map(f => (
                  <button key={f} onClick={() => setSupplyFilter(f)}
                    className={`px-3 py-1.5 text-sm rounded-full border font-medium transition-colors
                      ${supplyFilter === f ? 'bg-moss-500 text-white border-moss-500' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
                  </button>
                ))}
              </div>

              {suppliesLoading ? <Spinner /> : filteredSupplies.length === 0 ? (
                <div className="card text-center py-10 text-slate-400">
                  <Archive size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No supplies defined yet.</p>
                  <p className="text-sm mt-1">Add containers and consumables your group uses so everyone buys the same ones.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredSupplies.map(s => (
                    <SupplyCard
                      key={s.id}
                      supply={s}
                      onEdit={() => setEditSupplyModal(s)}
                      onDelete={() => setDeleteConfirm({ type: 'supply', id: s.id, name: s.container_type })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {addGearModal && (
        <GearFormModal
          title={addGearModal.custom ? 'Add Custom Item' : `Add to My Gear — ${addGearModal.name}`}
          initial={{ catalog_item_id: addGearModal.custom ? '' : addGearModal.id, custom_name: '', quantity: 1, owner_user_id: '', condition: 'good', notes: '' }}
          isCustom={!!addGearModal.custom}
          members={members}
          onSubmit={handleAddGear}
          onClose={() => setAddGearModal(null)}
        />
      )}
      {editGearModal && (
        <GearFormModal
          title={`Edit — ${editGearModal.catalog_name || editGearModal.custom_name}`}
          initial={{ quantity: editGearModal.quantity, owner_user_id: editGearModal.owner_user_id || '', condition: editGearModal.condition || 'good', notes: editGearModal.notes || '' }}
          isCustom={false}
          isEdit
          members={members}
          onSubmit={handleEditGear}
          onClose={() => setEditGearModal(null)}
        />
      )}
      {addSupplyModal && (
        <SupplyFormModal
          title="Add Supply"
          initial={{ container_type: '', size_capacity: '', material: '', description: '', purchase_url: '', supply_type: 'container' }}
          onSubmit={handleAddSupply}
          onClose={() => setAddSupplyModal(false)}
        />
      )}
      {editSupplyModal && (
        <SupplyFormModal
          title={`Edit — ${editSupplyModal.container_type}`}
          initial={editSupplyModal}
          onSubmit={handleEditSupply}
          onClose={() => setEditSupplyModal(null)}
        />
      )}
      {deleteConfirm && (
        <ConfirmModal
          message={`Delete "${deleteConfirm.name}"?`}
          onConfirm={handleDelete}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function CatalogCard({ item, expanded, onToggle, onAddToGear }) {
  return (
    <div className={`card border ${CAT_META[item.category]?.border || 'border-slate-200'} transition-shadow hover:shadow-md`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-ink text-sm leading-snug">{item.name}</h3>
            {item.is_recommended === 1 && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                <Star size={10} fill="currentColor" /> Recommended
              </span>
            )}
          </div>
          {item.brand && <p className="text-xs text-slate-400 mt-0.5">{item.brand}</p>}
        </div>
        <CatBadge cat={item.category} />
      </div>

      {expanded && item.description && (
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.description}</p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <button onClick={onToggle} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Less' : 'Details'}
        </button>
        <div className="flex items-center gap-2">
          {item.purchase_url && (
            <a href={item.purchase_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-moss-600 hover:text-moss-700 font-medium">
              Buy <ExternalLink size={11} />
            </a>
          )}
          {onAddToGear && (
            <button onClick={onAddToGear}
              className="flex items-center gap-1 text-xs bg-moss-500 text-white px-2.5 py-1 rounded-lg hover:bg-moss-600 font-medium transition-colors">
              <Plus size={12} /> Add to My Gear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function GearRow({ item, onEdit, onDelete }) {
  const name = item.catalog_name || item.custom_name || 'Unknown'
  return (
    <div className="card flex items-center gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-ink">{name}</p>
          {item.brand && <span className="text-xs text-slate-400">{item.brand}</span>}
          {item.category && <CatBadge cat={item.category} />}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-xs text-slate-500">Qty: <strong>{item.quantity}</strong></span>
          {item.owner_name && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Users size={11} /> {item.owner_name}
            </span>
          )}
          {item.notes && <span className="text-xs text-slate-400 italic truncate max-w-xs">{item.notes}</span>}
        </div>
      </div>
      <ConditionBadge cond={item.condition} />
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-moss-600 transition-colors rounded">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function SupplyCard({ supply, onEdit, onDelete }) {
  const isConsumable = supply.supply_type === 'consumable'
  return (
    <div className={`card border ${isConsumable ? 'border-amber-200 bg-amber-50' : 'border-moss-200 bg-moss-50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-ink text-sm">{supply.container_type}</h3>
            <SupplyBadge type={supply.supply_type} />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {supply.size_capacity && (
              <span className="text-xs text-slate-600 font-medium">{supply.size_capacity}</span>
            )}
            {supply.material && (
              <span className="text-xs text-slate-500">{supply.material}</span>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-moss-600 transition-colors rounded">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {supply.description && (
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{supply.description}</p>
      )}
      {supply.purchase_url && (
        <a href={supply.purchase_url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs text-moss-600 hover:text-moss-700 font-medium">
          Where to buy <ExternalLink size={11} />
        </a>
      )}
    </div>
  )
}

function GearFormModal({ title, initial, isCustom, isEdit, members, onSubmit, onClose }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    await onSubmit(form)
    setSaving(false)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {isCustom && (
          <div>
            <label className="label">Item name</label>
            <input className="input" required placeholder="e.g. Chest Freezer" value={form.custom_name} onChange={set('custom_name')} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantity</label>
            <input className="input" type="number" min="1" required value={form.quantity} onChange={set('quantity')} />
          </div>
          <div>
            <label className="label">Condition</label>
            <select className="input" value={form.condition} onChange={set('condition')}>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="needs_replacing">Needs Replacing</option>
            </select>
          </div>
        </div>
        {members.length > 0 && (
          <div>
            <label className="label">Who has it</label>
            <select className="input" value={form.owner_user_id} onChange={set('owner_user_id')}>
              <option value="">— Unassigned —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Notes</label>
          <input className="input" placeholder="Optional notes…" value={form.notes} onChange={set('notes')} />
        </div>
        <ModalActions saving={saving} onClose={onClose} label={isEdit ? 'Save Changes' : 'Add to Gear'} />
      </form>
    </Modal>
  )
}

function SupplyFormModal({ title, initial, onSubmit, onClose }) {
  const [form, setForm] = useState({ supply_type: 'container', ...initial })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    await onSubmit(form)
    setSaving(false)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Name *</label>
            <input className="input" required placeholder="e.g. 32oz Pyrex Glass" value={form.container_type} onChange={set('container_type')} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.supply_type || 'container'} onChange={set('supply_type')}>
              <option value="container">Container</option>
              <option value="consumable">Consumable</option>
            </select>
          </div>
          <div>
            <label className="label">Size / Capacity</label>
            <input className="input" placeholder="e.g. 32 oz" value={form.size_capacity || ''} onChange={set('size_capacity')} />
          </div>
        </div>
        <div>
          <label className="label">Material / Brand</label>
          <input className="input" placeholder="e.g. Borosilicate Glass" value={form.material || ''} onChange={set('material')} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={2} placeholder="Why this? Any usage notes…"
            value={form.description || ''} onChange={set('description')} />
        </div>
        <div>
          <label className="label">Purchase link</label>
          <input className="input" placeholder="https://…" type="url" value={form.purchase_url || ''} onChange={set('purchase_url')} />
        </div>
        <ModalActions saving={saving} onClose={onClose} label={form.id ? 'Save Changes' : 'Add Supply'} />
      </form>
    </Modal>
  )
}

function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <Modal title="Confirm Delete" onClose={onClose}>
      <p className="text-slate-600 mb-5">{message} This can't be undone.</p>
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
        <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors text-sm">
          Delete
        </button>
      </div>
    </Modal>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-serif font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({ saving, onClose, label }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
      <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
        {saving ? <Loader size={15} className="animate-spin" /> : label}
      </button>
    </div>
  )
}

function NoGroup() {
  return (
    <div className="card text-center py-10 border-terra-200 bg-terra-50">
      <Users size={32} className="mx-auto mb-3 text-terra-400" />
      <p className="font-semibold text-terra-800">You need a group to use this tab.</p>
      <p className="text-sm text-terra-600 mt-1">Create or join a group from the dashboard first.</p>
      <Link to="/" className="inline-block mt-4 btn-terra text-sm">Go to Dashboard</Link>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <Loader size={24} className="animate-spin text-moss-500" />
    </div>
  )
}
