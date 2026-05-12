import { useState } from 'react'
import { X, Loader, AlertCircle, Plus, Link, Image } from 'lucide-react'
import api from '../api'

const TAGS = ['healthy', 'organic', 'freezer-friendly', 'vegan', 'protein', 'garden', 'batch prep', 'quick']
const SKILL_TAGS = ['flash freeze', 'vacuum seal', 'slow cook', 'batch prep', 'sous vide', 'ferment', 'dehydrate']

export default function ImportRecipeModal({ isOpen, onClose, onSave }) {
  const [step,    setStep]    = useState('input') // 'input' | 'preview'
  const [url,     setUrl]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [partial, setPartial] = useState(false)
  const [form,    setForm]    = useState(null)

  const handleImport = async e => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/recipes/import-url', { url: url.trim() })
      const data = res.data
      setPartial(!!data._partial)
      setForm({
        title:       data.title       || '',
        description: data.description || '',
        ingredients: (data.ingredients || []).join('\n'),
        steps:       (data.steps      || []).join('\n'),
        tags:        data.tags        || [],
        skill_tags:  data.skill_tags  || [],
        sides:       data.sides       || '',
        is_public:   data.is_public   || false,
        servings:    data.servings    || '1',
        imageUrl:    data.imageUrl    || '',
        prepTime:    data.prepTime    != null ? String(data.prepTime) : '',
        cookTime:    data.cookTime    != null ? String(data.cookTime) : '',
        source_url:  data.source_url  || url.trim(),
      })
      setStep('preview')
    } catch (err) {
      setError(err.response?.data?.error || "We couldn't read that page. Try copying the recipe manually.")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    try {
      // Append source credit to description / notes
      const sourceNote = form.source_url
        ? `\n\nImported from: ${form.source_url}`
        : ''
      const payload = {
        title:       form.title,
        description: (form.description + sourceNote).trim(),
        ingredients: form.ingredients.split('\n').map(s => s.trim()).filter(Boolean),
        steps:       form.steps.split('\n').map(s => s.trim()).filter(Boolean),
        tags:        form.tags,
        skill_tags:  form.skill_tags,
        sides:       form.sides.trim(),
        is_public:   form.is_public,
      }
      await onSave(payload)
      handleClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save recipe')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep('input')
    setUrl('')
    setForm(null)
    setError('')
    setPartial(false)
    onClose()
  }

  const toggleTag = (tag, field) => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(tag)
        ? f[field].filter(t => t !== tag)
        : [...f[field], tag],
    }))
  }

  const sourceDomain = (() => {
    try { return new URL(form?.source_url || url).hostname.replace(/^www\./, '') }
    catch { return null }
  })()

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-xl font-serif font-semibold text-ink flex items-center gap-2">
            <Link size={17} className="text-moss-500" />
            {step === 'input' ? 'Import Recipe from URL' : 'Review Imported Recipe'}
          </h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: '70vh' }}>

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* ── Step 1: URL input ─────────────────────────────────── */}
          {step === 'input' && (
            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label className="label">Recipe URL</label>
                <input
                  type="url"
                  placeholder="https://www.allrecipes.com/recipe/..."
                  value={url}
                  onChange={e => { setUrl(e.target.value); setError('') }}
                  className="input"
                  required
                  autoFocus
                />
              </div>
              <p className="text-xs text-slate-500">
                Paste a link from AllRecipes, NYT Cooking, Serious Eats, Food Network, or any site with recipe data.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={handleClose} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader size={14} className="animate-spin" /> Importing…</> : 'Import'}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2: Preview & edit ────────────────────────────── */}
          {step === 'preview' && form && (
            <div className="space-y-4">

              {/* Partial data warning */}
              {partial && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    We grabbed the title and image but couldn't find full recipe data on that page.
                    Fill in the ingredients and steps below before saving.
                  </p>
                </div>
              )}

              {/* Image preview */}
              {form.imageUrl && (
                <div className="-mx-5 -mt-5 mb-0">
                  <img
                    src={form.imageUrl}
                    alt={form.title}
                    className="w-full max-h-48 object-cover"
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
              )}

              {/* Title */}
              <div>
                <label className="label">Title</label>
                <input
                  type="text"
                  className="input"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="A short description…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Servings / times row */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label">Servings</label>
                  <input
                    type="text"
                    className="input"
                    value={form.servings}
                    onChange={e => setForm(f => ({ ...f, servings: e.target.value }))}
                    placeholder="4"
                  />
                </div>
                <div>
                  <label className="label">Prep (min)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.prepTime}
                    onChange={e => setForm(f => ({ ...f, prepTime: e.target.value }))}
                    placeholder="—"
                    min={0}
                  />
                </div>
                <div>
                  <label className="label">Cook (min)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.cookTime}
                    onChange={e => setForm(f => ({ ...f, cookTime: e.target.value }))}
                    placeholder="—"
                    min={0}
                  />
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <label className="label">Ingredients</label>
                <textarea
                  className="input resize-none"
                  rows={6}
                  value={form.ingredients}
                  onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))}
                  placeholder="One ingredient per line"
                />
                <p className="text-xs text-slate-400 mt-1">One per line</p>
              </div>

              {/* Steps */}
              <div>
                <label className="label">Steps</label>
                <textarea
                  className="input resize-none"
                  rows={6}
                  value={form.steps}
                  onChange={e => setForm(f => ({ ...f, steps: e.target.value }))}
                  placeholder="One step per line"
                />
                <p className="text-xs text-slate-400 mt-1">One per line</p>
              </div>

              {/* Suggested Sides */}
              <div>
                <label className="label">Suggested Sides</label>
                <input
                  type="text"
                  className="input"
                  value={form.sides}
                  onChange={e => setForm(f => ({ ...f, sides: e.target.value }))}
                  placeholder="e.g. roasted vegetables, rice pilaf, garlic bread"
                />
                <p className="text-xs text-slate-400 mt-1">Optional — side dishes that pair well with this entrée</p>
              </div>

              {/* Image URL */}
              <div>
                <label className="label flex items-center gap-1.5">
                  <Image size={12} /> Image URL
                </label>
                <input
                  type="url"
                  className="input"
                  value={form.imageUrl}
                  onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://..."
                />
                {form.imageUrl && (
                  <img
                    src={form.imageUrl}
                    alt="preview"
                    className="mt-2 h-16 w-24 object-cover rounded-lg border border-slate-200"
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                )}
              </div>

              {/* Recipe tags */}
              <div>
                <label className="label">Recipe tags</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {TAGS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t, 'tags')}
                      className={`tag cursor-pointer transition-colors ${
                        form.tags.includes(t)
                          ? 'bg-moss-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-moss-100'
                      }`}
                    >{t}</button>
                  ))}
                </div>
              </div>

              {/* Skill tags */}
              <div>
                <label className="label">Skill tags</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {SKILL_TAGS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t, 'skill_tags')}
                      className={`tag cursor-pointer transition-colors ${
                        form.skill_tags.includes(t)
                          ? 'bg-terra-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-terra-100'
                      }`}
                    >{t}</button>
                  ))}
                </div>
              </div>

              {/* Public toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="import_is_public"
                  checked={form.is_public}
                  onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="import_is_public" className="text-sm text-slate-600">
                  Make recipe public
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setStep('input'); setError('') }}
                  className="btn-ghost flex-1"
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading || !form.title || !form.ingredients || !form.steps}
                  className="btn-primary flex-1 flex items-center justify-center gap-1.5"
                >
                  {loading
                    ? <><Loader size={14} className="animate-spin" /> Saving…</>
                    : <><Plus size={14} /> Save Recipe</>
                  }
                </button>
              </div>

              {/* Attribution */}
              {sourceDomain && (
                <p className="text-xs text-slate-400 text-center pt-1">
                  Imported from{' '}
                  <a
                    href={form.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-slate-600"
                  >
                    {sourceDomain}
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
