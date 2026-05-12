import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import api from '../api'

export default function RatingDisplay({ recipeId, showCount = true, size = 'sm' }) {
  const [rating, setRating] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRating = async () => {
      try {
        const res = await api.get(`/swaps/ratings/${recipeId}`)
        setRating(res.data)
      } catch (err) {
        console.error('Failed to load ratings:', err)
      } finally {
        setLoading(false)
      }
    }

    loadRating()
  }, [recipeId])

  if (loading) return null
  if (!rating || rating.rating_count === 0) return null

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const starSize = {
    sm: 12,
    md: 14,
    lg: 16
  }

  return (
    <div className={`flex items-center gap-1.5 ${sizeClasses[size]}`}>
      <div className="flex items-center gap-0.5">
        <Star size={starSize[size]} className="fill-terra-500 text-terra-500" />
        <span className="font-semibold text-ink">{parseFloat(rating.average_rating).toFixed(1)}</span>
      </div>
      {showCount && (
        <span className="text-slate-400">
          · {rating.rating_count} {rating.rating_count === 1 ? 'rating' : 'ratings'}
        </span>
      )}
    </div>
  )
}
