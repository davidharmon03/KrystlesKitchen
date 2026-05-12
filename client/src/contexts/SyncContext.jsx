import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './AuthContext'
import api from '../api'

const SyncContext = createContext(null)

export function SyncProvider({ children }) {
  const { user, refreshUser } = useAuth()
  const groupId = user?.groups?.[0]?.id

  // Initialize from server-persisted value; default auto
  const [syncMode,     setSyncModeLocal] = useState(user?.sync_mode || 'auto')
  const [syncStatus,   setSyncStatus]    = useState('synced')  // 'synced'|'pending'|'offline'|'syncing'
  const [lastSyncedAt, setLastSyncedAt]  = useState(null)
  const [pendingCount, setPendingCount]  = useState(0)
  const isSyncingRef = useRef(false)

  // Keep syncMode in sync with user object (e.g. after refreshUser)
  useEffect(() => {
    if (user?.sync_mode) setSyncModeLocal(user.sync_mode)
  }, [user?.sync_mode])

  // ── syncNow ────────────────────────────────────────────────────────────────

  const syncNow = useCallback(async () => {
    if (!groupId || isSyncingRef.current) return
    isSyncingRef.current = true
    setSyncStatus('syncing')
    try {
      const res = await api.put(`/groups/${groupId}/sync-ping`)
      setLastSyncedAt(res.data.last_synced_at)
      setPendingCount(0)
      setSyncStatus('synced')
    } catch {
      setSyncStatus(navigator.onLine ? 'pending' : 'offline')
    } finally {
      isSyncingRef.current = false
    }
  }, [groupId])

  // ── update sync mode — persists to server ─────────────────────────────────

  const setSyncMode = useCallback(async (mode) => {
    setSyncModeLocal(mode)
    try {
      await api.put('/auth/profile', { sync_mode: mode })
      await refreshUser()
    } catch {}
    // Switching back to auto: immediately ping + reset counter
    if (mode === 'auto') {
      setPendingCount(0)
      syncNow()
    }
  }, [syncNow, refreshUser])

  // ── auto-ping on mount + tab focus ────────────────────────────────────────

  useEffect(() => {
    if (groupId && syncMode === 'auto') syncNow()
  }, [groupId]) // intentionally omit syncMode/syncNow to run only on groupId change

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && groupId && syncMode === 'auto') {
        syncNow()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [groupId, syncMode, syncNow])

  // ── axios interceptor — count mutations in manual mode ────────────────────

  useEffect(() => {
    const id = api.interceptors.response.use(res => {
      if (syncMode !== 'manual') return res
      const method = res.config?.method?.toUpperCase()
      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      const url = res.config?.url || ''
      const isOverhead = url.includes('/sync-ping') || url.includes('/auth/') ||
                         url.includes('/notifications/') && method === 'PUT'
      if (isMutation && !isOverhead) {
        setPendingCount(c => c + 1)
        setSyncStatus('pending')
      }
      return res
    })
    return () => api.interceptors.response.eject(id)
  }, [syncMode])

  // ── online / offline detection ────────────────────────────────────────────

  useEffect(() => {
    const onOnline  = () => {
      if (syncMode === 'auto') syncNow()
      else setSyncStatus(pendingCount > 0 ? 'pending' : 'synced')
    }
    const onOffline = () => setSyncStatus('offline')
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [syncMode, pendingCount, syncNow])

  return (
    <SyncContext.Provider value={{ syncMode, setSyncMode, syncStatus, lastSyncedAt, pendingCount, syncNow }}>
      {children}
    </SyncContext.Provider>
  )
}

export const useSync = () => useContext(SyncContext)
