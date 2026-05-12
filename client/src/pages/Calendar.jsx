import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import { ChevronLeft, ChevronRight, Calendar as CalIcon, X, Users } from 'lucide-react'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const EVENT_CFG = {
  created:  { dot: 'bg-moss-500',   ring: 'ring-moss-300',   text: 'text-moss-700',   bg: 'bg-moss-50',   label: 'Added'    },
  expiring: { dot: 'bg-yellow-400', ring: 'ring-yellow-300', text: 'text-yellow-700', bg: 'bg-yellow-50', label: 'Expiring' },
  expired:  { dot: 'bg-red-500',    ring: 'ring-red-300',    text: 'text-red-700',    bg: 'bg-red-50',    label: 'Expired'  },
  bulk_buy: { dot: 'bg-terra-500',  ring: 'ring-terra-300',  text: 'text-terra-700',  bg: 'bg-terra-50',  label: 'Bulk Buy' },
  harvest:  { dot: 'bg-moss-400',   ring: 'ring-moss-200',   text: 'text-moss-600',   bg: 'bg-moss-50',   label: 'Harvest'  },
}

// Dot render order: expired first (most urgent), then expiring, created, bulk_buy, harvest
const DOT_ORDER = ['expired', 'expiring', 'bulk_buy', 'harvest', 'created']

export default function Calendar() {
  const { user } = useAuth()
  const activeGroup = user?.groups?.[0]
  const today = new Date()

  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1)
  const [events,    setEvents]    = useState([])
  const [loading,   setLoading]   = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)

  const loadEvents = useCallback(async () => {
    if (!activeGroup) return
    setLoading(true)
    try {
      const res = await api.get(`/calendar?group_id=${activeGroup.id}&month=${viewMonth}&year=${viewYear}`)
      setEvents(res.data.events || [])
    } catch (e) {
      console.error('Calendar load error:', e)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [activeGroup?.id, viewMonth, viewYear])

  useEffect(() => { loadEvents() }, [loadEvents])

  const prevMonth = () => {
    setSelectedDay(null)
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    setSelectedDay(null)
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Build calendar grid
  const firstDow  = new Date(viewYear, viewMonth - 1, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()

  // Group events by YYYY-MM-DD
  const byDate = events.reduce((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = []
    acc[ev.date].push(ev)
    return acc
  }, {})

  const fmtDate = d =>
    `${viewYear}-${String(viewMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`

  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  const selStr     = selectedDay ? fmtDate(selectedDay) : null
  const selEvents  = selStr ? (byDate[selStr] || []) : []

  // Summary counts
  const counts = events.reduce((acc, ev) => { acc[ev.type] = (acc[ev.type] || 0) + 1; return acc }, {})

  if (!activeGroup) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-semibold text-ink flex items-center gap-2">
            <CalIcon size={22} className="text-moss-500" /> Group Calendar
          </h1>
        </div>
        <div className="card text-center py-16 border-terra-200 bg-terra-50">
          <Users size={36} className="mx-auto mb-3 text-terra-400" />
          <p className="font-semibold text-terra-800">You need a group to see the calendar.</p>
          <p className="text-sm text-terra-600 mt-1">Create or join a group from the dashboard first.</p>
          <Link to="/" className="inline-block mt-4 btn-terra text-sm">Go to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-semibold text-ink flex items-center gap-2">
          <CalIcon size={22} className="text-moss-500" /> Group Calendar
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Meal creation, expiry dates, bulk buy runs, and harvests — {activeGroup.name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Calendar grid ── */}
        <div className="lg:col-span-2">
          <div className="card">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-5">
              <button onClick={prevMonth}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <h2 className="font-serif font-semibold text-ink text-lg">
                {MONTH_NAMES[viewMonth - 1]} {viewYear}
              </h2>
              <button onClick={nextMonth}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            {loading ? (
              <div className="flex justify-center py-14">
                <div className="w-8 h-8 border-4 border-moss-200 border-t-moss-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100">
                {/* Leading empty cells */}
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={`pad-${i}`} className="bg-cream min-h-[60px]" />
                ))}
                {/* Day cells */}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const ds       = fmtDate(day)
                  const dayEvs   = byDate[ds] || []
                  const isToday  = ds === todayStr
                  const isSel    = selectedDay === day
                  const hasEvs   = dayEvs.length > 0
                  // Deduplicate dot types, sorted by urgency
                  const dotTypes = DOT_ORDER.filter(t => dayEvs.some(e => e.type === t)).slice(0, 4)

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDay(isSel ? null : day)}
                      className={`bg-white min-h-[60px] p-1.5 cursor-pointer transition-colors
                        hover:bg-moss-50
                        ${isSel ? 'ring-2 ring-inset ring-moss-400 bg-moss-50' : ''}
                        ${hasEvs ? 'hover:shadow-inner' : ''}`}
                    >
                      <div className={`
                        text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1
                        ${isToday ? 'bg-moss-500 text-white' : 'text-slate-700'}
                      `}>
                        {day}
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {dotTypes.map(type => (
                          <div key={type}
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${EVENT_CFG[type]?.dot || 'bg-slate-400'}`}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-slate-100">
              {Object.entries(EVENT_CFG).map(([type, cfg]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className="text-xs text-slate-500">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel: day detail + summary ── */}
        <div className="space-y-4">
          {/* Day detail */}
          {selectedDay ? (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-semibold text-ink text-sm">
                  {MONTH_NAMES[viewMonth - 1]} {selectedDay}, {viewYear}
                </h3>
                <button onClick={() => setSelectedDay(null)}
                  className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={15} />
                </button>
              </div>
              {selEvents.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nothing on this day</p>
              ) : (
                <div className="space-y-2">
                  {selEvents
                    .sort((a, b) => DOT_ORDER.indexOf(a.type) - DOT_ORDER.indexOf(b.type))
                    .map(ev => <EventItem key={ev.id} event={ev} />)}
                </div>
              )}
            </div>
          ) : (
            <div className="card text-center py-8 text-slate-400 bg-slate-50 border border-dashed border-slate-200">
              <CalIcon size={26} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Click any day to see its events</p>
            </div>
          )}

          {/* Monthly summary */}
          <div className="card">
            <h3 className="font-serif font-semibold text-ink text-sm mb-3">
              {MONTH_NAMES[viewMonth - 1]} Summary
            </h3>
            {events.length === 0 && !loading ? (
              <p className="text-xs text-slate-400">No events this month</p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(EVENT_CFG).map(([type, cfg]) => {
                  const n = counts[type] || 0
                  if (n === 0) return null
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        <span className="text-xs text-slate-600">{cfg.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700 tabular-nums">{n}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Expiring soon alert */}
          {(counts.expiring > 0 || counts.expired > 0) && (
            <div className={`card border ${counts.expired > 0 ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
              <p className={`text-xs font-semibold mb-1 ${counts.expired > 0 ? 'text-red-700' : 'text-yellow-700'}`}>
                {counts.expired > 0 ? '⚠️ Items past use-by this month' : '⏰ Items expiring this month'}
              </p>
              <p className="text-xs text-slate-600">
                {counts.expired > 0 && `${counts.expired} expired item${counts.expired !== 1 ? 's' : ''}. `}
                {counts.expiring > 0 && `${counts.expiring} expiring soon.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EventItem({ event }) {
  const cfg = EVENT_CFG[event.type] || { dot: 'bg-slate-400', text: 'text-slate-700', bg: 'bg-slate-50' }
  return (
    <div className={`flex items-start gap-2.5 p-2.5 rounded-lg ${cfg.bg}`}>
      <div className={`w-2 h-2 rounded-full mt-[5px] flex-shrink-0 ${cfg.dot}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${cfg.text}`}>{event.label}</p>
        {event.sublabel && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">{event.sublabel}</p>
        )}
      </div>
    </div>
  )
}
