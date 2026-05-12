import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { firstName } from '../utils/userName'
import api from '../api'
import { Chart, registerables } from 'chart.js'
import { DollarSign, Plus, Upload, ArrowRight, TrendingUp, TrendingDown, Minus, Trash2, X, Mail, Loader, BarChart2 } from 'lucide-react'

Chart.register(...registerables)

// Brand palette for charts
const BRAND_COLORS = ['#6B7C5C', '#C4714F', '#6B7280', '#8B9E7A', '#D4876A', '#4A5568']

function NoGroup() {
  return (
    <div className="text-center py-16 text-slate-400">
      <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium">Join or create a group first</p>
      <p className="text-sm mt-1">Corner is a group-based feature</p>
    </div>
  )
}

export default function Korner() {
  const { user } = useAuth()
  const activeGroup = user?.groups?.[0]
  const [tab, setTab] = useState('equalizer')
  const [receipts, setReceipts] = useState([])
  const [equalizer, setEqualizer] = useState(null)
  const [credits, setCredits] = useState({ transactions: [], balances: [] })
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  // Receipt form
  const [rForm, setRForm] = useState({ amount: '', description: '', image: null })
  const [rError, setRError] = useState('')
  const [rLoading, setRLoading] = useState(false)

  // Credit form
  const [cForm, setCForm] = useState({ credits: '', note: '' })
  const [cLoading, setCLoading] = useState(false)
  const [digestSending, setDigestSending] = useState(false)
  const [digestMsg, setDigestMsg] = useState('')

  // Chart refs
  const barRef = useRef(null)
  const doughnutRef = useRef(null)
  const barChartInst = useRef(null)
  const doughnutChartInst = useRef(null)

  const gid = activeGroup?.id

  const loadAll = () => {
    if (!gid) return
    setLoading(true)
    Promise.all([
      api.get(`/korner/${gid}/receipts`),
      api.get(`/korner/${gid}/equalizer`),
      api.get(`/korner/${gid}/meal-credits`),
      api.get(`/korner/${gid}/stats`),
    ]).then(([r, e, c, s]) => {
      setReceipts(r.data)
      setEqualizer(e.data)
      setCredits(c.data)
      setStats(s.data)
    }).catch(() => {})
    .finally(() => setLoading(false))
  }

  useEffect(loadAll, [gid])

  // Build / rebuild charts whenever we switch to the charts tab or stats update
  useEffect(() => {
    if (tab !== 'charts' || !stats) return

    const timer = setTimeout(() => {
      // ── Bar chart: monthly spend ──
      if (barRef.current) {
        if (barChartInst.current) { barChartInst.current.destroy(); barChartInst.current = null }
        barChartInst.current = new Chart(barRef.current, {
          type: 'bar',
          data: {
            labels: stats.monthlySpend.map(m => m.month),
            datasets: [{
              label: 'Total Spent',
              data: stats.monthlySpend.map(m => m.total),
              backgroundColor: '#6B7C5C',
              borderRadius: 6,
              borderSkipped: false,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: { label: ctx => ` $${Number(ctx.raw).toFixed(2)}` },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { callback: v => `$${v}` },
                grid: { color: '#f1f5f9' },
              },
              x: { grid: { display: false } },
            },
          },
        })
      }

      // ── Doughnut chart: spend by member ──
      if (doughnutRef.current) {
        if (doughnutChartInst.current) { doughnutChartInst.current.destroy(); doughnutChartInst.current = null }
        doughnutChartInst.current = new Chart(doughnutRef.current, {
          type: 'doughnut',
          data: {
            labels: stats.spendByMember.map(m => m.name),
            datasets: [{
              data: stats.spendByMember.map(m => m.total),
              backgroundColor: BRAND_COLORS.slice(0, stats.spendByMember.length),
              borderWidth: 3,
              borderColor: '#ffffff',
              hoverOffset: 6,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { padding: 16, font: { size: 13 } } },
              tooltip: {
                callbacks: {
                  label: ctx => ` ${ctx.label}: $${Number(ctx.raw).toFixed(2)}`,
                },
              },
            },
          },
        })
      }
    }, 50)

    return () => {
      clearTimeout(timer)
      if (barChartInst.current) { barChartInst.current.destroy(); barChartInst.current = null }
      if (doughnutChartInst.current) { doughnutChartInst.current.destroy(); doughnutChartInst.current = null }
    }
  }, [tab, stats])

  const submitReceipt = async e => {
    e.preventDefault()
    setRError('')
    if (!rForm.amount) { setRError('Amount is required'); return }
    setRLoading(true)
    try {
      const fd = new FormData()
      fd.append('amount', rForm.amount)
      fd.append('description', rForm.description)
      if (rForm.image) fd.append('image', rForm.image)
      await api.post(`/korner/${gid}/receipts`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setRForm({ amount: '', description: '', image: null })
      loadAll()
    } catch (err) {
      setRError(err.response?.data?.error || 'Failed to add receipt')
    } finally { setRLoading(false) }
  }

  const deleteReceipt = async id => {
    if (!confirm('Delete this receipt?')) return
    await api.delete(`/korner/${gid}/receipts/${id}`)
    loadAll()
  }

  const submitCredit = async e => {
    e.preventDefault()
    setCLoading(true)
    try {
      await api.post(`/korner/${gid}/meal-credits`, cForm)
      setCForm({ credits: '', note: '' })
      loadAll()
    } catch { } finally { setCLoading(false) }
  }

  const sendDigest = async () => {
    if (!confirm('Send the weekly digest email to all group members?')) return
    setDigestSending(true)
    setDigestMsg('')
    try {
      const res = await api.post(`/digest/send?group_id=${gid}`)
      const sent = res.data.results?.filter(r => r.status === 'sent').length || 0
      setDigestMsg(`Digest sent to ${sent} member${sent !== 1 ? 's' : ''}!`)
      setTimeout(() => setDigestMsg(''), 5000)
    } catch (err) {
      setDigestMsg(err.response?.data?.error || 'Failed to send digest')
    } finally { setDigestSending(false) }
  }

  if (!activeGroup) return <NoGroup />

  const tabs = [
    { id: 'equalizer', label: 'The Equalizer' },
    { id: 'receipts',  label: 'Receipts' },
    { id: 'credits',   label: 'Meal Credits' },
    { id: 'charts',    label: 'Spending' },
  ]

  const fmt = n => `$${Number(n).toFixed(2)}`

  const hasSpendData = stats && (
    stats.monthlySpend.some(m => m.total > 0) ||
    stats.spendByMember.length > 0
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="section-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-moss-100 flex items-center justify-center">
            <DollarSign size={20} className="text-moss-600" />
          </div>
          <div>
            <h1 className="page-title">{firstName(user)}'s Corner</h1>
            <p className="text-sm text-slate-500">Group Finance Hub — {activeGroup.name}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={sendDigest}
            disabled={digestSending}
            className="btn-ghost flex items-center gap-1.5 text-sm border border-slate-200"
          >
            {digestSending ? <Loader size={13} className="animate-spin" /> : <Mail size={13} />}
            Send Digest
          </button>
          {digestMsg && <p className="text-xs text-moss-600 font-medium">{digestMsg}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-moss-200 border-t-moss-600 rounded-full animate-spin" /></div>}

      {/* ── Equalizer ── */}
      {!loading && tab === 'equalizer' && equalizer && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center">
              <p className="text-xs text-slate-500 mb-1">Total Spent</p>
              <p className="text-2xl font-serif font-semibold text-ink">{fmt(equalizer.total)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-slate-500 mb-1">Fair Share</p>
              <p className="text-2xl font-serif font-semibold text-moss-700">{fmt(equalizer.fair_share)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-slate-500 mb-1">Members</p>
              <p className="text-2xl font-serif font-semibold text-ink">{equalizer.member_count}</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="card">
            <h3 className="font-semibold text-ink mb-3 font-serif">Who Paid What</h3>
            <div className="space-y-2">
              {equalizer.breakdown.map(b => (
                <div key={b.user_id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-moss-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-moss-700 text-xs font-semibold">{b.name[0]}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-ink">{b.name}</span>
                      <span className="text-slate-500">Paid {fmt(b.paid)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${b.balance >= 0 ? 'bg-moss-400' : 'bg-terra-400'}`}
                        style={{ width: `${Math.min(100, equalizer.total > 0 ? (b.paid / equalizer.total) * 100 : 0)}%` }} />
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-semibold flex-shrink-0 ${b.balance > 0.01 ? 'text-moss-600' : b.balance < -0.01 ? 'text-terra-600' : 'text-slate-400'}`}>
                    {b.balance > 0.01 ? <TrendingUp size={14} /> : b.balance < -0.01 ? <TrendingDown size={14} /> : <Minus size={14} />}
                    {fmt(Math.abs(b.balance))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settlements */}
          {equalizer.settlements.length > 0 && (
            <div className="card border-terra-100">
              <h3 className="font-semibold text-ink mb-3 font-serif">Settlements</h3>
              <div className="space-y-2">
                {equalizer.settlements.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-terra-700">{s.from}</span>
                    <ArrowRight size={14} className="text-slate-400" />
                    <span className="font-medium text-moss-700">{s.to}</span>
                    <span className="ml-auto font-semibold text-ink">{fmt(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {equalizer.settlements.length === 0 && equalizer.total > 0 && (
            <div className="card bg-moss-50 border-moss-200 text-center text-moss-700">
              <p className="font-medium">✓ All settled up!</p>
            </div>
          )}
        </div>
      )}

      {/* ── Receipts ── */}
      {!loading && tab === 'receipts' && (
        <div className="space-y-4">
          {/* Add receipt form */}
          <div className="card">
            <h3 className="font-semibold text-ink mb-4 font-serif">Add Receipt</h3>
            {rError && <p className="text-red-600 text-sm mb-3">{rError}</p>}
            <form onSubmit={submitReceipt} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Amount ($)</label>
                  <input type="number" step="0.01" min="0" className="input" placeholder="0.00"
                    value={rForm.amount} onChange={e => setRForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <input className="input" placeholder="e.g. Whole Foods run"
                    value={rForm.description} onChange={e => setRForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Receipt image (optional)</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 btn-ghost cursor-pointer text-sm">
                    <Upload size={15} />
                    {rForm.image ? rForm.image.name : 'Upload image'}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => setRForm(f => ({ ...f, image: e.target.files[0] || null }))} />
                  </label>
                  {rForm.image && <button type="button" onClick={() => setRForm(f => ({ ...f, image: null }))}><X size={14} className="text-slate-400" /></button>}
                </div>
              </div>
              <button type="submit" disabled={rLoading} className="btn-primary flex items-center gap-2">
                <Plus size={15} /> {rLoading ? 'Adding…' : 'Add Receipt'}
              </button>
            </form>
          </div>

          {/* Receipt list */}
          <div className="space-y-2">
            {receipts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No receipts yet</div>
            ) : receipts.map(r => (
              <div key={r.id} className="card flex items-center gap-3">
                {r.image_path ? (
                  <img src={r.image_path} alt="receipt" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-slate-200" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <DollarSign size={18} className="text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink text-sm">${Number(r.amount).toFixed(2)}</span>
                    <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{r.description || '—'}</p>
                  <p className="text-xs text-moss-600 font-medium">{r.user_name}</p>
                </div>
                {r.user_id === user?.id && (
                  <button onClick={() => deleteReceipt(r.id)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Meal Credits ── */}
      {!loading && tab === 'credits' && (
        <div className="space-y-4">
          {/* Balances */}
          {credits.balances.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-ink mb-3 font-serif">Credit Balances</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {credits.balances.map(b => (
                  <div key={b.user_id} className={`rounded-xl p-3 text-center ${b.total_credits >= 0 ? 'bg-moss-50' : 'bg-terra-50'}`}>
                    <p className="text-xs text-slate-500 mb-0.5">{b.name}</p>
                    <p className={`text-lg font-serif font-bold ${b.total_credits >= 0 ? 'text-moss-700' : 'text-terra-700'}`}>
                      {b.total_credits > 0 ? '+' : ''}{Number(b.total_credits).toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-400">meals</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add credit */}
          <div className="card">
            <h3 className="font-semibold text-ink mb-4 font-serif">Log Meal Credit</h3>
            <form onSubmit={submitCredit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Credits (+/-)</label>
                  <input type="number" step="0.5" className="input" placeholder="e.g. 1 or -1"
                    value={cForm.credits} onChange={e => setCForm(f => ({ ...f, credits: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Note</label>
                  <input className="input" placeholder="e.g. Banked a meal"
                    value={cForm.note} onChange={e => setCForm(f => ({ ...f, note: e.target.value }))} />
                </div>
              </div>
              <button type="submit" disabled={cLoading} className="btn-primary flex items-center gap-2">
                <Plus size={15} /> {cLoading ? '…' : 'Log Credit'}
              </button>
            </form>
          </div>

          {/* Transaction history */}
          <div className="space-y-2">
            {credits.transactions.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No transactions yet</div>
            ) : credits.transactions.map(t => (
              <div key={t.id} className="card flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${t.credits >= 0 ? 'bg-moss-100' : 'bg-terra-100'}`}>
                  {t.credits >= 0 ? <TrendingUp size={16} className="text-moss-600" /> : <TrendingDown size={16} className="text-terra-600" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">{t.user_name}</span>
                    <span className={`text-sm font-bold ${t.credits >= 0 ? 'text-moss-600' : 'text-terra-600'}`}>
                      {t.credits > 0 ? '+' : ''}{t.credits} meal{Math.abs(t.credits) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
                  <p className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Spending Charts ── */}
      {!loading && tab === 'charts' && (
        <div className="space-y-6">
          {!hasSpendData ? (
            <div className="card text-center py-16">
              <BarChart2 size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="font-medium text-slate-400">No spending data yet</p>
              <p className="text-sm text-slate-400 mt-1">Add some receipts and check back here</p>
            </div>
          ) : (
            <>
              {/* Monthly spend bar chart */}
              <div className="card">
                <h3 className="font-semibold text-ink mb-1 font-serif">Monthly Spend</h3>
                <p className="text-xs text-slate-400 mb-4">Last 6 months</p>
                <div style={{ height: '240px', position: 'relative' }}>
                  <canvas ref={barRef} />
                </div>
              </div>

              {/* Spend by member doughnut */}
              {stats.spendByMember.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-ink mb-1 font-serif">Spend by Member</h3>
                  <p className="text-xs text-slate-400 mb-4">All time, by total receipts logged</p>
                  <div style={{ height: '280px', position: 'relative' }}>
                    <canvas ref={doughnutRef} />
                  </div>
                  {/* Member totals legend */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {stats.spendByMember.map((m, i) => (
                      <div key={m.name} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND_COLORS[i % BRAND_COLORS.length] }} />
                        <span className="text-slate-600 truncate">{m.name}</span>
                        <span className="ml-auto font-semibold text-ink flex-shrink-0">${Number(m.total).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
