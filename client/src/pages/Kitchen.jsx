import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { firstName } from '../utils/userName'
import { scaleIngredients } from '../utils/scaleIngredients'
import api from '../api'
import PhotoUpload, { photoUrl } from '../components/PhotoUpload'
import ImportRecipeModal from '../components/ImportRecipeModal'
import RatingDisplay from '../components/RatingDisplay'
import { ChefHat, Plus, Search, X, ChevronDown, ChevronUp, Trash2, Edit3, Camera, Loader, ShoppingCart, Check, Download, Printer } from 'lucide-react'

const TAGS = ['healthy', 'organic', 'freezer-friendly', 'vegan', 'protein', 'garden', 'batch prep', 'quick']
const SKILL_TAGS = ['flash freeze', 'vacuum seal', 'slow cook', 'batch prep', 'sous vide', 'ferment', 'dehydrate']

function RecipeModal({ recipe, onClose, onSave, onDelete, userId, groupId }) {
  const [editing, setEditing] = useState(!recipe?.id)
  const [form, setForm] = useState(recipe?.id ? {
    title: recipe.title, description: recipe.description,
    ingredients: recipe.ingredients.join('\n'),
    steps: recipe.steps.join('\n'),
    tags: [...recipe.tags], skill_tags: [...recipe.skill_tags],
    sides: recipe.sides || '',
    is_public: recipe.is_public
  } : {
    title: '', description: '', ingredients: '', steps: '',
    tags: [], skill_tags: [], sides: '', is_public: false
  })
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [expanded,      setExpanded]      = useState({ steps: true, ingredients: false })
  const [photos,        setPhotos]        = useState([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const [photoFile,     setPhotoFile]     = useState(null)
  const [photoStage,    setPhotoStage]    = useState('plated')
  const [photoCaption,  setPhotoCaption]  = useState('')
  const [showPhotoForm, setShowPhotoForm] = useState(false)
  const [showAddToList, setShowAddToList] = useState(false)
  const [scaledServings, setScaledServings] = useState(recipe?.servings || 4)

  const originalServings = recipe?.servings || null
  const scaledIngs = (recipe?.id && !editing && originalServings)
    ? scaleIngredients(recipe.ingredients, originalServings, scaledServings)
    : recipe?.ingredients

  const loadPhotos = useCallback(async () => {
    if (!recipe?.id || !groupId) return
    setPhotosLoading(true)
    try {
      const res = await api.get('/photos', { params: { group_id: groupId, recipe_id: recipe.id } })
      setPhotos(res.data)
    } catch {} finally { setPhotosLoading(false) }
  }, [recipe?.id, groupId])

  useEffect(() => { loadPhotos() }, [loadPhotos])

  const uploadPhoto = async () => {
    if (!photoFile || !recipe?.id || !groupId) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('photo',     photoFile)
      fd.append('group_id',  groupId)
      fd.append('recipe_id', recipe.id)
      fd.append('stage',     photoStage)
      fd.append('caption',   photoCaption)
      await api.post('/photos', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPhotoFile(null)
      setPhotoCaption('')
      setShowPhotoForm(false)
      await loadPhotos()
    } catch {} finally { setUploading(false) }
  }

  const deletePhoto = async photo => {
    if (!confirm('Delete this photo?')) return
    await api.delete(`/photos/${photo.id}`)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
  }

  const handleSave = async () => {
    setError('')
    if (!form.title || !form.ingredients || !form.steps) { setError('Title, ingredients, and steps are required.'); return }
    setLoading(true)
    try {
      const payload = {
        ...form,
        ingredients: form.ingredients.split('\n').map(s => s.trim()).filter(Boolean),
        steps: form.steps.split('\n').map(s => s.trim()).filter(Boolean),
        sides: form.sides.trim(),
      }
      await onSave(payload, recipe?.id)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save')
    } finally { setLoading(false) }
  }

  const toggleTag = (tag, field) => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(tag) ? f[field].filter(t => t !== tag) : [...f[field], tag]
    }))
  }

  const isOwner = !recipe?.id || recipe?.author_id === userId

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          {editing ? (
            <input className="text-xl font-serif font-semibold text-ink bg-transparent border-b-2 border-moss-300 focus:outline-none focus:border-moss-500 flex-1 mr-3" placeholder="Recipe title…" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          ) : (
            <h2 className="text-xl font-serif font-semibold text-ink flex-1">{recipe.title}</h2>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!editing && recipe?.id && (
              <button
                onClick={() => window.print()}
                title="Print recipe"
                className="no-print text-slate-400 hover:text-moss-600"
              >
                <Printer size={16} />
              </button>
            )}
            {isOwner && !editing && <button onClick={() => setEditing(true)} className="no-print text-slate-400 hover:text-moss-600"><Edit3 size={16} /></button>}
            {isOwner && recipe?.id && <button onClick={() => onDelete(recipe.id)} className="no-print text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>}
            <button onClick={onClose} className="no-print text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {error && <p className="text-red-600 text-sm">{error}</p>}

          {/* Hero photo (view mode only) */}
          {recipe?.id && !editing && photos.length > 0 && (
            <div className="relative -mx-5 -mt-5 mb-0">
              <img
                src={photoUrl(photos[0].image_path)}
                alt={recipe.title}
                className="w-full max-h-56 object-cover"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
          )}

          {/* Author / meta */}
          {recipe?.id && !editing && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">by <strong>{recipe.author_name}</strong></span>
              <span className="text-slate-300">·</span>
              {recipe.tags?.map(t => <span key={t} className="tag-moss">{t}</span>)}
              {recipe.skill_tags?.map(t => <span key={t} className="tag-terra">{t}</span>)}
            </div>
          )}

          {/* Description */}
          {editing ? (
            <div>
              <label className="label">Description</label>
              <textarea className="input resize-none" rows={2} placeholder="A short description…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          ) : recipe?.description ? (
            <p className="text-slate-600 text-sm italic border-l-2 border-moss-200 pl-3">{recipe.description}</p>
          ) : null}

          {/* Servings adjuster (view mode only) */}
          {recipe?.id && !editing && (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setScaledServings(s => Math.max(1, s - 1))}
                className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:border-moss-400 hover:text-moss-600 transition-colors text-sm font-semibold leading-none"
                aria-label="Decrease servings"
              >−</button>
              <span className="text-sm text-slate-700 font-medium min-w-[90px] text-center">
                {scaledServings} serving{scaledServings !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setScaledServings(s => Math.min(50, s + 1))}
                className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:border-moss-400 hover:text-moss-600 transition-colors text-sm font-semibold leading-none"
                aria-label="Increase servings"
              >+</button>
              {originalServings && scaledServings !== originalServings && (
                <span className="text-xs text-slate-400 italic">Scaled from {originalServings} serving{originalServings !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}

          {/* Ingredients */}
          <div>
            <button className="flex items-center gap-2 w-full text-left" onClick={() => setExpanded(e => ({ ...e, ingredients: !e.ingredients }))}>
              <h3 className="font-semibold text-ink text-sm">Ingredients</h3>
              {expanded.ingredients ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {expanded.ingredients && (editing ? (
              <textarea className="input resize-none mt-2" rows={6} placeholder="One ingredient per line" value={form.ingredients} onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))} />
            ) : (
              <ul className="mt-2 space-y-1">
                {scaledIngs?.map((ing, i) => <li key={i} className="flex items-start gap-2 text-sm text-slate-700"><span className="w-1.5 h-1.5 rounded-full bg-moss-400 mt-2 flex-shrink-0" />{ing}</li>)}
              </ul>
            ))}
          </div>

          {/* Steps */}
          <div>
            <button className="flex items-center gap-2 w-full text-left" onClick={() => setExpanded(e => ({ ...e, steps: !e.steps }))}>
              <h3 className="font-semibold text-ink text-sm">Steps</h3>
              {expanded.steps ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {expanded.steps && (editing ? (
              <textarea className="input resize-none mt-2" rows={6} placeholder="One step per line" value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} />
            ) : (
              <ol className="mt-2 space-y-2">
                {recipe.steps?.map((step, i) => <li key={i} className="flex items-start gap-3 text-sm text-slate-700"><span className="w-5 h-5 rounded-full bg-moss-100 text-moss-700 flex-shrink-0 flex items-center justify-center text-xs font-semibold mt-0.5">{i+1}</span>{step}</li>)}
              </ol>
            ))}
          </div>

          {/* Suggested Sides */}
          {editing ? (
            <div>
              <label className="label">Suggested Sides</label>
              <input
                className="input"
                placeholder="e.g. roasted vegetables, rice pilaf, garlic bread"
                value={form.sides}
                onChange={e => setForm(f => ({ ...f, sides: e.target.value }))}
              />
              <p className="text-xs text-slate-400 mt-1">Optional — side dishes that pair well with this entrée</p>
            </div>
          ) : recipe?.sides ? (
            <div className="border-t border-slate-100 pt-3">
              <h3 className="font-semibold text-ink text-sm mb-1.5">Suggested Sides</h3>
              <p className="text-sm text-slate-600">{recipe.sides}</p>
            </div>
          ) : null}

          {/* Tags (editing only) */}
          {editing && (
            <>
              <div>
                <label className="label">Recipe tags</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {TAGS.map(t => (
                    <button key={t} type="button" onClick={() => toggleTag(t, 'tags')}
                      className={`tag cursor-pointer transition-colors ${form.tags.includes(t) ? 'bg-moss-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-moss-100'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Skill tags</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {SKILL_TAGS.map(t => (
                    <button key={t} type="button" onClick={() => toggleTag(t, 'skill_tags')}
                      className={`tag cursor-pointer transition-colors ${form.skill_tags.includes(t) ? 'bg-terra-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-terra-100'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_public" checked={form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} className="rounded" />
                <label htmlFor="is_public" className="text-sm text-slate-600">Make recipe public</label>
              </div>
            </>
          )}

          {/* Photo gallery (view mode, existing recipes) */}
          {recipe?.id && !editing && (
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5">
                  <Camera size={14} className="text-slate-400" />
                  Photos {photos.length > 0 && <span className="text-slate-400 font-normal">({photos.length})</span>}
                </h3>
                <button onClick={() => setShowPhotoForm(v => !v)}
                  className="text-xs text-moss-600 hover:text-moss-800 font-medium flex items-center gap-1">
                  <Plus size={12} /> Add photo
                </button>
              </div>

              {showPhotoForm && (
                <div className="card border-moss-200 bg-moss-50 mb-3 space-y-3">
                  <PhotoUpload label={null} onFile={setPhotoFile} />
                  <div className="flex gap-1.5">
                    {[['plated', 'Plated'], ['stored', 'Stored'], ['prep', 'Prep']].map(([val, lbl]) => (
                      <button key={val} type="button" onClick={() => setPhotoStage(val)}
                        className={`flex-1 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          photoStage === val
                            ? 'bg-moss-500 text-white border-moss-500'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-moss-300'
                        }`}>{lbl}</button>
                    ))}
                  </div>
                  <input className="input text-sm" placeholder="Caption (optional)"
                    value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={() => setShowPhotoForm(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
                    <button onClick={uploadPhoto} disabled={uploading || !photoFile}
                      className="btn-primary flex-1 text-sm flex items-center justify-center gap-1">
                      {uploading ? <Loader size={13} className="animate-spin" /> : 'Upload'}
                    </button>
                  </div>
                </div>
              )}

              {photosLoading ? (
                <div className="flex justify-center py-4"><Loader size={16} className="animate-spin text-slate-400" /></div>
              ) : photos.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-3">No photos yet — add one above.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map(p => (
                    <div key={p.id} className="relative aspect-square group">
                      <img src={photoUrl(p.image_path)} alt={p.caption || recipe.title}
                        className="w-full h-full object-cover rounded-lg bg-slate-100"
                        onError={e => { e.currentTarget.style.display = 'none' }} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors" />
                      {p.stage && (
                        <span className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1.5 py-0.5 rounded font-medium">
                          {p.stage}
                        </span>
                      )}
                      {p.user_id === userId && (
                        <button onClick={() => deletePhoto(p)}
                          className="absolute top-1 right-1 p-1 bg-white/80 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add to Shopping List (view mode, existing recipe with ingredients) */}
          {recipe?.id && !editing && recipe.ingredients?.length > 0 && groupId && (
            <div className="border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowAddToList(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-moss-300 text-moss-700 hover:bg-moss-50 transition-colors text-sm font-medium"
              >
                <ShoppingCart size={15} />
                Add to Shopping List
              </button>
            </div>
          )}

          {editing && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button onClick={() => { if (recipe?.id) setEditing(false); else onClose() }} className="btn-ghost flex-1">Cancel</button>
              <button onClick={handleSave} disabled={loading} className="btn-primary flex-1">
                {loading ? 'Saving…' : 'Save Recipe'}
              </button>
            </div>
          )}
        </div>
      </div>

      {showAddToList && recipe?.id && (
        <AddToListModal
          recipe={recipe}
          groupId={groupId}
          onClose={() => setShowAddToList(false)}
          initialMultiplier={originalServings ? scaledServings / originalServings : 1}
        />
      )}
    </div>
  )
}

const MULTIPLIERS = [1, 2, 3, 5]

function AddToListModal({ recipe, groupId, onClose, initialMultiplier = 1 }) {
  const [lists,       setLists]       = useState([])
  const [listId,      setListId]      = useState('')
  const [newListName, setNewListName] = useState('')
  const [multiplier,  setMultiplier]  = useState(Math.round(initialMultiplier * 100) / 100)
  const [loading,     setLoading]     = useState(false)
  const [added,       setAdded]       = useState(null) // summary
  const [err,         setErr]         = useState('')

  useEffect(() => {
    api.get('/shopping-lists', { params: { group_id: groupId } })
      .then(r => {
        setLists(r.data)
        if (r.data.length > 0) setListId(r.data[0].id)
      })
      .catch(() => {})
  }, [groupId])

  const handleSubmit = async e => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      let targetListId = listId

      if (!targetListId) {
        // create new list
        const name = newListName.trim() || `${recipe.title} list`
        const res = await api.post('/shopping-lists', { group_id: groupId, name })
        targetListId = res.data.id
      }

      const res = await api.post(`/recipes/${recipe.id}/add-to-list`, {
        list_id:    targetListId,
        group_id:   groupId,
        multiplier
      })
      setAdded(res.data.added)
    } catch (err) {
      setErr(err.response?.data?.error || 'Failed to add items')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-serif font-semibold text-ink flex items-center gap-2">
            <ShoppingCart size={16} className="text-moss-600" /> Add to Shopping List
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {added ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-moss-700 font-semibold text-sm">
              <Check size={16} className="text-moss-600" />
              {added.length} ingredient{added.length !== 1 ? 's' : ''} added!
            </div>
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {added.map((item, i) => (
                <li key={i} className="flex items-center justify-between text-xs text-slate-600">
                  <span>{item.name}</span>
                  {item.matched && (
                    <span className="text-[10px] text-moss-500 bg-moss-50 px-1.5 py-0.5 rounded">
                      {item.store_section}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <button onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {err && <p className="text-red-500 text-xs">{err}</p>}

            <div>
              <label className="label">Shopping list</label>
              {lists.length > 0 ? (
                <select className="input" value={listId} onChange={e => setListId(e.target.value)}>
                  {lists.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                  <option value="">+ Create new list…</option>
                </select>
              ) : (
                <p className="text-xs text-slate-400 mb-2">No active lists — a new one will be created.</p>
              )}
            </div>

            {(!listId || lists.length === 0) && (
              <div>
                <label className="label">New list name</label>
                <input className="input" placeholder={`${recipe.title} list`}
                  value={newListName} onChange={e => setNewListName(e.target.value)} />
              </div>
            )}

            <div>
              <label className="label">Serving multiplier</label>
              <div className="flex gap-2">
                {MULTIPLIERS.map(m => (
                  <button key={m} type="button" onClick={() => setMultiplier(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      multiplier === m
                        ? 'bg-moss-500 text-white border-moss-500'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-moss-300'
                    }`}>
                    {m}×
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400">
              {recipe.ingredients?.length} ingredient{recipe.ingredients?.length !== 1 ? 's' : ''} from "{recipe.title}" will be added.
            </p>

            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                {loading ? <Loader size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                Add items
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function Kitchen() {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const activeGroup = user?.groups?.[0]

  const load = () => {
    setLoading(true)
    const q = activeGroup ? `?groupId=${activeGroup.id}` : ''
    api.get(`/recipes${q}`)
      .then(r => setRecipes(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [activeGroup?.id])

  const handleSave = async (payload, id) => {
    if (id) {
      await api.put(`/recipes/${id}`, { ...payload, group_id: activeGroup?.id })
    } else {
      await api.post('/recipes', { ...payload, group_id: activeGroup?.id })
    }
    load()
  }

  const handleDelete = async id => {
    if (!confirm('Delete this recipe?')) return
    await api.delete(`/recipes/${id}`)
    setSelectedRecipe(null)
    load()
  }

  const allTags = [...new Set(recipes.flatMap(r => r.tags || []))]

  const filtered = recipes.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase())
    const matchTag = !filterTag || r.tags?.includes(filterTag)
    return matchSearch && matchTag
  })

  return (
    <div className="max-w-4xl mx-auto overflow-x-hidden">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-terra-100 flex items-center justify-center flex-shrink-0">
            <ChefHat size={20} className="text-terra-600" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-serif text-ink font-semibold leading-tight">{firstName(user)}'s Kitchen</h1>
            <p className="text-xs md:text-sm text-slate-500">Entrées, skills & freezer-friendly cooking</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowImport(true)} className="btn-ghost flex items-center gap-1.5 text-sm">
            <Download size={14} /> Import
          </button>
          <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> New Recipe
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search recipes…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterTag('')} className={`tag cursor-pointer text-sm px-3 py-1.5 ${!filterTag ? 'bg-moss-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-moss-50'}`}>
            All
          </button>
          {allTags.map(t => (
            <button key={t} onClick={() => setFilterTag(t === filterTag ? '' : t)}
              className={`tag cursor-pointer text-sm px-3 py-1.5 ${filterTag === t ? 'bg-moss-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-moss-50'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-moss-200 border-t-moss-600 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ChefHat size={40} className="mx-auto mb-3 opacity-30" />
          <p>No entrées yet. Add your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <div key={r.id} onClick={() => setSelectedRecipe(r)}
              className="card p-0 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group">
              {r.primary_photo_path ? (
                <div className="aspect-video bg-slate-100 overflow-hidden">
                  <img src={photoUrl(r.primary_photo_path)} alt={r.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={e => { e.currentTarget.parentElement.style.display = 'none' }} />
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-moss-50 to-terra-50 flex items-center justify-center">
                  <ChefHat size={28} className="text-moss-200" />
                </div>
              )}
              <div className="p-3">
                <h3 className="font-serif font-semibold text-ink text-sm leading-snug group-hover:text-moss-700 transition-colors mb-1">{r.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 mb-2">{r.description}</p>
                <div className="flex flex-wrap gap-1">
                  {r.tags?.slice(0, 3).map(t => <span key={t} className="tag-moss">{t}</span>)}
                  {r.skill_tags?.slice(0, 2).map(t => <span key={t} className="tag-terra">{t}</span>)}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-400">by {r.author_name}</p>
                  <RatingDisplay recipeId={r.id} size="sm" showCount={false} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRecipe && (
        <RecipeModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          userId={user?.id}
          groupId={activeGroup?.id}
        />
      )}
      {showNew && (
        <RecipeModal
          recipe={null}
          onClose={() => setShowNew(false)}
          onSave={handleSave}
          onDelete={() => {}}
          userId={user?.id}
          groupId={activeGroup?.id}
        />
      )}
      {showImport && (
        <ImportRecipeModal
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          onSave={async payload => {
            await handleSave(payload)
          }}
        />
      )}
    </div>
  )
}
