import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import { photoUrl } from '../components/PhotoUpload'
import BarcodeScanner from '../components/BarcodeScanner'
import {
  Package, Plus, Trash2, Check, ShoppingCart, Layers, X,
  Loader, Pencil, Users, DollarSign, ChevronLeft, ShoppingBag,
  Search, Scan, Camera, Printer
} from 'lucide-react'
import { firstName } from '../utils/userName'

const CATEGORIES    = ['protein', 'produce', 'staple', 'dairy', 'grain', 'condiment', 'other']
const STORAGE_TYPES = ['vacuum sealed', 'frozen', 'fresh', 'canned', 'dry storage']
const BULK_CATS     = ['protein', 'produce', 'staple', 'dairy', 'grain', 'paper goods', 'condiment', 'other']
const SECTION_ORDER = ['produce', 'meat', 'dairy', 'frozen', 'bakery', 'pantry', 'bulk', 'beverages', 'deli', 'household', 'other']
const SECTION_EMOJI = { produce:'🥦', meat:'🥩', dairy:'🥛', frozen:'🧊', bakery:'🍞', pantry:'🥫', bulk:'⚖️', beverages:'🥤', deli:'🧀', household:'🧺', other:'📦' }

const STORAGE_COLORS = {
  'vacuum sealed': 'bg-moss-100 text-moss-700',
  'frozen':        'bg-blue-100 text-blue-700',
  'fresh':         'bg-green-100 text-green-700',
  'canned':        'bg-amber-100 text-amber-700',
  'dry storage':   'bg-slate-100 text-slate-600',
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function NoGroup() {
  return (
    <div className="text-center py-16 text-slate-400">
      <p className="font-medium">Join or create a group to get started.</p>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-moss-200 border-t-moss-600 rounded-full animate-spin" />
    </div>
  )
}

function ProductThumb({ product, size = 40 }) {
  if (!product) return null
  const base = (typeof window !== 'undefined' && window.__VITE_API_BASE__) || 'http://localhost:3001'
  const src = product.image_path
    ? `${base}/${product.image_path}`
    : product.product_image_path
      ? `${base}/${product.product_image_path}`
      : product.image_url || product.product_image_url || null

  const s = { width: size, height: size }
  if (!src) return (
    <div style={s} className="rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
      <Package size={Math.round(size * 0.45)} className="text-slate-300" />
    </div>
  )
  return (
    <img src={src} alt={product.name || ''} style={s}
      className="rounded-lg object-cover flex-shrink-0 bg-slate-100"
      onError={e => { e.currentTarget.style.display = 'none' }} />
  )
}

// ── Meal photo button — inline upload for existing inventory / VS items ───────
function MealPhotoButton({ gid, itemId, field, existingPath, onUploaded }) {
  const inputRef   = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  const displayUrl = previewUrl || photoUrl(existingPath)

  const handleFile = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('photo',    file)
      fd.append('group_id', gid)
      fd.append(field,      itemId)
      fd.append('stage',    'stored')
      const res = await api.post('/photos', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onUploaded?.(res.data)
    } catch {} finally { setUploading(false) }
  }

  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
      {displayUrl ? (
        <div className="relative w-10 h-10 cursor-pointer" onClick={() => inputRef.current?.click()}>
          <img src={displayUrl} alt="meal photo"
            className="w-10 h-10 rounded-lg object-cover border border-slate-200 bg-slate-100"
            onError={e => { e.currentTarget.style.display = 'none' }} />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
              <Loader size={13} className="animate-spin text-moss-600" />
            </div>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="w-10 h-10 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center hover:border-moss-400 hover:bg-moss-50 transition-colors">
          {uploading
            ? <Loader size={13} className="animate-spin text-moss-600" />
            : <Camera size={13} className="text-slate-400" />}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

// ── Product search typeahead ──────────────────────────────────────────────────
function ProductSearch({ gid, placeholder, onSelect, className = '' }) {
  const [q, setQ]           = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)

  const search = useCallback(async val => {
    if (!val.trim() || val.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await api.get('/products/search', { params: { q: val, group_id: gid } })
      setResults(res.data)
      setOpen(res.data.length > 0)
    } catch { setResults([]) } finally { setLoading(false) }
  }, [gid])

  const handleChange = e => {
    setQ(e.target.value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => search(e.target.value), 350)
  }

  const select = product => {
    onSelect(product)
    setQ('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input className="input pl-8 pr-8" placeholder={placeholder || 'Search products...'}
          value={q} onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)} />
        {loading && <Loader size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 z-40 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-72 overflow-y-auto">
          {results.map((p, i) => (
            <button key={p.id || p.off_id || i} onMouseDown={() => select(p)}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-slate-50 text-left border-b border-slate-100 last:border-0">
              <ProductThumb product={p} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {p.brand && <span className="text-xs text-slate-400">{p.brand}</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    p.source === 'open_food_facts' ? 'bg-blue-100 text-blue-600' : 'bg-moss-100 text-moss-700'
                  }`}>{p.source === 'open_food_facts' ? 'OFF' : 'catalog'}</span>
                </div>
              </div>
              {p.unit_size && <span className="text-xs text-slate-400 flex-shrink-0">{p.unit_size}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Inventory add form ────────────────────────────────────────────────────────
function InvForm({ onAdd, loading, gid }) {
  const EMPTY = { name: '', quantity: '', category: 'produce', storage_type: 'fresh', notes: '', product_id: null, product_image_url: '' }
  const [form, setForm]         = useState(EMPTY)
  const [barcode, setBarcode]   = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [barcodeError, setBarcodeError]     = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)

  const set = f => e => setForm(v => ({ ...v, [f]: e.target.value }))

  const onProductSelect = p => {
    setForm(v => ({
      ...v,
      name:              p.name || v.name,
      category:          p.category || v.category,
      product_id:        p.id || null,
      product_image_url: p.image_url || p.image_path || '',
    }))
  }

  const lookupBarcode = async () => {
    if (!barcode.trim()) return
    setBarcodeLoading(true)
    setBarcodeError('')
    try {
      const res = await api.get(`/products/barcode/${barcode.trim()}`)
      if (res.data) {
        onProductSelect(res.data)
        setBarcode('')
      } else {
        setBarcodeError('Product not found')
      }
    } catch {
      setBarcodeError('Lookup failed')
    } finally { setBarcodeLoading(false) }
  }

  const submit = e => {
    e.preventDefault()
    onAdd(form).then(() => { setForm(EMPTY); setBarcode('') })
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-3">
        <ProductSearch gid={gid} placeholder="Search catalog to pre-fill…" onSelect={onProductSelect} />

        <div>
          <label className="label">Barcode scan / enter</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Scan size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input className="input pl-8" placeholder="Scan or type barcode…"
                value={barcode} onChange={e => { setBarcode(e.target.value); setBarcodeError('') }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), lookupBarcode())} />
            </div>
            <button type="button" onClick={() => setScannerOpen(true)} title="Open camera scanner"
              className="btn-ghost text-sm flex items-center gap-1 flex-shrink-0 p-1.5">
              <Camera size={14} />
            </button>
            <button type="button" onClick={lookupBarcode} disabled={barcodeLoading || !barcode.trim()}
              className="btn-ghost text-sm flex items-center gap-1 flex-shrink-0">
              {barcodeLoading ? <Loader size={13} className="animate-spin" /> : 'Look up'}
            </button>
          </div>
          {barcodeError && <p className="text-xs text-red-500 mt-1">{barcodeError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Item name *</label>
            <div className="flex items-center gap-2">
              {form.product_image_url && (
                <ProductThumb product={{ image_url: form.product_image_url, name: form.name }} size={36} />
              )}
              <input required className="input flex-1" placeholder="e.g. Chicken breast"
                value={form.name} onChange={set('name')} />
            </div>
          </div>
          <div><label className="label">Quantity *</label>
            <input required className="input" placeholder="e.g. 2 lbs" value={form.quantity} onChange={set('quantity')} /></div>
          <div><label className="label">Category</label>
            <select className="input" value={form.category} onChange={set('category')}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div className="col-span-2"><label className="label">Storage type</label>
            <select className="input" value={form.storage_type} onChange={set('storage_type')}>
              {STORAGE_TYPES.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div><label className="label">Notes (optional)</label>
          <input className="input" placeholder="Any extra info" value={form.notes} onChange={set('notes')} /></div>
        <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2">
          <Plus size={15} /> {loading ? 'Adding…' : 'Add Item'}</button>
      </form>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={async (scannedBarcode) => {
          setBarcode(scannedBarcode)
          setBarcodeError('')
          // Auto-lookup the scanned barcode
          setBarcodeLoading(true)
          try {
            const res = await api.get(`/products/barcode/${scannedBarcode.trim()}`)
            if (res.data) {
              onProductSelect(res.data)
              setBarcode('')
            } else {
              setBarcodeError('Product not found')
            }
          } catch {
            setBarcodeError('Lookup failed')
          } finally {
            setBarcodeLoading(false)
          }
        }}
      />
    </>
  )
}

// ── Vacuum seal add form ──────────────────────────────────────────────────────
function VSForm({ onAdd, loading, gid }) {
  const EMPTY = { item_name: '', quantity: '', seal_date: '', expiry_date: '', storage_location: '', notes: '', product_id: null, product_image_url: '' }
  const [form, setForm]         = useState(EMPTY)
  const [barcode, setBarcode]   = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [barcodeError, setBarcodeError]     = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)

  const set = f => e => setForm(v => ({ ...v, [f]: e.target.value }))

  const onProductSelect = p => {
    setForm(v => ({
      ...v,
      item_name:         p.name || v.item_name,
      product_id:        p.id || null,
      product_image_url: p.image_url || p.image_path || '',
    }))
  }

  const lookupBarcode = async () => {
    if (!barcode.trim()) return
    setBarcodeLoading(true)
    setBarcodeError('')
    try {
      const res = await api.get(`/products/barcode/${barcode.trim()}`)
      if (res.data) {
        onProductSelect(res.data)
        setBarcode('')
      } else {
        setBarcodeError('Product not found')
      }
    } catch {
      setBarcodeError('Lookup failed')
    } finally { setBarcodeLoading(false) }
  }

  const submit = e => {
    e.preventDefault()
    onAdd(form).then(() => { setForm(EMPTY); setBarcode('') })
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-3">
        <ProductSearch gid={gid} placeholder="Search catalog to pre-fill…" onSelect={onProductSelect} />

        <div>
          <label className="label">Barcode scan / enter</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Scan size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input className="input pl-8" placeholder="Scan or type barcode…"
                value={barcode} onChange={e => { setBarcode(e.target.value); setBarcodeError('') }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), lookupBarcode())} />
            </div>
            <button type="button" onClick={() => setScannerOpen(true)} title="Open camera scanner"
              className="btn-ghost text-sm flex items-center gap-1 flex-shrink-0 p-1.5">
              <Camera size={14} />
            </button>
            <button type="button" onClick={lookupBarcode} disabled={barcodeLoading || !barcode.trim()}
              className="btn-ghost text-sm flex items-center gap-1 flex-shrink-0">
              {barcodeLoading ? <Loader size={13} className="animate-spin" /> : 'Look up'}
            </button>
          </div>
          {barcodeError && <p className="text-xs text-red-500 mt-1">{barcodeError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Item name *</label>
            <div className="flex items-center gap-2">
              {form.product_image_url && (
                <ProductThumb product={{ image_url: form.product_image_url, name: form.item_name }} size={36} />
              )}
              <input required className="input flex-1" placeholder="e.g. Ribeye steaks"
                value={form.item_name} onChange={set('item_name')} />
            </div>
          </div>
          <div><label className="label">Quantity</label>
            <input className="input" placeholder="e.g. 4 portions" value={form.quantity} onChange={set('quantity')} /></div>
          <div><label className="label">Seal date *</label>
            <input required type="date" className="input" value={form.seal_date} onChange={set('seal_date')} /></div>
          <div><label className="label">Expiry date (optional)</label>
            <input type="date" className="input" value={form.expiry_date} onChange={set('expiry_date')} /></div>
          <div><label className="label">Storage location</label>
            <input className="input" placeholder="e.g. Chest freezer" value={form.storage_location} onChange={set('storage_location')} /></div>
        </div>
        <div><label className="label">Notes</label>
          <input className="input" placeholder="e.g. Cook from frozen at 375°F" value={form.notes} onChange={set('notes')} /></div>
        <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2">
          <Plus size={15} /> {loading ? 'Adding…' : 'Log Seal'}</button>
      </form>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={async (scannedBarcode) => {
          setBarcode(scannedBarcode)
          setBarcodeError('')
          // Auto-lookup the scanned barcode
          setBarcodeLoading(true)
          try {
            const res = await api.get(`/products/barcode/${scannedBarcode.trim()}`)
            if (res.data) {
              onProductSelect(res.data)
              setBarcode('')
            } else {
              setBarcodeError('Product not found')
            }
          } catch {
            setBarcodeError('Lookup failed')
          } finally {
            setBarcodeLoading(false)
          }
        }}
      />
    </>
  )
}

// ── Bulk Buy: Run list ────────────────────────────────────────────────────────
function BulkRunList({ runs, members, loading, onSelect, onAdd, onDelete }) {
  const [form, setForm]       = useState({ name: '', run_date: '', buyer_user_id: '' })
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const set = f => e => setForm(v => ({ ...v, [f]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await onAdd(form)
      setForm({ name: '', run_date: '', buyer_user_id: '' })
      setShowForm(false)
      if (res) onSelect(res)
    } finally { setCreating(false) }
  }

  const STATUS_COLORS = { planning: 'bg-amber-100 text-amber-700', completed: 'bg-moss-100 text-moss-700' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{runs.length} run{runs.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={15} /> New Run</button>
      </div>

      {showForm && (
        <div className="card border-moss-200 bg-moss-50">
          <h3 className="font-semibold text-ink mb-3 font-serif text-sm">New Bulk Buy Run</h3>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Run name *</label>
                <input required className="input" placeholder="e.g. Sam's Club April Run" value={form.name} onChange={set('name')} /></div>
              <div><label className="label">Date *</label>
                <input required type="date" className="input" value={form.run_date} onChange={set('run_date')} /></div>
              <div><label className="label">Who's buying</label>
                <select className="input" value={form.buyer_user_id} onChange={set('buyer_user_id')}>
                  <option value="">— TBD —</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1">
                {creating ? <Loader size={14} className="animate-spin" /> : 'Create Run'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <Spinner /> : runs.length === 0 ? (
        <div className="card text-center py-10 text-slate-400">
          <ShoppingBag size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No bulk buy runs yet.</p>
          <p className="text-sm mt-1">Create a run when the group is planning a warehouse store trip.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map(run => (
            <div key={run.id} className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelect(run)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-ink text-sm">{run.name}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[run.status] || 'bg-slate-100 text-slate-600'}`}>
                      {run.status}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span>📅 {run.run_date}</span>
                    {run.buyer_name && <span className="flex items-center gap-1"><Users size={11} /> {run.buyer_name} buys</span>}
                    <span>{run.item_count} item{run.item_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); onDelete(run) }}
                  className="p-1.5 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Bulk Buy: Add Item Form ───────────────────────────────────────────────────
function AddItemForm({ members, gid, onAdd }) {
  const [form, setForm]     = useState({ item_name: '', category: 'other', quantity: '', est_cost: '', requested_by: '', notes: '', product_id: null, product_image_url: '' })
  const [saving, setSaving] = useState(false)
  const set = f => e => setForm(v => ({ ...v, [f]: e.target.value }))

  const onProductSelect = p => {
    setForm(v => ({
      ...v,
      item_name:         p.name || v.item_name,
      category:          p.category || v.category,
      product_id:        p.id || null,
      product_image_url: p.image_url || '',
    }))
  }

  const submit = async e => {
    e.preventDefault()
    setSaving(true)
    try { await onAdd(form) } finally { setSaving(false) }
  }

  return (
    <div className="card border-moss-200 bg-moss-50">
      <h3 className="font-semibold text-ink mb-3 font-serif text-sm">Add Item</h3>
      <ProductSearch gid={gid} placeholder="Search catalog to pre-fill..." onSelect={onProductSelect} className="mb-3" />
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Item name *</label>
            <div className="flex items-center gap-2">
              {form.product_image_url && <img src={form.product_image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 bg-slate-100" onError={e => e.currentTarget.style.display='none'} />}
              <input required className="input flex-1" placeholder="e.g. Chicken breast" value={form.item_name} onChange={set('item_name')} />
            </div>
          </div>
          <div><label className="label">Category</label>
            <select className="input" value={form.category} onChange={set('category')}>
              {BULK_CATS.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Quantity</label>
            <input className="input" placeholder="e.g. 10 lbs" value={form.quantity} onChange={set('quantity')} /></div>
          <div><label className="label">Est. cost ($)</label>
            <input type="number" step="0.01" className="input" placeholder="0.00" value={form.est_cost} onChange={set('est_cost')} /></div>
          <div><label className="label">Requested by</label>
            <select className="input" value={form.requested_by} onChange={set('requested_by')}>
              <option value="">— Anyone —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select></div>
          <div className="col-span-2"><label className="label">Notes</label>
            <input className="input" placeholder="Brand preference, etc." value={form.notes} onChange={set('notes')} /></div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1">
            {saving ? <Loader size={14} className="animate-spin" /> : <><Plus size={14} /> Add Item</>}</button>
        </div>
      </form>
    </div>
  )
}

// ── Bulk Buy: Run detail ──────────────────────────────────────────────────────
function BulkRunDetail({ run, members, gid, onBack, onRunUpdated }) {
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [settlement, setSettlement] = useState(null)
  const [showSettlement, setShowSettlement] = useState(false)
  const [editingCost, setEditingCost] = useState(null)
  const [costVal, setCostVal]       = useState('')
  const [showItemForm, setShowItemForm] = useState(false)
  const [editRun, setEditRun]       = useState(false)
  const [runForm, setRunForm]       = useState({ name: run.name, run_date: run.run_date, buyer_user_id: run.buyer_user_id || '', status: run.status })

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/kuzine/${gid}/bulk-buys/${run.id}/items`)
      setItems(res.data)
    } catch {} finally { setLoading(false) }
  }, [gid, run.id])

  useEffect(() => { loadItems() }, [loadItems])

  const addItem = async form => {
    await api.post(`/kuzine/${gid}/bulk-buys/${run.id}/items`, form)
    await loadItems()
  }
  const deleteItem = async id => {
    if (!confirm('Remove item?')) return
    await api.delete(`/kuzine/${gid}/bulk-buys/${run.id}/items/${id}`)
    await loadItems()
  }
  const saveActualCost = async item => {
    await api.put(`/kuzine/${gid}/bulk-buys/${run.id}/items/${item.id}`, { actual_cost: costVal === '' ? null : parseFloat(costVal) })
    setEditingCost(null)
    await loadItems()
  }
  const fetchSettlement = async () => {
    const res = await api.get(`/kuzine/${gid}/bulk-buys/${run.id}/settlement`)
    setSettlement(res.data)
    setShowSettlement(true)
  }
  const saveRunEdits = async () => {
    const res = await api.put(`/kuzine/${gid}/bulk-buys/${run.id}`, runForm)
    onRunUpdated(res.data)
    setEditRun(false)
  }

  const totalEst    = items.reduce((s, i) => s + (parseFloat(i.est_cost)    || 0), 0)
  const totalActual = items.reduce((s, i) => s + (parseFloat(i.actual_cost) || 0), 0)
  const hasActual   = items.some(i => i.actual_cost != null)
  const STATUS_COLORS = { planning: 'bg-amber-100 text-amber-700', completed: 'bg-moss-100 text-moss-700' }
  const grouped = items.reduce((acc, item) => {
    const cat = item.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 font-medium">
          <ChevronLeft size={16} /> All Runs</button>
      </div>

      <div className="card">
        {editRun ? (
          <div className="space-y-3">
            <h3 className="font-semibold text-ink font-serif text-sm">Edit Run</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Name</label>
                <input className="input" value={runForm.name} onChange={e => setRunForm(f => ({...f, name: e.target.value}))} /></div>
              <div><label className="label">Date</label>
                <input type="date" className="input" value={runForm.run_date} onChange={e => setRunForm(f => ({...f, run_date: e.target.value}))} /></div>
              <div><label className="label">Status</label>
                <select className="input" value={runForm.status} onChange={e => setRunForm(f => ({...f, status: e.target.value}))}>
                  <option value="planning">Planning</option>
                  <option value="completed">Completed</option>
                </select></div>
              <div className="col-span-2"><label className="label">Who's buying</label>
                <select className="input" value={runForm.buyer_user_id} onChange={e => setRunForm(f => ({...f, buyer_user_id: e.target.value}))}>
                  <option value="">— TBD —</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditRun(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={saveRunEdits} className="btn-primary flex-1 text-sm">Save</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="font-semibold text-ink">{run.name}</h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[run.status] || 'bg-slate-100 text-slate-600'}`}>
                  {run.status}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                <span>📅 {run.run_date}</span>
                {run.buyer_name && <span className="flex items-center gap-1"><Users size={11} /> {run.buyer_name} buys</span>}
              </div>
            </div>
            <button onClick={() => setEditRun(true)} className="btn-ghost text-sm flex items-center gap-1">
              <Pencil size={14} /> Edit</button>
          </div>
        )}
      </div>

      <div className="card bg-slate-50 flex items-center gap-6 flex-wrap">
        <div>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Est. Total</p>
          <p className="text-lg font-bold text-ink">${totalEst.toFixed(2)}</p>
        </div>
        {hasActual && (
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Actual Total</p>
            <p className="text-lg font-bold text-moss-700">${totalActual.toFixed(2)}</p>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowItemForm(v => !v)} className="btn-primary text-sm flex items-center gap-1">
            <Plus size={14} /> Add Item</button>
          <button onClick={fetchSettlement} className="btn-ghost text-sm flex items-center gap-1">
            <DollarSign size={14} /> Settle Up</button>
        </div>
      </div>

      {showItemForm && (
        <AddItemForm members={members} gid={gid} onAdd={async form => { await addItem(form); setShowItemForm(false) }} />
      )}

      {loading ? <Spinner /> : items.length === 0 ? (
        <div className="card text-center py-8 text-slate-400">
          <ShoppingCart size={28} className="mx-auto mb-2 opacity-30" />
          <p>No items yet. Add some to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat} className="card">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 capitalize">{cat}</h4>
              <div className="space-y-2">
                {catItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                    <ProductThumb product={{ image_url: item.product_image_url, name: item.item_name }} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">{item.item_name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap mt-0.5">
                        <span>qty: {item.quantity_needed || '—'}</span>
                        {item.requested_by_name && <span>for {item.requested_by_name}</span>}
                        {item.notes && <span className="text-slate-300">· {item.notes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Est.</p>
                        <p className="text-sm text-slate-600">{item.est_cost ? `$${parseFloat(item.est_cost).toFixed(2)}` : '—'}</p>
                      </div>
                      <div className="text-right min-w-[60px]">
                        <p className="text-xs text-slate-400">Actual</p>
                        {editingCost === item.id ? (
                          <input autoFocus type="number" step="0.01"
                            className="input text-xs py-0.5 px-1 w-16 text-right"
                            value={costVal} onChange={e => setCostVal(e.target.value)}
                            onBlur={() => saveActualCost(item)}
                            onKeyDown={e => { if (e.key === 'Enter') saveActualCost(item); if (e.key === 'Escape') setEditingCost(null) }} />
                        ) : (
                          <button onClick={() => { setEditingCost(item.id); setCostVal(item.actual_cost ?? '') }}
                            className="text-sm font-medium text-moss-700 hover:underline">
                            {item.actual_cost != null ? `$${parseFloat(item.actual_cost).toFixed(2)}` : <span className="text-slate-300 italic">set</span>}
                          </button>
                        )}
                      </div>
                      <button onClick={() => deleteItem(item.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showSettlement && settlement && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-semibold text-ink">Settle Up</h3>
              <button onClick={() => setShowSettlement(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              <span className="font-semibold text-ink">{settlement.run?.buyer_name || 'Buyer'}</span> paid the total. Here's what everyone else owes:
            </p>
            {settlement.settlements?.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No settlements needed — buyer requested everything.</p>
            ) : (
              <div className="space-y-2">
                {settlement.settlements?.map(s => (
                  <div key={s.user_id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-sm font-medium text-ink">{s.name}</span>
                    <span className="text-sm font-bold text-moss-700">${parseFloat(s.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between">
              <span className="text-xs text-slate-400">Total paid</span>
              <span className="text-sm font-bold text-ink">${parseFloat(settlement.total || 0).toFixed(2)}</span>
            </div>
            <button onClick={() => setShowSettlement(false)} className="btn-primary w-full mt-4 text-sm">Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shopping List Tab ─────────────────────────────────────────────────────────
function ShoppingListTab({ gid }) {
  const [lists, setLists]           = useState([])
  const [activeListId, setActiveListId] = useState(null)
  const [items, setItems]           = useState([])
  const [loadingLists, setLoadingLists] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [showNewList, setShowNewList]   = useState(false)
  const [newListName, setNewListName]   = useState('')
  const [addingManual, setAddingManual] = useState(false)
  const [manualForm, setManualForm]     = useState({ name: '', quantity: '', unit: '', store_section: 'other' })
  const [pendingProduct, setPendingProduct] = useState(null)
  const [pendingQty, setPendingQty]     = useState('')
  const [scannerOpen, setScannerOpen]   = useState(false)

  const loadLists = useCallback(async () => {
    setLoadingLists(true)
    try {
      const res = await api.get('/shopping-lists', { params: { group_id: gid } })
      setLists(res.data)
      if (res.data.length > 0) setActiveListId(id => id || res.data[0].id)
    } catch {} finally { setLoadingLists(false) }
  }, [gid])

  const loadItems = useCallback(async () => {
    if (!activeListId) return
    setLoadingItems(true)
    try {
      const res = await api.get(`/shopping-lists/${activeListId}/items`)
      setItems(res.data)
    } catch {} finally { setLoadingItems(false) }
  }, [activeListId])

  useEffect(() => { loadLists() }, [loadLists])
  useEffect(() => { loadItems() }, [loadItems])

  const createList = async () => {
    const res = await api.post('/shopping-lists', { group_id: gid, name: newListName || 'Weekly Shop' })
    setLists(l => [res.data, ...l])
    setActiveListId(res.data.id)
    setShowNewList(false)
    setNewListName('')
  }

  const addFromProduct = async (product, qty) => {
    if (!activeListId) return
    await api.post(`/shopping-lists/${activeListId}/items`, {
      name:          product.name,
      product_id:    product.id || null,
      quantity:      qty || '',
      unit:          product.unit_type || '',
      store_section: product.store_section || 'other',
      category:      product.category || 'other',
    })
    setPendingProduct(null)
    setPendingQty('')
    await loadItems()
  }

  const addManual = async e => {
    e.preventDefault()
    await api.post(`/shopping-lists/${activeListId}/items`, manualForm)
    setManualForm({ name: '', quantity: '', unit: '', store_section: 'other' })
    setAddingManual(false)
    await loadItems()
  }

  const toggleCheck = async item => {
    const updated = { ...item, is_checked: item.is_checked ? 0 : 1 }
    setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    await api.put(`/shopping-lists/${activeListId}/items/${item.id}`, { is_checked: updated.is_checked })
  }

  const deleteItem = async item => {
    await api.delete(`/shopping-lists/${activeListId}/items/${item.id}`)
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  const clearChecked = async () => {
    await api.delete(`/shopping-lists/${activeListId}/items`)
    setItems(prev => prev.filter(i => !i.is_checked))
  }

  const completeList = async () => {
    if (!confirm('Mark this list as complete and archive it?')) return
    await api.put(`/shopping-lists/${activeListId}/complete`)
    setLists(prev => prev.filter(l => l.id !== activeListId))
    setItems([])
    setActiveListId(null)
  }

  const grouped = items.reduce((acc, item) => {
    const s = item.store_section || 'other'
    ;(acc[s] = acc[s] || []).push(item)
    return acc
  }, {})
  const sortedSections = Object.keys(grouped).sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a), bi = SECTION_ORDER.indexOf(b)
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
  })
  const checkedCount = items.filter(i => i.is_checked).length

  if (loadingLists) return <Spinner />

  if (lists.length === 0 && !showNewList) return (
    <div className="space-y-4">
      <div className="card text-center py-12">
        <ShoppingCart size={36} className="mx-auto mb-3 opacity-30 text-slate-400" />
        <p className="font-medium text-slate-600 mb-1">No shopping lists yet.</p>
        <p className="text-sm text-slate-400 mb-4">Create a list to start tracking what you need to buy.</p>
        <button onClick={() => setShowNewList(true)} className="btn-primary">Create First List</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* List selector row */}
      <div className="flex items-center gap-2 flex-wrap">
        {lists.length > 0 && (
          <select className="input flex-1 min-w-0 text-sm" value={activeListId || ''} onChange={e => setActiveListId(e.target.value)}>
            {lists.map(l => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.item_count ?? 0} items{l.checked_count > 0 ? `, ${l.checked_count} ✓` : ''})
              </option>
            ))}
          </select>
        )}
        <button onClick={() => setShowNewList(v => !v)} className="no-print btn-ghost text-sm flex items-center gap-1">
          <Plus size={14} /> New List</button>
        {activeListId && (
          <>
            <button onClick={completeList} title="Complete list" className="no-print btn-ghost text-sm text-slate-400 hover:text-moss-600 flex items-center gap-1">
              <Check size={14} /> Done</button>
            <button onClick={() => window.print()} title="Print list" className="no-print btn-ghost text-sm text-slate-400 hover:text-moss-600 flex items-center gap-1">
              <Printer size={14} /> Print</button>
          </>
        )}
      </div>

      {showNewList && (
        <div className="card border-moss-200 bg-moss-50 flex gap-2">
          <input autoFocus className="input flex-1 text-sm" placeholder="List name (e.g. Weekly Shop)"
            value={newListName} onChange={e => setNewListName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createList()} />
          <button onClick={createList} className="btn-primary text-sm">Create</button>
          <button onClick={() => setShowNewList(false)} className="btn-ghost text-sm">Cancel</button>
        </div>
      )}

      {activeListId && (
        <>
          {/* Sticky add bar — search + pending confirm + manual toggle */}
          <div className="sticky top-0 z-10 bg-cream pt-1 pb-2 space-y-2">
            <div className="flex gap-2 items-center">
              <ProductSearch gid={gid} placeholder="Search products to add to list…" onSelect={p => { setPendingProduct(p); setPendingQty('') }} className="flex-1" />
              <button type="button" onClick={() => setScannerOpen(true)} title="Scan barcode"
                className="btn-ghost p-2 flex-shrink-0" aria-label="Scan barcode">
                <Camera size={18} />
              </button>
            </div>

            {pendingProduct && (
              <div className="card border-moss-200 bg-moss-50 flex items-center gap-3 py-2.5">
                <ProductThumb product={pendingProduct} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-ink truncate">{pendingProduct.name}</p>
                  {pendingProduct.brand && <p className="text-xs text-slate-400">{pendingProduct.brand}</p>}
                </div>
                <input className="input w-20 text-sm" placeholder="Qty"
                  value={pendingQty} onChange={e => setPendingQty(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addFromProduct(pendingProduct, pendingQty)}
                  autoFocus />
                <button onClick={() => addFromProduct(pendingProduct, pendingQty)} className="btn-primary text-sm px-3 py-2">Add</button>
                <button onClick={() => setPendingProduct(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={16} /></button>
              </div>
            )}

            <div className="flex items-center justify-between px-1">
              <button onClick={() => setAddingManual(v => !v)} className="text-xs text-slate-400 hover:text-moss-600 flex items-center gap-1 py-1">
                <Plus size={12} /> Add item manually</button>
              {checkedCount > 0 && (
                <button onClick={clearChecked} className="text-xs text-red-400 hover:text-red-600 py-1">
                  Clear {checkedCount} checked</button>
              )}
            </div>
          </div>

          {addingManual && (
            <form onSubmit={addManual} className="card border-slate-200 bg-slate-50 space-y-2">
              <input required className="input text-sm" placeholder="Item name *"
                value={manualForm.name} onChange={e => setManualForm(f => ({...f, name: e.target.value}))} />
              <div className="grid grid-cols-2 gap-2">
                <input className="input text-sm" placeholder="Quantity"
                  value={manualForm.quantity} onChange={e => setManualForm(f => ({...f, quantity: e.target.value}))} />
                <select className="input text-sm" value={manualForm.store_section}
                  onChange={e => setManualForm(f => ({...f, store_section: e.target.value}))}>
                  {SECTION_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={() => setAddingManual(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
                <button type="submit" className="btn-primary flex-1 text-sm">Add</button>
              </div>
            </form>
          )}

          {loadingItems ? <Spinner /> : items.length === 0 ? (
            <div className="card text-center py-8 text-slate-400 text-sm">
              List is empty — search for products above or add manually.
            </div>
          ) : (
            <div className="space-y-4">
              {sortedSections.map(section => (
                <div key={section}>
                  {/* Section header — background so it reads clearly as it scrolls */}
                  <div className="flex items-center gap-2 bg-cream py-1.5 mb-1 -mx-1 px-1 border-b border-slate-100">
                    <span>{SECTION_EMOJI[section] || '📦'}</span>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider capitalize">{section}</p>
                  </div>
                  <div className="space-y-1">
                    {grouped[section]
                      .slice()
                      .sort((a, b) => (a.is_checked ? 1 : 0) - (b.is_checked ? 1 : 0))
                      .map(item => (
                      <div
                        key={item.id}
                        onClick={() => toggleCheck(item)}
                        className={`card flex items-center gap-3 min-h-[56px] py-2.5 px-3 cursor-pointer active:bg-slate-50 transition-opacity select-none ${item.is_checked ? 'opacity-50' : ''}`}
                      >
                        {/* Checkbox visual */}
                        <div
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            item.is_checked ? 'bg-moss-500 border-moss-500' : 'border-slate-300'}`}
                          onClick={e => { e.stopPropagation(); toggleCheck(item) }}
                        >
                          {item.is_checked && <Check size={13} className="text-white" />}
                        </div>
                        <ProductThumb product={{ image_url: item.product_image_url, image_path: item.product_image_path, name: item.name }} size={36} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium text-ink leading-tight ${item.is_checked ? 'line-through text-slate-400' : ''}`}>{item.name}</p>
                          {item.product_brand && <p className="text-xs text-slate-400">{item.product_brand}</p>}
                        </div>
                        {(item.quantity || item.unit) && (
                          <span className="text-xs text-slate-400 flex-shrink-0">{[item.quantity, item.unit].filter(Boolean).join(' ')}</span>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); deleteItem(item) }}
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 -mr-1"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={async (scannedBarcode) => {
          try {
            const res = await api.get(`/products/barcode/${scannedBarcode.trim()}`)
            if (res.data) {
              setPendingProduct(res.data)
              setPendingQty('')
            } else {
              setManualForm(f => ({ ...f, name: scannedBarcode.trim() }))
              setAddingManual(true)
            }
          } catch {
            setManualForm(f => ({ ...f, name: scannedBarcode.trim() }))
            setAddingManual(true)
          }
        }}
      />
    </div>
  )
}

// ── Main Kuzine page ──────────────────────────────────────────────────────────
const TABS = ['Shopping', 'Inventory', 'Vacuum Seal', 'Bulk Buy']

export default function Kuzine() {
  const { user }  = useAuth()
  const fn        = firstName(user)
  const [tab, setTab]   = useState(0)
  const [inv, setInv]   = useState([])
  const [vsLog, setVsLog] = useState([])
  const [runs, setRuns] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingInv, setAddingInv] = useState(false)
  const [addingVs, setAddingVs]   = useState(false)
  const [selectedRun, setSelectedRun] = useState(null)

  const activeGroup = user?.groups?.[0]
  const gid         = activeGroup?.id

  const load = useCallback(async () => {
    if (!gid) { setLoading(false); return }
    setLoading(true)
    try {
      const [iRes, vRes, rRes, mRes] = await Promise.all([
        api.get(`/kuzine/${gid}/inventory`),
        api.get(`/kuzine/${gid}/vacuum-log`),
        api.get(`/kuzine/${gid}/bulk-buys`),
        api.get(`/groups/${gid}/members`),
      ])
      setInv(iRes.data)
      setVsLog(vRes.data)
      setRuns(rRes.data)
      setMembers(mRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [gid])

  useEffect(() => { load() }, [load])

  if (!activeGroup) return <NoGroup />

  const addInv = async form => {
    setAddingInv(true)
    try { await api.post(`/kuzine/${gid}/inventory`, form); await load() }
    finally { setAddingInv(false) }
  }
  const deleteInv = async id => {
    if (!confirm('Remove item?')) return
    await api.delete(`/kuzine/${gid}/inventory/${id}`)
    setInv(v => v.filter(i => i.id !== id))
  }
  const addVs = async form => {
    setAddingVs(true)
    try { await api.post(`/kuzine/${gid}/vacuum-log`, form); await load() }
    finally { setAddingVs(false) }
  }
  const deleteVs = async id => {
    if (!confirm('Remove log entry?')) return
    await api.delete(`/kuzine/${gid}/vacuum-log/${id}`)
    setVsLog(v => v.filter(i => i.id !== id))
  }
  const addRun = async form => {
    const res = await api.post(`/kuzine/${gid}/bulk-buys`, form)
    await load()
    return res.data
  }
  const deleteRun = async run => {
    if (!confirm(`Delete "${run.name}"?`)) return
    await api.delete(`/kuzine/${gid}/bulk-buys/${run.id}`)
    await load()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 md:space-y-6 overflow-x-hidden">
      <h1 className="text-xl md:text-2xl font-serif text-ink font-semibold">{fn}'s Cuisine</h1>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-fit overflow-x-auto">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => { setTab(i); setSelectedRun(null) }}
            className={`flex-1 sm:flex-none px-4 py-2.5 sm:py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 whitespace-nowrap ${
              tab === i ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab 0: Shopping */}
      {tab === 0 && <ShoppingListTab gid={gid} />}

      {loading && tab !== 0 ? <Spinner /> : (
        <>
          {/* Tab 1: Inventory */}
          {tab === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{inv.length} item{inv.length !== 1 ? 's' : ''}</p>
                <button onClick={() => setAddingInv(v => !v)} className="btn-primary flex items-center gap-1.5 text-sm">
                  <Plus size={15} /> Add Item</button>
              </div>
              {addingInv && <div className="card border-moss-200 bg-moss-50"><InvForm gid={gid} onAdd={async f => { await addInv(f); setAddingInv(false) }} loading={addingInv} /></div>}
              {inv.length === 0 ? (
                <div className="card text-center py-10 text-slate-400">
                  <Package size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No inventory yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {inv.map(item => (
                    <div key={item.id} className="card flex items-center gap-3 min-h-[64px] py-3">
                      {/* Meal photo (actual item) — falls back to product catalog thumb */}
                      {item.meal_photo_path
                        ? <img src={photoUrl(item.meal_photo_path)} alt={item.name || item.item_name}
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-slate-100"
                            onError={e => { e.currentTarget.style.display = 'none' }} />
                        : <ProductThumb product={{ image_url: item.product_image_url, name: item.name || item.item_name }} size={40} />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink text-sm">{item.name || item.item_name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded font-medium ${STORAGE_COLORS[item.storage_type] || 'bg-slate-100 text-slate-600'}`}>
                            {item.storage_type}</span>
                          {item.quantity && <span>qty: {item.quantity}</span>}
                          {item.category && <span className="capitalize">{item.category}</span>}
                          {item.use_by_date && <span className={new Date(item.use_by_date) < new Date() ? 'text-red-500 font-medium' : ''}>
                            use by {item.use_by_date}</span>}
                        </div>
                        {item.notes && <p className="text-xs text-slate-300 mt-0.5">{item.notes}</p>}
                      </div>
                      <MealPhotoButton
                        gid={gid} itemId={item.id} field="inventory_item_id"
                        existingPath={item.meal_photo_path}
                        onUploaded={photo => setInv(prev => prev.map(i => i.id === item.id ? { ...i, meal_photo_path: photo.image_path } : i))}
                      />
                      <button onClick={() => deleteInv(item.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Vacuum Seal */}
          {tab === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{vsLog.length} log entr{vsLog.length !== 1 ? 'ies' : 'y'}</p>
                <button onClick={() => setAddingVs(v => !v)} className="btn-primary flex items-center gap-1.5 text-sm">
                  <Plus size={15} /> Log Seal</button>
              </div>
              {addingVs && <div className="card border-moss-200 bg-moss-50"><VSForm gid={gid} onAdd={async f => { await addVs(f); setAddingVs(false) }} loading={addingVs} /></div>}
              {vsLog.length === 0 ? (
                <div className="card text-center py-10 text-slate-400">
                  <Layers size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No vacuum seal logs yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {vsLog.map(entry => (
                    <div key={entry.id} className="card flex items-center gap-3 min-h-[64px] py-3">
                      {entry.meal_photo_path
                        ? <img src={photoUrl(entry.meal_photo_path)} alt={entry.item_name}
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-slate-100"
                            onError={e => { e.currentTarget.style.display = 'none' }} />
                        : <ProductThumb product={{ image_url: entry.product_image_url, name: entry.item_name }} size={40} />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink text-sm">{entry.item_name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap mt-0.5">
                          {entry.quantity && <span>qty: {entry.quantity}</span>}
                          {entry.seal_date && <span>sealed {entry.seal_date}</span>}
                          {entry.use_by_date && <span className={new Date(entry.use_by_date) < new Date() ? 'text-red-500 font-medium' : ''}>
                            use by {entry.use_by_date}</span>}
                          {entry.storage_location && <span>📍 {entry.storage_location}</span>}
                        </div>
                        {entry.notes && <p className="text-xs text-slate-300 mt-0.5">{entry.notes}</p>}
                      </div>
                      <MealPhotoButton
                        gid={gid} itemId={entry.id} field="vacuum_seal_id"
                        existingPath={entry.meal_photo_path}
                        onUploaded={photo => setVsLog(prev => prev.map(e => e.id === entry.id ? { ...e, meal_photo_path: photo.image_path } : e))}
                      />
                      <button onClick={() => deleteVs(entry.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Bulk Buy */}
          {tab === 3 && (
            selectedRun
              ? <BulkRunDetail run={selectedRun} members={members} gid={gid}
                  onBack={() => setSelectedRun(null)} onRunUpdated={updated => setSelectedRun(updated)} />
              : <BulkRunList runs={runs} members={members} loading={false}
                  onSelect={setSelectedRun} onAdd={addRun} onDelete={deleteRun} />
          )}
        </>
      )}
    </div>
  )
}
