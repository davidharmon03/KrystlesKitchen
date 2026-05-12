import { useState } from 'react'
import { X, Loader, Star } from 'lucide-react'
import api from '../api'

export default function RatingModal({ isOpen, entree, weekId, onClose, onSave }) {
  const [stars, setStars] = useState(0)
  const [hoverStars, setHoverStars] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !entree) return null

  const handleSubmit = async e => {
    e.preventDefault()
    if (stars === 0) {
      setError('Please select a rating')
      return
    }

    setLoading(true)
    setError('')
    try {
      await api.post(`/swaps/${weekId}/entrees/${entree.id}/rate`, {
        stars,
        comment: comment.trim()
      })
      onSave?.()
      handleClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit rating')
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStars(0)
    setHoverStars(0)
    setComment('')
    setError('')
    onClose()
  }

  const displayStars = hoverStars || stars

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-serif font-semibold text-ink">Rate This Entree</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">{entree.user_name}'s {entree.entree_name}</p>
            {entree.recipe_title && (
              <p className="text-xs text-slate-400">Recipe: {entree.recipe_title}</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Star Rating */}
          <div>
            <label className="label">Your Rating</label>
            <div className="flex gap-2 justify-center py-4">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHoverStars(n)}
                  onMouseLeave={() => setHoverStars(0)}
                  onClick={() => setStars(n)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={32}
                    className={`transition-colors ${
                      n <= displayStars
                        ? 'fill-terra-500 text-terra-500'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            {stars > 0 && (
              <p className="text-center text-sm text-slate-500 mt-1">
                {stars} {stars === 1 ? 'star' : 'stars'}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="label">Comment (optional)</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Loved the flavors! Perfect seasoning…"
              value={comment}
              onChange={e => setComment(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-slate-400 mt-1">
              {comment.length}/200
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={handleClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || stars === 0}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader size={14} className="animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Star size={14} /> Submit Rating
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
