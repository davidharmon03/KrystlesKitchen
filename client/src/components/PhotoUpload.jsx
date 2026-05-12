import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, X, Loader, ImageOff } from 'lucide-react'

const API_BASE = typeof window !== 'undefined' && window.__VITE_API_BASE__
  ? window.__VITE_API_BASE__
  : 'http://localhost:3001'

/** Resolve a server image_path (e.g. "uploads/meals/foo.jpg") → full URL */
export function photoUrl(path) {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${API_BASE}/${path}`
}

/**
 * PhotoUpload — reusable drag-drop / click-to-upload component.
 *
 * Props:
 *   value      {string|null}  — existing image_path from server (for edit mode)
 *   onFile     {fn(File)}     — called when user selects a file (controlled mode)
 *   onUpload   {async fn(File) → void} — if provided, Upload button appears and calls this
 *   onClear    {fn()}         — called when user removes the photo
 *   uploading  {bool}         — show spinner overlay
 *   compact    {bool}         — smaller inline variant
 *   label      {string}
 *   accept     {string}
 */
export default function PhotoUpload({
  value      = null,
  onFile     = null,
  onUpload   = null,
  onClear    = null,
  uploading  = false,
  compact    = false,
  label      = 'Add photo',
  accept     = 'image/*',
}) {
  const [preview, setPreview]   = useState(null)
  const [dragging, setDragging] = useState(false)
  const [file,     setFile]     = useState(null)
  const inputRef  = useRef(null)

  const existingUrl = photoUrl(value)
  const displayUrl  = preview || existingUrl

  const pick = useCallback(f => {
    if (!f || !f.type.startsWith('image/')) return
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
    onFile?.(f)
  }, [onFile])

  const handleInputChange = e => pick(e.target.files?.[0])

  const handleDrop = e => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files?.[0])
  }

  const handleClear = () => {
    setFile(null)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
    onClear?.()
  }

  const handleUpload = async () => {
    if (!file || !onUpload) return
    await onUpload(file)
    setFile(null)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {displayUrl ? (
          <div className="relative flex-shrink-0">
            <img src={displayUrl} alt="meal photo"
              className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-200"
              onError={e => { e.currentTarget.style.display = 'none' }} />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 rounded-lg">
                <Loader size={14} className="animate-spin text-moss-600" />
              </div>
            )}
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 border border-dashed border-slate-300">
            <Camera size={14} className="text-slate-400" />
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs text-moss-600 hover:text-moss-800 font-medium flex items-center gap-1">
            <Camera size={12} />
            {displayUrl ? 'Change' : label}
          </button>
          {(file && onUpload) && (
            <button type="button" onClick={handleUpload} disabled={uploading}
              className="text-xs text-white bg-moss-500 hover:bg-moss-600 px-2 py-0.5 rounded font-medium flex items-center gap-1">
              {uploading ? <Loader size={11} className="animate-spin" /> : 'Upload'}
            </button>
          )}
          {displayUrl && onClear && (
            <button type="button" onClick={handleClear} disabled={uploading}
              className="text-xs text-slate-400 hover:text-red-500">
              <X size={12} />
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleInputChange} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {label && <label className="label">{label}</label>}

      {displayUrl ? (
        <div className="relative">
          <img src={displayUrl} alt="meal photo"
            className="w-full max-h-64 object-cover rounded-xl bg-slate-100 border border-slate-200"
            onError={e => { e.currentTarget.style.display = 'none' }} />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-60 rounded-xl">
              <Loader size={24} className="animate-spin text-moss-600" />
            </div>
          )}
          <div className="absolute top-2 right-2 flex gap-1.5">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
              className="p-1.5 bg-white bg-opacity-90 rounded-lg shadow text-slate-500 hover:text-moss-600 transition-colors">
              <Camera size={14} />
            </button>
            {onClear && (
              <button type="button" onClick={handleClear} disabled={uploading}
                className="p-1.5 bg-white bg-opacity-90 rounded-lg shadow text-slate-500 hover:text-red-500 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          {file && onUpload && !uploading && (
            <div className="absolute bottom-2 left-2 right-2 flex gap-2">
              <button type="button" onClick={handleClear}
                className="flex-1 text-sm py-1.5 bg-white bg-opacity-90 rounded-lg text-slate-600 hover:bg-opacity-100 font-medium">
                Cancel
              </button>
              <button type="button" onClick={handleUpload}
                className="flex-1 text-sm py-1.5 bg-moss-500 text-white rounded-lg font-medium hover:bg-moss-600 flex items-center justify-center gap-1">
                <Upload size={13} /> Upload
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors
            ${dragging
              ? 'border-moss-400 bg-moss-50'
              : 'border-slate-200 bg-slate-50 hover:border-moss-300 hover:bg-moss-50'
            }
          `}>
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <Camera size={20} className="text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">Drag a photo here or click to browse</p>
            <p className="text-xs text-slate-400 mt-0.5">JPEG, PNG, WEBP — up to 10 MB</p>
          </div>
        </div>
      )}

      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleInputChange} />
    </div>
  )
}
