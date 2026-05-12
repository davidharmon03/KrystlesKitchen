import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const isMobile =
    typeof window !== 'undefined' &&
    (window.innerWidth < 768 ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent))

  useEffect(() => {
    if (!isMobile || dismissed) return

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isMobile, dismissed])

  if (!visible || dismissed) return null

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setVisible(false)
  }

  const handleDismiss = () => {
    setDismissed(true)
    setVisible(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:hidden">
      <div className="bg-white border border-moss-200 rounded-xl shadow-lg flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-moss-500 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-serif font-bold text-lg leading-none">K</span>
        </div>
        <p className="flex-1 text-sm text-slate-700 leading-snug">
          Install <span className="font-semibold text-moss-700">Brand Hub</span> on your phone for a better experience
        </p>
        <button
          onClick={handleInstall}
          className="flex-shrink-0 bg-moss-600 hover:bg-moss-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <Download size={13} />
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-1"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
