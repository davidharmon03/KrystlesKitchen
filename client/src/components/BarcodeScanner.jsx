import { useEffect, useRef, useState } from 'react'
import { X, Camera } from 'lucide-react'

/**
 * BarcodeScanner
 * Full-screen camera modal — uses @zxing/browser to decode QR codes,
 * EAN-13, UPC-A, and all other common barcode formats.
 *
 * Props:
 *   isOpen   – boolean
 *   onScan   – (barcodeString) => void   called after the ✓ flash
 *   onClose  – ()              => void   called when user dismisses OR after a scan
 *   onError  – optional error callback (kept for API compat)
 */
export default function BarcodeScanner({ isOpen, onScan, onClose, onError }) {
  const videoRef    = useRef(null)
  const controlsRef = useRef(null)   // ZXing IScannerControls
  const doneRef     = useRef(false)  // guard against double-fire

  // status: 'loading' | 'scanning' | 'scanned' | 'denied' | 'unavailable'
  const [status,      setStatus]      = useState('loading')
  const [manualMode,  setManualMode]  = useState(false)
  const [manualValue, setManualValue] = useState('')
  const [flash,       setFlash]       = useState(false)

  // ── helpers ───────────────────────────────────────────────────────────────
  const stop = () => {
    try { controlsRef.current?.stop() } catch (_) {}
    controlsRef.current = null
  }

  const handleClose = () => {
    stop()
    onClose()
  }

  const handleManualSubmit = e => {
    e.preventDefault()
    const val = manualValue.trim()
    if (!val) return
    stop()
    setManualValue('')
    setManualMode(false)
    onScan(val)
    onClose()
  }

  // ── start ZXing whenever isOpen flips true ────────────────────────────────
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    doneRef.current = false
    setStatus('loading')
    setManualMode(false)
    setManualValue('')
    setFlash(false)

    const start = async () => {
      try {
        // Dynamic import — keeps ZXing out of the initial bundle
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (cancelled) return

        // Basic capability check
        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus('unavailable')
          return
        }

        const reader = new BrowserMultiFormatReader()

        // Prefer rear camera on mobile devices
        let deviceId
        try {
          const devices = await BrowserMultiFormatReader.listVideoInputDevices()
          if (!devices || devices.length === 0) {
            setStatus('unavailable')
            return
          }
          const back = devices.find(d => /back|rear|environment/i.test(d.label))
          deviceId = back ? back.deviceId : undefined
        } catch {
          // enumerateDevices failed (e.g. permission not yet granted) — proceed with undefined
          deviceId = undefined
        }

        if (cancelled) return
        if (!videoRef.current) { setStatus('unavailable'); return }

        setStatus('scanning')

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, _err, ctrl) => {
            if (!result || cancelled || doneRef.current) return
            doneRef.current = true
            const code = result.getText()
            ctrl.stop()
            controlsRef.current = null
            setFlash(true)
            setStatus('scanned')
            setTimeout(() => {
              if (cancelled) return
              setFlash(false)
              onScan(code)
              onClose()
            }, 700)
          }
        )

        if (cancelled) {
          try { controls.stop() } catch (_) {}
        } else {
          controlsRef.current = controls
        }
      } catch (err) {
        if (cancelled) return
        const name = err?.name || ''
        if (
          name === 'NotAllowedError' ||
          name === 'PermissionDeniedError' ||
          (err?.message || '').toLowerCase().includes('permission')
        ) {
          setStatus('denied')
        } else {
          console.warn('[BarcodeScanner]', err)
          setStatus('unavailable')
        }
        onError?.(err)
      }
    }

    start()

    return () => {
      cancelled = true
      stop()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-black z-10">
        <span className="text-white font-semibold text-sm tracking-wide">Scan Barcode</span>
        <button
          onClick={handleClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Close scanner"
        >
          <X size={20} />
        </button>
      </div>

      {/* ── Camera / status area ──────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden bg-black">

        {/* Live feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Loading */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
              <p className="text-white/60 text-sm">Starting camera…</p>
            </div>
          </div>
        )}

        {/* Permission denied */}
        {status === 'denied' && !manualMode && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10 px-8">
            <div className="text-center space-y-4 max-w-xs">
              <Camera size={44} className="mx-auto text-white/30" />
              <p className="text-white font-semibold">Camera access denied</p>
              <p className="text-white/50 text-sm">
                Enable camera permission in your browser or device settings, then try again.
              </p>
              <button
                onClick={() => setManualMode(true)}
                className="w-full py-2.5 px-4 bg-moss-600 hover:bg-moss-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Enter barcode manually
              </button>
            </div>
          </div>
        )}

        {/* No camera hardware */}
        {status === 'unavailable' && !manualMode && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10 px-8">
            <div className="text-center space-y-4 max-w-xs">
              <Camera size={44} className="mx-auto text-white/30" />
              <p className="text-white font-semibold">Camera not available</p>
              <p className="text-white/50 text-sm">No camera was found on this device.</p>
              <button
                onClick={() => setManualMode(true)}
                className="w-full py-2.5 px-4 bg-moss-600 hover:bg-moss-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Enter barcode manually
              </button>
            </div>
          </div>
        )}

        {/* Targeting frame (visible while scanning) */}
        {status === 'scanning' && !manualMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            {/* Soft dark vignette */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 72% 46% at center, transparent 28%, rgba(0,0,0,0.55) 100%)',
              }}
            />
            {/* Frame */}
            <div className="relative" style={{ width: 260, height: 160 }}>
              {/* Moss green corner brackets */}
              <div className="absolute top-0 left-0  w-7 h-7 border-t-[3px] border-l-[3px] border-moss-400 rounded-tl-sm" />
              <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-moss-400 rounded-tr-sm" />
              <div className="absolute bottom-0 left-0  w-7 h-7 border-b-[3px] border-l-[3px] border-moss-400 rounded-bl-sm" />
              <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-moss-400 rounded-br-sm" />
              {/* Animated scan line */}
              <div
                className="absolute left-2 right-2 h-px bg-moss-400/80"
                style={{ animation: 'kkScanline 1.8s ease-in-out infinite', top: '50%' }}
              />
            </div>
            <p
              className="text-white/80 text-sm mt-5 font-medium tracking-wide"
              style={{ position: 'relative', zIndex: 1 }}
            >
              Point camera at barcode
            </p>
          </div>
        )}

        {/* ✓ Scanned flash */}
        {flash && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40">
            <div className="bg-moss-500 text-white px-8 py-4 rounded-2xl text-lg font-bold flex items-center gap-3 shadow-xl">
              <span>✓</span> Scanned!
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="bg-black px-4 py-4 z-10">
        {manualMode ? (
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              className="flex-1 bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-moss-400"
              placeholder="Type barcode number…"
              value={manualValue}
              onChange={e => setManualValue(e.target.value)}
            />
            <button
              type="submit"
              disabled={!manualValue.trim()}
              className="px-5 py-2.5 bg-moss-600 hover:bg-moss-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Use
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-white/40 text-xs">Hold steady — aim at the barcode</p>
            <button
              onClick={() => setManualMode(true)}
              className="text-white/50 hover:text-white/80 text-xs transition-colors py-1"
            >
              Type instead
            </button>
          </div>
        )}
      </div>

      {/* Scan-line keyframe — prefixed to avoid collisions */}
      <style>{`
        @keyframes kkScanline {
          0%   { transform: translateY(-60px); opacity: 0.3; }
          50%  { transform: translateY(0px);   opacity: 1;   }
          100% { transform: translateY(60px);  opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
