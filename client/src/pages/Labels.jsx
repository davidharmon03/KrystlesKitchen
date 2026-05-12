import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Tag, Printer, Plus, Trash2, Link } from 'lucide-react'
import QRCode from 'qrcode'

const BLANK_LABEL = {
  item_name: '',
  source: "Grown in Krystle's Garden",
  cook_temp: '',
  cook_time: '',
  date_sealed: new Date().toISOString().split('T')[0],
  contents: '',
  notes: '',
  link_url: '',
}

// Generate QR code data URL from a URL string
async function makeQR(url) {
  if (!url) return null
  try {
    return await QRCode.toDataURL(url, {
      width: 80,
      margin: 1,
      color: { dark: '#3d2b1f', light: '#fdf8f0' },
    })
  } catch { return null }
}

function LabelCard({ label, index, onDelete, qrDataUrl }) {
  return (
    <div className="print-label bg-parchment border-2 border-dashed border-terra-300 rounded-xl p-5 relative" style={{ fontFamily: "'Lora', Georgia, serif" }}>
      {onDelete && (
        <button onClick={() => onDelete(index)} className="absolute top-3 right-3 text-slate-300 hover:text-red-400 no-print">
          <Trash2 size={14} />
        </button>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4 pb-3 border-b border-terra-200">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-6 h-6 rounded-full bg-moss-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">K</span>
            </div>
            <span className="text-xs font-semibold text-moss-700 uppercase tracking-widest">Krystle's Cuisine</span>
          </div>
          <p className="text-xs text-terra-600 italic">Healthy · Organic · Community-Driven</p>
        </div>
        <div className="flex items-end gap-2">
          {qrDataUrl && (
            <img src={qrDataUrl} alt="QR" width={56} height={56} className="rounded" style={{ imageRendering: 'pixelated' }} />
          )}
          {label.date_sealed && (
            <div className="text-right">
              <p className="text-xs text-slate-500">Sealed</p>
              <p className="text-xs font-semibold text-ink">{label.date_sealed}</p>
            </div>
          )}
        </div>
      </div>

      {/* Item name */}
      <h2 className="text-xl font-bold text-ink mb-1 leading-tight">{label.item_name || 'Item Name'}</h2>

      {/* Contents */}
      {label.contents && (
        <p className="text-xs text-slate-600 mb-3 italic">{label.contents}</p>
      )}

      {/* Source */}
      {label.source && (
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-moss-500 text-sm">🌿</span>
          <p className="text-xs text-moss-700 font-medium">{label.source}</p>
        </div>
      )}

      {/* Cook instructions */}
      {(label.cook_temp || label.cook_time) && (
        <div className="bg-terra-50 border border-terra-200 rounded-lg p-3 mb-3">
          <p className="text-xs font-bold text-terra-800 uppercase tracking-wider mb-1.5">Cooking Instructions</p>
          <div className="flex gap-4">
            {label.cook_temp && (
              <div>
                <p className="text-xs text-slate-500">Temperature</p>
                <p className="text-sm font-semibold text-terra-700">{label.cook_temp}</p>
              </div>
            )}
            {label.cook_time && (
              <div>
                <p className="text-xs text-slate-500">Time</p>
                <p className="text-sm font-semibold text-terra-700">{label.cook_time}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {label.notes && (
        <p className="text-xs text-slate-500 italic border-t border-slate-200 pt-2 mt-2">{label.notes}</p>
      )}

      {/* Footer */}
      <p className="text-xs text-slate-300 mt-3 text-center tracking-widest">— Krystle's Brand Hub —</p>
    </div>
  )
}

export default function Labels() {
  const { user } = useAuth()
  const [labels, setLabels] = useState([{ ...BLANK_LABEL }])
  const [activeIdx, setActiveIdx] = useState(0)
  const [qrUrls, setQrUrls] = useState({})  // index → data URL
  const printRef = useRef()

  const activeLabel = labels[activeIdx] || BLANK_LABEL

  // Regenerate QR whenever a label's link_url changes
  useEffect(() => {
    labels.forEach((label, i) => {
      if (label.link_url) {
        makeQR(label.link_url).then(dataUrl => {
          setQrUrls(prev => ({ ...prev, [i]: dataUrl }))
        })
      } else {
        setQrUrls(prev => { const next = { ...prev }; delete next[i]; return next })
      }
    })
  }, [labels])

  const updateActive = updates => {
    setLabels(prev => prev.map((l, i) => i === activeIdx ? { ...l, ...updates } : l))
  }

  const addLabel = () => {
    setLabels(prev => [...prev, { ...BLANK_LABEL }])
    setActiveIdx(labels.length)
  }

  const deleteLabel = idx => {
    if (labels.length === 1) return
    const newLabels = labels.filter((_, i) => i !== idx)
    setLabels(newLabels)
    setActiveIdx(Math.min(activeIdx, newLabels.length - 1))
    // Reindex QR urls
    setQrUrls(prev => {
      const next = {}
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k)
        if (ki < idx) next[ki] = v
        else if (ki > idx) next[ki - 1] = v
      })
      return next
    })
  }

  const handlePrint = () => window.print()
  const set = field => e => updateActive({ [field]: e.target.value })

  return (
    <div className="max-w-5xl mx-auto">
      <div className="section-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-parchment border border-terra-200 flex items-center justify-center">
            <Tag size={20} className="text-terra-500" />
          </div>
          <div>
            <h1 className="page-title">Label Generator</h1>
            <p className="text-sm text-slate-500">Print parchment-ready instruction cards for vacuum-sealed bags</p>
          </div>
        </div>
        <button onClick={handlePrint} className="btn-terra flex items-center gap-2 no-print">
          <Printer size={16} /> Print Labels
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Editor ── */}
        <div className="no-print space-y-4">
          {/* Label selector */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-ink font-serif">Labels ({labels.length})</h3>
              <button onClick={addLabel} className="text-sm text-moss-600 hover:text-moss-700 font-medium flex items-center gap-1">
                <Plus size={14} /> Add label
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {labels.map((l, i) => (
                <button key={i} onClick={() => setActiveIdx(i)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors border ${activeIdx === i ? 'bg-moss-500 text-white border-moss-500' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {l.item_name || `Label ${i + 1}`}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-ink font-serif">Edit Label {activeIdx + 1}</h3>
            <div>
              <label className="label">Item name *</label>
              <input className="input" placeholder="e.g. Garlic Herb Ribeye" value={activeLabel.item_name} onChange={set('item_name')} />
            </div>
            <div>
              <label className="label">Contents / Description</label>
              <input className="input" placeholder="e.g. 2 ribeye steaks, seasoned with rosemary" value={activeLabel.contents} onChange={set('contents')} />
            </div>
            <div>
              <label className="label">Source</label>
              <input className="input" placeholder="e.g. Grown in Krystle's Garden" value={activeLabel.source} onChange={set('source')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Cook temperature</label>
                <input className="input" placeholder="e.g. 450°F" value={activeLabel.cook_temp} onChange={set('cook_temp')} />
              </div>
              <div>
                <label className="label">Cook time</label>
                <input className="input" placeholder="e.g. 3-4 min per side" value={activeLabel.cook_time} onChange={set('cook_time')} />
              </div>
            </div>
            <div>
              <label className="label">Date sealed</label>
              <input type="date" className="input" value={activeLabel.date_sealed} onChange={set('date_sealed')} />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <Link size={13} className="text-slate-400" /> Link URL (generates QR code)
              </label>
              <input className="input" type="url" placeholder="https://… (recipe, notes, etc.)"
                value={activeLabel.link_url} onChange={set('link_url')} />
              {qrUrls[activeIdx] && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={qrUrls[activeIdx]} alt="QR preview" width={48} height={48} className="rounded border border-slate-200" />
                  <p className="text-xs text-slate-400">QR will appear on the label</p>
                </div>
              )}
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={2} placeholder="Any additional notes…" value={activeLabel.notes} onChange={set('notes')} />
            </div>
          </div>

          {/* Tips */}
          <div className="card bg-parchment border-terra-200">
            <h4 className="font-semibold text-terra-800 text-sm font-serif mb-2">Print Tips</h4>
            <ul className="text-xs text-terra-700 space-y-1">
              <li>• Print on parchment paper for best food-safe results</li>
              <li>• Fold the label and seal inside the vacuum bag</li>
              <li>• Add a recipe URL to generate a QR code on the label</li>
              <li>• Use "Print to PDF" to save for digital sharing</li>
            </ul>
          </div>
        </div>

        {/* ── Preview ── */}
        <div>
          <h3 className="font-semibold text-ink mb-3 font-serif no-print">Preview</h3>
          <div ref={printRef} className="space-y-4">
            {labels.map((l, i) => (
              <LabelCard
                key={i}
                label={l}
                index={i}
                qrDataUrl={qrUrls[i] || null}
                onDelete={labels.length > 1 ? deleteLabel : null}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
