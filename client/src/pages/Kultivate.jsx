import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { firstName } from '../utils/userName'
import api from '../api'
import {
  Leaf, Plus, Trash2, Calendar, Sprout, X, BookOpen,
  Sun, CloudSun, Cloud, Droplets, Ruler, ExternalLink,
  Search, ChevronDown, ChevronUp, Loader
} from 'lucide-react'

const STATUSES = ['growing', 'flowering', 'harvesting', 'harvested', 'dormant']
const STATUS_STYLES = {
  growing:    'bg-moss-100 text-moss-700',
  flowering:  'bg-yellow-100 text-yellow-700',
  harvesting: 'bg-terra-100 text-terra-600',
  harvested:  'bg-slate-100 text-slate-600',
  dormant:    'bg-blue-100 text-blue-700',
}
const STATUS_ICONS = {
  growing: '🌱', flowering: '🌸', harvesting: '🌿', harvested: '🧺', dormant: '💤'
}

const TYPE_STYLES = {
  herb:      { bg: 'bg-moss-100',   text: 'text-moss-700',   label: 'Herb'      },
  vegetable: { bg: 'bg-terra-100',  text: 'text-terra-600',  label: 'Vegetable' },
  fruit:     { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Fruit'     },
  flower:    { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Flower'    },
}

const SUNLIGHT_ICON = {
  full_sun:      <Sun size={13} className="text-amber-500" />,
  partial_shade: <CloudSun size={13} className="text-slate-500" />,
  full_shade:    <Cloud size={13} className="text-slate-400" />,
}
const SUNLIGHT_LABEL = {
  full_sun:      'Full sun',
  partial_shade: 'Part shade',
  full_shade:    'Full shade',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function NoGroup() {
  return (
    <div className="text-center py-16 text-slate-400">
      <Leaf size={40} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium">Join or create a group first</p>
    </div>
  )
}

// ── Harvest Modal ─────────────────────────────────────────────────────────────

function HarvestModal({ plant, groupId, onClose, onHarvest }) {
  const [form, setForm] = useState({
    plant_id: plant?.id || '',
    plant_name: plant?.plant_name || '',
    harvest_date: new Date().toISOString().split('T')[0],
    yield_amount: '',
    notes: '',
    add_to_inventory: true,
    inventory_category: 'produce',
    inventory_storage: 'fresh',
  })
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try { await onHarvest(form); onClose() }
    catch { } finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-serif font-semibold text-ink">Log Harvest</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Plant / Crop</label>
              <input required className="input" value={form.plant_name} onChange={e => setForm(f => ({ ...f, plant_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Harvest date</label>
              <input required type="date" className="input" value={form.harvest_date} onChange={e => setForm(f => ({ ...f, harvest_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Yield</label>
              <input required className="input" placeholder="e.g. 2 lbs, 6 heads" value={form.yield_amount} onChange={e => setForm(f => ({ ...f, yield_amount: e.target.value }))} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="add_inv" checked={form.add_to_inventory} onChange={e => setForm(f => ({ ...f, add_to_inventory: e.target.checked }))} className="rounded" />
            <label htmlFor="add_inv" className="text-sm text-slate-700 font-medium">Auto-add to Cuisine inventory</label>
          </div>
          {form.add_to_inventory && (
            <div className="grid grid-cols-2 gap-3 pl-5">
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.inventory_category} onChange={e => setForm(f => ({ ...f, inventory_category: e.target.value }))}>
                  {['produce', 'protein', 'staple', 'other'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Storage</label>
                <select className="input" value={form.inventory_storage} onChange={e => setForm(f => ({ ...f, inventory_storage: e.target.value }))}>
                  {['fresh', 'frozen', 'vacuum sealed', 'canned'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Logging…' : 'Log Harvest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Guide Detail Modal ────────────────────────────────────────────────────────

function GuideModal({ guideId, onClose }) {
  const [guide, setGuide] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/plant-guides/${guideId}`)
      .then(r => setGuide(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [guideId])

  const ts = guide ? (TYPE_STYLES[guide.type] || TYPE_STYLES.vegetable) : null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <BookOpen size={18} className="text-moss-500 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-serif font-semibold text-ink leading-tight">{guide?.common_name || '…'}</h2>
              {guide?.scientific_name && <p className="text-xs text-slate-400 italic">{guide.scientific_name}</p>}
            </div>
            {guide && ts && (
              <span className={`tag ${ts.bg} ${ts.text} ml-1`}>{ts.label}</span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader size={24} className="animate-spin text-moss-400" />
          </div>
        ) : !guide ? (
          <p className="p-8 text-center text-slate-400 text-sm">Guide not found.</p>
        ) : (
          <div className="p-5 overflow-y-auto space-y-5">
            {/* Description */}
            {guide.description && (
              <p className="text-sm text-slate-600 leading-relaxed italic border-l-2 border-moss-200 pl-3">
                {guide.description}
              </p>
            )}

            {/* Key stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Days to Harvest" value={guide.days_to_harvest ? `${guide.days_to_harvest} days` : '—'} />
              <StatCard label="Germination"     value={guide.days_to_germinate ? `${guide.days_to_germinate} days` : '—'} />
              <StatCard label="Space / Plant"   value={guide.space_needed_sqft ? `${guide.space_needed_sqft} sq ft` : '—'} />
              <StatCard label="USDA Zones"      value={guide.usda_zones || '—'} />
            </div>

            {/* When to Plant */}
            <GuideSection title="When to Plant" icon="🗓">
              <div className="flex flex-wrap gap-2 mb-2">
                {(guide.planting_seasons || []).map(s => (
                  <span key={s} className="tag bg-moss-100 text-moss-700 capitalize">{s}</span>
                ))}
                {(guide.planting_seasons || []).length === 0 && <span className="text-slate-400 text-sm">—</span>}
              </div>
              {guide.usda_zones && (
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-ink">Zones:</span> {guide.usda_zones}
                </p>
              )}
            </GuideSection>

            {/* Space Requirements */}
            <GuideSection title="Space Requirements" icon="📐">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-0.5">Per plant</p>
                  <p className="font-semibold text-ink">{guide.space_needed_sqft ? `${guide.space_needed_sqft} sq ft` : '—'}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-0.5">Between plants</p>
                  <p className="font-semibold text-ink">{guide.spacing_between_plants_inches ? `${guide.spacing_between_plants_inches}"` : '—'}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-0.5">Row spacing</p>
                  <p className="font-semibold text-ink">{guide.row_spacing_inches ? `${guide.row_spacing_inches}"` : '—'}</p>
                </div>
              </div>
            </GuideSection>

            {/* Care */}
            <GuideSection title="Care" icon="🌿">
              <div className="space-y-2 text-sm">
                {guide.sunlight && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-20 flex-shrink-0">Sunlight</span>
                    <span className="flex items-center gap-1.5 text-ink font-medium">
                      {SUNLIGHT_ICON[guide.sunlight]}
                      {SUNLIGHT_LABEL[guide.sunlight] || guide.sunlight}
                    </span>
                  </div>
                )}
                {guide.water_frequency && (
                  <div className="flex items-start gap-2">
                    <span className="text-slate-500 w-20 flex-shrink-0">Water</span>
                    <span className="text-ink">{guide.water_frequency}</span>
                  </div>
                )}
                {guide.soil_type && (
                  <div className="flex items-start gap-2">
                    <span className="text-slate-500 w-20 flex-shrink-0">Soil</span>
                    <span className="text-ink">{guide.soil_type}</span>
                  </div>
                )}
              </div>
            </GuideSection>

            {/* Companion Plants */}
            {(guide.companion_plants || []).length > 0 && (
              <GuideSection title="Companion Plants" icon="🤝">
                <div className="flex flex-wrap gap-1.5">
                  {guide.companion_plants.map(p => (
                    <span key={p} className="tag bg-moss-50 text-moss-700 border border-moss-200">{p}</span>
                  ))}
                </div>
              </GuideSection>
            )}

            {/* Avoid Planting With */}
            {(guide.avoid_planting_with || []).length > 0 && (
              <GuideSection title="Avoid Planting With" icon="⚠️">
                <div className="flex flex-wrap gap-1.5">
                  {guide.avoid_planting_with.map(p => (
                    <span key={p} className="tag bg-red-50 text-red-600 border border-red-200">{p}</span>
                  ))}
                </div>
              </GuideSection>
            )}

            {/* Tips */}
            {guide.tips && (
              <GuideSection title="Growing Tips" icon="💡">
                <p className="text-sm text-slate-600 leading-relaxed">{guide.tips}</p>
              </GuideSection>
            )}

            {/* Learn More */}
            {(guide.resource_links || []).length > 0 && (
              <GuideSection title="Learn More" icon="📚">
                <div className="space-y-2">
                  {guide.resource_links.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 group px-3 py-2 rounded-lg border border-slate-200 hover:border-moss-300 hover:bg-moss-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-moss-700 group-hover:text-moss-800 leading-snug">{link.label}</p>
                        <p className="text-xs text-slate-400">{new URL(link.url).hostname.replace('www.', '')}</p>
                      </div>
                      <ExternalLink size={13} className="text-slate-300 group-hover:text-moss-500 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </GuideSection>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}

function GuideSection({ title, icon, children }) {
  return (
    <div className="border-t border-slate-100 pt-4">
      <h3 className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  )
}

// ── Guide Card (library grid) ─────────────────────────────────────────────────

function GuideCard({ guide, onClick }) {
  const ts = TYPE_STYLES[guide.type] || TYPE_STYLES.vegetable
  return (
    <button
      onClick={() => onClick(guide.id)}
      className="card p-0 overflow-hidden text-left hover:shadow-md transition-shadow group cursor-pointer"
    >
      {/* Color bar */}
      <div className={`h-1.5 w-full ${guide.type === 'herb' ? 'bg-moss-400' : guide.type === 'fruit' ? 'bg-amber-400' : guide.type === 'flower' ? 'bg-purple-400' : 'bg-terra-400'}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-serif font-semibold text-ink text-sm leading-snug group-hover:text-moss-700 transition-colors">
            {guide.common_name}
          </h3>
          <span className={`tag flex-shrink-0 ${ts.bg} ${ts.text} text-[10px]`}>{ts.label}</span>
        </div>
        {guide.scientific_name && (
          <p className="text-xs text-slate-400 italic mb-3 truncate">{guide.scientific_name}</p>
        )}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            {SUNLIGHT_ICON[guide.sunlight]}
            <span>{SUNLIGHT_LABEL[guide.sunlight] || guide.sunlight || '—'}</span>
          </div>
          {guide.days_to_harvest && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-slate-300">🌾</span>
              <span>Harvest in {guide.days_to_harvest} days</span>
            </div>
          )}
          {guide.space_needed_sqft && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Ruler size={11} className="text-slate-300" />
              <span>{guide.space_needed_sqft} sq ft / plant</span>
            </div>
          )}
        </div>
        <p className="text-xs text-moss-600 mt-3 flex items-center gap-1 font-medium">
          <BookOpen size={11} /> View guide
        </p>
      </div>
    </button>
  )
}

// ── Plant Name Typeahead ──────────────────────────────────────────────────────

function PlantNameTypeahead({ value, onChange, onSelectGuide }) {
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const wrapRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!value || value.length < 2) { setResults([]); setOpen(false); return }
    setSearching(true)
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/plant-guides/search', { params: { q: value } })
        setResults(res.data)
        setOpen(res.data.length > 0)
      } catch {} finally { setSearching(false) }
    }, 280)
    return () => clearTimeout(timerRef.current)
  }, [value])

  // close on outside click
  useEffect(() => {
    if (!open) return
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const select = guide => {
    onChange(guide.common_name)
    onSelectGuide(guide.id)
    setOpen(false)
    setResults([])
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <input
          required
          className="input pr-8"
          placeholder="e.g. Heirloom Tomatoes"
          value={value}
          onChange={e => { onChange(e.target.value); onSelectGuide(null) }}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {searching && (
          <Loader size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 animate-spin" />
        )}
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-slate-100">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Match from growing guides</p>
          </div>
          {results.map(g => {
            const ts = TYPE_STYLES[g.type] || TYPE_STYLES.vegetable
            return (
              <button
                key={g.id}
                type="button"
                onMouseDown={() => select(g)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-moss-50 text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{g.common_name}</p>
                  {g.scientific_name && <p className="text-xs text-slate-400 italic truncate">{g.scientific_name}</p>}
                </div>
                <span className={`tag flex-shrink-0 ${ts.bg} ${ts.text} text-[10px]`}>{ts.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Kultivate() {
  const { user } = useAuth()
  const activeGroup = user?.groups?.[0]
  const gid = activeGroup?.id

  // Garden state
  const [tab, setTab] = useState('garden')
  const [plants, setPlants] = useState([])
  const [harvests, setHarvests] = useState([])
  const [calendar, setCalendar] = useState({})
  const [loading, setLoading] = useState(false)
  const [harvestTarget, setHarvestTarget] = useState(null)
  const [showAddPlant, setShowAddPlant] = useState(false)
  const [plantForm, setPlantForm] = useState({
    plant_name: '', date_planted: '', expected_harvest: '',
    status: 'growing', notes: '', plant_guide_id: null
  })

  // Guide library state
  const [guides, setGuides] = useState([])
  const [guidesLoaded, setGuidesLoaded] = useState(false)
  const [guidesLoading, setGuidesLoading] = useState(false)
  const [guideSearch, setGuideSearch] = useState('')
  const [guideTypeFilter, setGuideTypeFilter] = useState('all')
  const [openGuideId, setOpenGuideId] = useState(null)

  const loadAll = () => {
    if (!gid) return
    setLoading(true)
    Promise.all([
      api.get(`/kultivate/${gid}/plants`),
      api.get(`/kultivate/${gid}/harvests`),
      api.get(`/kultivate/${gid}/calendar`),
    ]).then(([p, h, c]) => {
      setPlants(p.data)
      setHarvests(h.data)
      setCalendar(c.data)
    }).catch(() => {})
      .finally(() => setLoading(false))
  }

  const loadGuides = useCallback(async () => {
    if (guidesLoaded) return
    setGuidesLoading(true)
    try {
      const res = await api.get('/plant-guides')
      setGuides(res.data)
      setGuidesLoaded(true)
    } catch {} finally { setGuidesLoading(false) }
  }, [guidesLoaded])

  useEffect(loadAll, [gid])

  useEffect(() => {
    if (tab === 'guides') loadGuides()
  }, [tab, loadGuides])

  const addPlant = async e => {
    e.preventDefault()
    await api.post(`/kultivate/${gid}/plants`, plantForm)
    setPlantForm({ plant_name: '', date_planted: '', expected_harvest: '', status: 'growing', notes: '', plant_guide_id: null })
    setShowAddPlant(false)
    loadAll()
  }

  const updatePlant = async (id, updates) => {
    await api.put(`/kultivate/${gid}/plants/${id}`, updates)
    loadAll()
  }

  const deletePlant = async id => {
    if (!confirm('Remove this plant?')) return
    await api.delete(`/kultivate/${gid}/plants/${id}`)
    loadAll()
  }

  const logHarvest = async form => {
    await api.post(`/kultivate/${gid}/harvests`, form)
    loadAll()
  }

  if (!activeGroup) return <NoGroup />

  const tabs = [
    { id: 'garden',   label: 'Garden'         },
    { id: 'harvests', label: 'Harvest Log'     },
    { id: 'calendar', label: 'Calendar'        },
    { id: 'guides',   label: '📖 Growing Guides' },
  ]

  // Filtered guides for library
  const filteredGuides = guides.filter(g => {
    const matchType = guideTypeFilter === 'all' || g.type === guideTypeFilter
    const matchSearch = !guideSearch || g.common_name.toLowerCase().includes(guideSearch.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div className="max-w-4xl mx-auto">
      <div className="section-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-moss-100 flex items-center justify-center">
            <Leaf size={20} className="text-moss-500" />
          </div>
          <div>
            <h1 className="page-title">{firstName(user)}'s Garden</h1>
            <p className="text-sm text-slate-500">Plants & Harvests — {activeGroup.name}</p>
          </div>
        </div>
        {tab !== 'guides' && (
          <button onClick={() => setShowAddPlant(v => !v)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Plant
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t.id ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Add plant form */}
      {showAddPlant && tab !== 'guides' && (
        <div className="card mb-5 border-moss-200">
          <h3 className="font-semibold text-ink mb-4 font-serif">Add Plant</h3>
          <form onSubmit={addPlant} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">
                  Plant name
                  <span className="ml-1 text-[10px] text-moss-500 font-normal normal-case">— type to search guides</span>
                </label>
                <PlantNameTypeahead
                  value={plantForm.plant_name}
                  onChange={v => setPlantForm(f => ({ ...f, plant_name: v }))}
                  onSelectGuide={id => setPlantForm(f => ({ ...f, plant_guide_id: id }))}
                />
                {plantForm.plant_guide_id && (
                  <p className="text-[10px] text-moss-600 mt-1 flex items-center gap-1">
                    <BookOpen size={10} /> Guide linked
                  </p>
                )}
              </div>
              <div>
                <label className="label">Date planted</label>
                <input required type="date" className="input" value={plantForm.date_planted}
                  onChange={e => setPlantForm(f => ({ ...f, date_planted: e.target.value }))} />
              </div>
              <div>
                <label className="label">Expected harvest</label>
                <input type="date" className="input" value={plantForm.expected_harvest}
                  onChange={e => setPlantForm(f => ({ ...f, expected_harvest: e.target.value }))} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={plantForm.status}
                  onChange={e => setPlantForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" placeholder="Variety, location, care notes…" value={plantForm.notes}
                onChange={e => setPlantForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAddPlant(false)} className="btn-ghost flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1">Add Plant</button>
            </div>
          </form>
        </div>
      )}

      {loading && tab !== 'guides' && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-moss-200 border-t-moss-600 rounded-full animate-spin" />
        </div>
      )}

      {/* ── Garden ── */}
      {!loading && tab === 'garden' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {plants.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-slate-400">
              <Sprout size={36} className="mx-auto mb-3 opacity-30" />
              <p>Nothing planted yet. Add your first plant!</p>
            </div>
          ) : plants.map(p => (
            <div key={p.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h4 className="font-serif font-semibold text-ink">{p.plant_name}</h4>
                  <span className={`tag mt-1 ${STATUS_STYLES[p.status] || 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_ICONS[p.status]} {p.status}
                  </span>
                </div>
                <div className="flex gap-1">
                  {p.plant_guide_id && (
                    <button
                      onClick={() => setOpenGuideId(p.plant_guide_id)}
                      title="View growing guide"
                      className="text-moss-400 hover:text-moss-600 p-1 rounded hover:bg-moss-50 transition-colors"
                    >
                      <BookOpen size={14} />
                    </button>
                  )}
                  {p.status !== 'harvested' && (
                    <button onClick={() => setHarvestTarget(p)} title="Log harvest"
                      className="text-moss-400 hover:text-moss-600 p-1 rounded hover:bg-moss-50 transition-colors">
                      🧺
                    </button>
                  )}
                  <button onClick={() => deletePlant(p.id)}
                    className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-0.5 text-xs text-slate-500">
                <p>Planted: {p.date_planted}</p>
                {p.expected_harvest && <p>Harvest: {p.expected_harvest}</p>}
                {p.guide_name && (
                  <p className="text-moss-500 flex items-center gap-1">
                    <BookOpen size={10} /> {p.guide_name}
                  </p>
                )}
                {p.notes && <p className="text-slate-400 italic mt-1">{p.notes}</p>}
                <p className="text-slate-400">by {p.added_by_name}</p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <select
                  className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-600 bg-transparent focus:outline-none focus:border-moss-400 w-full"
                  value={p.status}
                  onChange={e => updatePlant(p.id, { status: e.target.value })}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Harvest Log ── */}
      {!loading && tab === 'harvests' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-slate-500">{harvests.length} harvest{harvests.length !== 1 ? 's' : ''} logged</p>
            <button onClick={() => setHarvestTarget({ id: null, plant_name: '' })} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Log Harvest
            </button>
          </div>
          {harvests.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No harvests logged yet</div>
          ) : harvests.map(h => (
            <div key={h.id} className="card border-l-4 border-moss-300 flex items-start gap-3">
              <div className="text-xl flex-shrink-0">🧺</div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-medium text-ink text-sm">{h.plant_name}</h4>
                    <p className="text-xs text-slate-500">{h.harvest_date} · Yield: <strong>{h.yield_amount}</strong></p>
                  </div>
                  {h.added_to_inventory ? <span className="tag tag-moss text-xs">In Cuisine ✓</span> : null}
                </div>
                {h.notes && <p className="text-xs text-slate-400 italic mt-1">{h.notes}</p>}
                <p className="text-xs text-slate-400">by {h.added_by_name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Calendar ── */}
      {!loading && tab === 'calendar' && (
        <div className="space-y-5">
          {Object.keys(calendar).length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              No harvest dates set. Add expected harvest dates to your plants.
            </div>
          ) : Object.entries(calendar).map(([month, monthPlants]) => (
            <div key={month}>
              <div className="flex items-center gap-3 mb-2">
                <Calendar size={16} className="text-moss-500" />
                <h3 className="font-serif font-semibold text-ink">{month}</h3>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="space-y-2 pl-4">
                {monthPlants.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`tag ${STATUS_STYLES[p.status] || 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_ICONS[p.status]} {p.status}
                    </span>
                    <span className="text-sm font-medium text-ink">{p.plant_name}</span>
                    <span className="text-xs text-slate-400">{p.expected_harvest}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Growing Guides ── */}
      {tab === 'guides' && (
        <div>
          {/* Search + filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search plants…"
                value={guideSearch}
                onChange={e => setGuideSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { id: 'all',       label: 'All'        },
                { id: 'vegetable', label: 'Vegetables' },
                { id: 'herb',      label: 'Herbs'      },
                { id: 'fruit',     label: 'Fruits'     },
                { id: 'flower',    label: 'Flowers'    },
              ].map(f => (
                <button key={f.id} onClick={() => setGuideTypeFilter(f.id)}
                  className={`tag cursor-pointer text-sm px-3 py-1.5 transition-colors ${
                    guideTypeFilter === f.id
                      ? 'bg-moss-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-moss-50'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {guidesLoading ? (
            <div className="flex justify-center py-16">
              <Loader size={24} className="animate-spin text-moss-400" />
            </div>
          ) : filteredGuides.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
              <p>{guideSearch ? `No plants matching "${guideSearch}"` : 'No guides in this category'}</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-3">{filteredGuides.length} plant{filteredGuides.length !== 1 ? 's' : ''}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGuides.map(g => (
                  <GuideCard key={g.id} guide={g} onClick={setOpenGuideId} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Harvest modal */}
      {harvestTarget && (
        <HarvestModal
          plant={harvestTarget}
          groupId={gid}
          onClose={() => setHarvestTarget(null)}
          onHarvest={logHarvest}
        />
      )}

      {/* Guide detail modal */}
      {openGuideId && (
        <GuideModal
          guideId={openGuideId}
          onClose={() => setOpenGuideId(null)}
        />
      )}
    </div>
  )
}
