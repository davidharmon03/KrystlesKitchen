import { Package } from 'lucide-react'

const CATEGORY_COLORS = {
  produce:     'bg-green-100 text-green-700',
  meat_seafood:'bg-red-100 text-red-700',
  dairy_eggs:  'bg-blue-100 text-blue-700',
  pantry:      'bg-amber-100 text-amber-700',
  frozen:      'bg-sky-100 text-sky-700',
  beverages:   'bg-purple-100 text-purple-700',
  bakery:      'bg-orange-100 text-orange-700',
  snacks:      'bg-pink-100 text-pink-700',
  household:   'bg-slate-100 text-slate-600',
  bulk:        'bg-moss-100 text-moss-700',
  other:       'bg-slate-100 text-slate-500',
}

export function ProductThumb({ product, size = 40 }) {
  if (!product) return null
  const base = 'http://localhost:3001'
  const src  = product.image_path
    ? `${base}/${product.image_path}`
    : product.image_url || null

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

export default function ProductCard({ product, className = '' }) {
  if (!product) return null
  const catColor = CATEGORY_COLORS[product.category] || CATEGORY_COLORS.other

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <ProductThumb product={product} size={60} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink text-sm leading-tight truncate">{product.name}</p>
        {product.brand && <p className="text-xs text-slate-400 mt-0.5">{product.brand}</p>}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {product.category && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${catColor}`}>
              {product.category.replace('_', ' ')}
            </span>
          )}
          {product.unit_type && (
            <span className="text-xs text-slate-400">{product.unit_type}</span>
          )}
          {product.unit_size && (
            <span className="text-xs text-slate-400">· {product.unit_size}</span>
          )}
        </div>
      </div>
    </div>
  )
}
