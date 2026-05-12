import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import PhotoUpload, { photoUrl } from '../components/PhotoUpload'
import {
  Camera, Loader, ChefHat, Package, Layers, X, Plus,
  Trash2, Pencil, Check
} from 'lucide-react'
import { firstName } from '../utils/userName'

const STAGE_LABELS = { plated: 'Plated', stored: 'Stored', prep: 'Prep' }
const STAGE_COLORS = {
  plated: 'bg-terra-100 text-terra-700',
  stored: 'bg-moss-100 text-moss-700',
  prep:   'bg-amber-100 text-amber-700',
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-moss-200 border-t-moss-600 rounded-full animate-spin" />
    </div>
  )
}

function UploadModal({ gid, userId, onClose, onUploaded }) {
  const [file,     setFile]     = useState(null)
  const [caption,  setCaption]  = useState('')
  const [stage,    setStage]    = useState('plated')
  const [uploading, setUploading] = useState(false)
  const [error,    setError]    = useState('')

  const submit = async e => {
    e.preventDefault()
    if (!file) { setError('Please select a photo.'); return }
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('photo',    file)
      fd.append('group_id', gid)
      fd.append('caption',  caption)
      fd.append('stage',    stage)
      const res = await api.post('/photos', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onUploaded(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed')
    } finally { setUploading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-serif font-semibold text-ink">Share an entrée photo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <PhotoUpload label="Photo *" onFile={setFile} />
          <div>
            <label className="label">Stage</label>
            <div className="flex gap-2">
              {Object.entries(STAGE_LABELS).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setStage(val)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    stage === val
                      ? 'bg-moss-500 text-white border-moss-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-moss-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Caption (optional)</label>
            <input className="input" placeholder="What's in the photo?" value={caption} onChange={e => setCaption(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={uploading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {uploading ? <Loader size={15} className="animate-spin" /> : <><Camera size={15} /> Share</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PhotoCard({ photo, userId, onDelete, onCaptionSave }) {
  const [editingCaption, setEditingCaption] = useState(false)
  const [caption,        setCaption]        = useState(photo.caption || '')
  const [saving,         setSaving]         = useState(false)

  const isOwner = photo.user_id === userId

  const saveCaption = async () => {
    setSaving(true)
    try {
      await onCaptionSave(photo.id, caption)
      setEditingCaption(false)
    } finally { setSaving(false) }
  }

  const mealName = photo.recipe_title || photo.inventory_item_name || photo.vacuum_seal_name || 'Entrée'
  const linkTo = photo.recipe_id
    ? '/kitchen'
    : photo.inventory_item_id || photo.vacuum_seal_id
      ? '/kuzine'
      : null

  return (
    <div className="card p-0 overflow-hidden group">
      {/* Photo */}
      <div className="relative aspect-square bg-slate-100">
        <img
          src={photoUrl(photo.image_path)}
          alt={mealName}
          className="w-full h-full object-cover"
          onError={e => {
            e.currentTarget.parentElement.innerHTML =
              '<div class="w-full h-full flex items-center justify-center"><svg class="text-slate-300 w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>'
          }}
        />
        {/* Stage badge */}
        <span className={`absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full ${STAGE_COLORS[photo.stage] || 'bg-slate-100 text-slate-600'}`}>
          {STAGE_LABELS[photo.stage] || photo.stage}
        </span>
        {/* Delete button (owner only) */}
        {isOwner && (
          <button onClick={() => onDelete(photo)}
            className="absolute top-2 right-2 p-1.5 bg-white bg-opacity-80 rounded-lg text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0 flex-1">
            {linkTo ? (
              <Link to={linkTo} className="font-medium text-sm text-ink hover:text-moss-700 truncate block">
                {mealName}
              </Link>
            ) : (
              <p className="font-medium text-sm text-ink truncate">{mealName}</p>
            )}
          </div>
          {/* Source icon */}
          <span className="flex-shrink-0 text-slate-300">
            {photo.recipe_id
              ? <ChefHat size={13} />
              : photo.vacuum_seal_id
                ? <Layers size={13} />
                : <Package size={13} />}
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-1.5">
          {photo.user_name} · {new Date(photo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>

        {/* Caption */}
        {editingCaption ? (
          <div className="flex items-center gap-1.5 mt-1">
            <input autoFocus className="input text-xs py-1 flex-1"
              value={caption} onChange={e => setCaption(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveCaption(); if (e.key === 'Escape') setEditingCaption(false) }} />
            <button onClick={saveCaption} disabled={saving}
              className="p-1 text-moss-600 hover:text-moss-800">
              {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
            </button>
            <button onClick={() => { setEditingCaption(false); setCaption(photo.caption || '') }}
              className="p-1 text-slate-400 hover:text-slate-600"><X size={13} /></button>
          </div>
        ) : (
          <div className="flex items-start gap-1 group/caption">
            {caption && <p className="text-xs text-slate-500 italic flex-1 leading-snug">"{caption}"</p>}
            {isOwner && (
              <button onClick={() => setEditingCaption(true)}
                className={`flex-shrink-0 text-slate-300 hover:text-moss-500 transition-colors ${caption ? 'opacity-0 group-hover/caption:opacity-100' : 'opacity-60'}`}>
                <Pencil size={11} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Gallery() {
  const { user }  = useAuth()
  const fn        = firstName(user)
  const activeGroup = user?.groups?.[0]
  const gid       = activeGroup?.id

  const [photos,      setPhotos]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filterStage, setFilterStage] = useState('')
  const [showUpload,  setShowUpload]  = useState(false)

  const load = useCallback(async () => {
    if (!gid) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await api.get('/photos', { params: { group_id: gid } })
      setPhotos(res.data)
    } catch {} finally { setLoading(false) }
  }, [gid])

  useEffect(() => { load() }, [load])

  const handleDelete = async photo => {
    if (!confirm('Delete this photo?')) return
    await api.delete(`/photos/${photo.id}`)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
  }

  const handleCaptionSave = async (id, caption) => {
    await api.patch(`/photos/${id}`, { caption })
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption } : p))
  }

  const handleUploaded = photo => setPhotos(prev => [photo, ...prev])

  const filtered = filterStage ? photos.filter(p => p.stage === filterStage) : photos

  if (!activeGroup) return (
    <div className="text-center py-16 text-slate-400">
      <p className="font-medium">Join or create a group to see the entrée feed.</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      <div className="section-header mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-terra-100 flex items-center justify-center">
            <Camera size={20} className="text-terra-600" />
          </div>
          <div>
            <h1 className="page-title">Entrée Gallery</h1>
            <p className="text-sm text-slate-500">{activeGroup.name} · recent photos from the group</p>
          </div>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Add Photo
        </button>
      </div>

      {/* Stage filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[['', 'All'], ['plated', 'Plated'], ['stored', 'Stored'], ['prep', 'Prep']].map(([val, label]) => (
          <button key={val} onClick={() => setFilterStage(val)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStage === val
                ? 'bg-moss-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-moss-50 hover:text-moss-700'
            }`}>
            {label}
            {val === '' && photos.length > 0 && <span className="ml-1.5 text-xs opacity-70">({photos.length})</span>}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Camera size={28} className="text-slate-300" />
          </div>
          <p className="font-medium text-slate-500 font-serif text-lg">No photos yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-5">
            {filterStage ? `No ${STAGE_LABELS[filterStage]?.toLowerCase()} photos yet.` : 'Be the first to share an entrée photo.'}
          </p>
          {!filterStage && (
            <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2 mx-auto">
              <Camera size={15} /> Share your first photo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(photo => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              userId={user?.id}
              onDelete={handleDelete}
              onCaptionSave={handleCaptionSave}
            />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          gid={gid}
          userId={user?.id}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  )
}
