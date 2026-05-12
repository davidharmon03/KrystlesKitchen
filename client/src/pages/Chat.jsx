import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { AvatarCircle } from '../components/Layout'
import api from '../api'
import { MessageSquare, Send, ChevronUp, Loader2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const POLL_MS  = 10_000

// ── helpers ────────────────────────────────────────────────────────────────

function formatTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`

  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`

  // Same calendar year → month + day; otherwise include year
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

function msgUserAvatar(msg) {
  // Build a minimal user-shaped object that AvatarCircle understands
  return { name: msg.user_name, avatar_path: msg.avatar_path }
}

// ── message bubble ─────────────────────────────────────────────────────────

function MessageBubble({ msg, isMine, showName, onDelete }) {
  const [hover, setHover] = useState(false)

  return (
    <div
      className={`flex gap-2.5 group ${isMine ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Avatar — show on first message in a run */}
      <div className="flex-shrink-0 self-end">
        {showName
          ? <AvatarCircle user={msgUserAvatar(msg)} size="sm" />
          : <div className="w-6 h-6" />}
      </div>

      <div className={`flex flex-col max-w-[75%] sm:max-w-[60%] ${isMine ? 'items-end' : 'items-start'}`}>
        {showName && !isMine && (
          <span className="text-xs font-semibold text-slate-500 mb-1 px-1">{msg.user_name}</span>
        )}

        <div className="relative flex items-end gap-1.5">
          {/* Delete button — mine only, appears on hover */}
          {isMine && hover && (
            <button
              onClick={() => onDelete(msg.id)}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors px-1 flex-shrink-0 mb-0.5"
              title="Delete message"
            >
              ✕
            </button>
          )}

          <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isMine
              ? 'bg-moss-500 text-white rounded-br-sm'
              : 'bg-white text-ink border border-slate-200 rounded-bl-sm'
          }`}>
            {msg.content}
          </div>
        </div>

        <span className="text-[10px] text-slate-400 mt-0.5 px-1">{formatTime(msg.created_at)}</span>
      </div>
    </div>
  )
}

// ── main page ──────────────────────────────────────────────────────────────

export default function Chat() {
  const { user } = useAuth()
  const groupId = user?.groups?.[0]?.id

  const [messages,    setMessages]    = useState([])
  const [input,       setInput]       = useState('')
  const [sending,     setSending]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(true)
  const [error,       setError]       = useState(null)

  const bottomRef    = useRef(null)
  const inputRef     = useRef(null)
  const latestTsRef  = useRef(null)   // ISO string of newest message we have
  const isAtBottomRef = useRef(true)

  // ── initial load ──────────────────────────────────────────────────────────

  const loadInitial = useCallback(async () => {
    if (!groupId) return
    try {
      const res = await api.get(`/chat/${groupId}`)
      setMessages(res.data)
      setHasMore(res.data.length === 100)
      if (res.data.length > 0) {
        latestTsRef.current = res.data[res.data.length - 1].created_at
      }
    } catch (err) {
      setError('Could not load chat. Try refreshing.')
      console.error(err)
    }
  }, [groupId])

  useEffect(() => { loadInitial() }, [loadInitial])

  // ── polling ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!groupId) return
    const poll = async () => {
      try {
        const since = latestTsRef.current || new Date(0).toISOString()
        const res = await api.get(`/chat/${groupId}/since/${encodeURIComponent(since)}`)
        if (res.data.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id))
            const fresh = res.data.filter(m => !existingIds.has(m.id))
            if (!fresh.length) return prev
            latestTsRef.current = fresh[fresh.length - 1].created_at
            return [...prev, ...fresh]
          })
        }
      } catch { /* silent — keep polling */ }
    }
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [groupId])

  // ── auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Track whether user is near the bottom
  const handleScroll = (e) => {
    const el = e.currentTarget
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  // ── send ──────────────────────────────────────────────────────────────────

  const send = async () => {
    const text = input.trim()
    if (!text || sending || !groupId) return
    setSending(true)
    setInput('')
    try {
      const res = await api.post(`/chat/${groupId}`, { content: text })
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        if (existingIds.has(res.data.id)) return prev
        return [...prev, res.data]
      })
      latestTsRef.current = res.data.created_at
      isAtBottomRef.current = true
    } catch {
      setInput(text) // restore on failure
      setError('Failed to send message.')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // ── load older ───────────────────────────────────────────────────────────

  const loadOlder = async () => {
    if (!groupId || loadingMore || !hasMore) return
    const oldest = messages[0]?.created_at
    if (!oldest) return
    setLoadingMore(true)
    try {
      const res = await api.get(`/chat/${groupId}?before=${encodeURIComponent(oldest)}`)
      setHasMore(res.data.length === 100)
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        const fresh = res.data.filter(m => !existingIds.has(m.id))
        return [...fresh, ...prev]
      })
    } catch { setError('Could not load older messages.') }
    finally { setLoadingMore(false) }
  }

  // ── soft-delete ───────────────────────────────────────────────────────────

  const deleteMessage = async (id) => {
    try {
      await api.delete(`/chat/${groupId}/${id}`)
      setMessages(prev => prev.filter(m => m.id !== id))
    } catch { setError('Could not delete message.') }
  }

  // ── no group state ────────────────────────────────────────────────────────

  if (!groupId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <MessageSquare size={40} className="text-slate-300 mb-4" />
        <p className="text-slate-500 font-medium">No group yet</p>
        <p className="text-slate-400 text-sm mt-1">Join or create a group to start chatting.</p>
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────

  const groupName = user?.groups?.[0]?.name || 'Group'

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <MessageSquare size={22} className="text-moss-500 flex-shrink-0" />
        <div>
          <h1 className="text-xl font-serif font-semibold text-ink">{groupName} Chat</h1>
          <p className="text-xs text-slate-400">Messages refresh every 10 seconds</p>
        </div>
      </div>

      {error && (
        <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between flex-shrink-0">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Message list */}
      <div
        className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-sm"
        onScroll={handleScroll}
      >
        {/* Load older button */}
        {hasMore && (
          <div className="flex justify-center pt-4 pb-2">
            <button
              onClick={loadOlder}
              disabled={loadingMore}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-moss-700 transition-colors disabled:opacity-50"
            >
              {loadingMore
                ? <Loader2 size={13} className="animate-spin" />
                : <ChevronUp size={13} />}
              {loadingMore ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !loadingMore && (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <MessageSquare size={32} className="text-slate-200 mb-3" />
            <p className="text-slate-400 text-sm">No messages yet. Say hello!</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex flex-col gap-1.5 p-4">
          {messages.map((msg, i) => {
            const isMine = msg.user_id === user?.id
            const prev = messages[i - 1]
            // Show name/avatar on first message in a consecutive run from same user
            const showName = !prev || prev.user_id !== msg.user_id
            return (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isMine={isMine}
                showName={showName}
                onDelete={deleteMessage}
              />
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="mt-3 flex gap-2 flex-shrink-0">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the group… (Enter to send, Shift+Enter for new line)"
          className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-ink placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-moss-400 focus:border-transparent bg-white shadow-sm transition-shadow"
          style={{ minHeight: '2.75rem', maxHeight: '8rem', overflowY: 'auto' }}
          onInput={e => {
            // Auto-grow textarea
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
          }}
          disabled={sending}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          className="flex-shrink-0 w-11 h-11 rounded-xl bg-moss-500 hover:bg-moss-600 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-colors shadow-sm self-end"
          title="Send"
        >
          {sending
            ? <Loader2 size={16} className="animate-spin" />
            : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}
