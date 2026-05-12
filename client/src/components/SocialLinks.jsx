// Reusable social links component — renders clickable icons for non-empty platforms
// Usage: <SocialLinks links={user.social_links} size="sm" />

const PLATFORMS = [
  {
    key: 'website',
    label: 'Website',
    color: 'text-slate-500 hover:text-slate-700',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    toUrl: v => v.startsWith('http') ? v : `https://${v}`,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    color: 'text-pink-500 hover:text-pink-700',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
    toUrl: v => `https://instagram.com/${v.replace(/^@/, '')}`,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    color: 'text-slate-800 hover:text-black',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.7a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
      </svg>
    ),
    toUrl: v => `https://tiktok.com/@${v.replace(/^@/, '')}`,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    color: 'text-red-500 hover:text-red-700',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.56 12 3.56 12 3.56s-7.54 0-9.38.49A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.44 12 20.44 12 20.44s7.54 0 9.38-.49a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z" />
      </svg>
    ),
    toUrl: v => v.startsWith('http') ? v : `https://youtube.com/@${v.replace(/^@/, '')}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    color: 'text-blue-600 hover:text-blue-800',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97H15.8c-1.49 0-1.95.93-1.95 1.88v2.27h3.32l-.53 3.5h-2.79V24C19.61 23.1 24 18.1 24 12.07z" />
      </svg>
    ),
    toUrl: v => v.startsWith('http') ? v : `https://facebook.com/${v}`,
  },
  {
    key: 'twitter',
    label: 'X / Twitter',
    color: 'text-slate-700 hover:text-black',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    toUrl: v => `https://x.com/${v.replace(/^@/, '')}`,
  },
  {
    key: 'pinterest',
    label: 'Pinterest',
    color: 'text-red-600 hover:text-red-800',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
      </svg>
    ),
    toUrl: v => `https://pinterest.com/${v.replace(/^@/, '')}`,
  },
]

// Returns an array of platform configs for non-empty links
export function activePlatforms(links = {}) {
  return PLATFORMS.filter(p => links[p.key]?.trim())
}

export { PLATFORMS }

// sizes: 'sm' (16px), 'md' (20px), 'lg' (24px)
const SIZES = { sm: 4, md: 5, lg: 6 }

export default function SocialLinks({ links = {}, size = 'sm', className = '' }) {
  const active = activePlatforms(links)
  if (!active.length) return null

  const dim = SIZES[size] || 4

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {active.map(p => (
        <a
          key={p.key}
          href={p.toUrl(links[p.key])}
          target="_blank"
          rel="noopener noreferrer"
          title={p.label}
          className={`w-${dim} h-${dim} flex-shrink-0 transition-opacity opacity-70 hover:opacity-100 ${p.color}`}
          onClick={e => e.stopPropagation()}
        >
          {p.icon}
        </a>
      ))}
    </div>
  )
}
