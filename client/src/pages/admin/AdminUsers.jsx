import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../api'
import { useTwoFactor } from '../../hooks/useTwoFactor'
import { Search, ChevronDown, ChevronUp, Trash2, ShieldCheck, Pencil, Check, X } from 'lucide-react'

const roleBadge = (role) => {
  if (role === 'superadmin') return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 whitespace-nowrap">SUPERADMIN</span>
  if (role === 'admin')      return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-moss-100 text-moss-700">ADMIN</span>
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">MEMBER</span>
}

const planBadge = (plan) => plan === 'pro'
  ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-moss-100 text-moss-700">PRO</span>
  : <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">FREE</span>

export default function AdminUsers() {
  const [searchParams] = useSearchParams()
  const [users, setUsers]           = useState([])
  const [total, setTotal]           = useState(0)
  const [search, setSearch]         = useState('')
  const [plan, setPlan]             = useState(searchParams.get('plan') || 'all')
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState(null)
  const [detail, setDetail]         = useState({})
  const [editingRole, setEditingRole] = useState(null)   // userId being edited
  const [roleValue, setRoleValue]   = useState('')
  const [roleSaving, setRoleSaving] = useState(false)
  const { getToken } = useTwoFactor()
  const LIMIT = 50

  const twoFaHeaders = () => ({ 'x-2fa-token': getToken('login') || '' })

  const load = () => {
    setLoading(true)
    const params = { search, plan, page, limit: LIMIT }
    api.get('/admin/users', { params, headers: twoFaHeaders() })
      .then(r => { setUsers(r.data.users); setTotal(r.data.total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search, plan, page])

  const toggleExpand = async (userId) => {
    if (expanded === userId) { setExpanded(null); return }
    setExpanded(userId)
    if (!detail[userId]) {
      const r = await api.get(`/admin/users/${userId}`, { headers: twoFaHeaders() })
      setDetail(d => ({ ...d, [userId]: r.data }))
    }
  }

  const startEditRole = (userId, currentRole) => {
    setEditingRole(userId)
    setRoleValue(currentRole)
  }

  const cancelEditRole = () => {
    setEditingRole(null)
    setRoleValue('')
  }

  const saveRole = async (userId) => {
    setRoleSaving(true)
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: roleValue }, { headers: twoFaHeaders() })
      setUsers(u => u.map(x => x.id === userId ? { ...x, role: roleValue } : x))
      setEditingRole(null)
    } catch (err) {
      console.error(err)
    } finally {
      setRoleSaving(false)
    }
  }

  const changePlan = async (userId, newPlan) => {
    await api.put(`/admin/users/${userId}/plan`, { plan: newPlan }, { headers: twoFaHeaders() })
    setUsers(u => u.map(x => x.id === userId ? { ...x, plan: newPlan } : x))
    if (detail[userId]) {
      setDetail(d => ({ ...d, [userId]: { ...d[userId], user: { ...d[userId].user, plan: newPlan } } }))
    }
  }

  const deleteUser = async (userId, name) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    await api.delete(`/admin/users/${userId}`, { headers: twoFaHeaders() })
    setUsers(u => u.filter(x => x.id !== userId))
    setTotal(t => t - 1)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-serif font-semibold text-ink">
          Users{' '}
          <span className="text-slate-400 text-base font-sans font-normal">{total} total</span>
        </h1>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-moss-300"
            placeholder="Search name or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-moss-300 bg-white"
          value={plan}
          onChange={e => { setPlan(e.target.value); setPage(1) }}
        >
          <option value="all">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-slate-400">Loading...</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No users found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Group</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Group Role</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <>
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-ink">
                      {u.name}
                      {u.must_change_password ? (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-700">TEMP PW</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3">
                      {editingRole === u.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            className="text-xs border border-slate-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-moss-300 bg-white"
                            value={roleValue}
                            onChange={e => setRoleValue(e.target.value)}
                            autoFocus
                          >
                            <option value="member">member</option>
                            <option value="admin">admin</option>
                            <option value="superadmin">superadmin</option>
                          </select>
                          <button
                            onClick={() => saveRole(u.id)}
                            disabled={roleSaving}
                            className="p-1 text-moss-600 hover:text-moss-800 disabled:opacity-40"
                          >
                            <Check size={14} />
                          </button>
                          <button onClick={cancelEditRole} className="p-1 text-slate-400 hover:text-slate-600">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {roleBadge(u.role)}
                          <button
                            onClick={() => startEditRole(u.id, u.role)}
                            className="p-0.5 text-slate-300 hover:text-slate-500 transition-colors"
                            title="Edit role"
                          >
                            <Pencil size={11} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {u.group_name
                        ? <span className="text-moss-700 font-medium">{u.group_name}</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs capitalize">
                      {u.group_role ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleExpand(u.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {expanded === u.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expanded === u.id && (
                    <tr key={`${u.id}-detail`}>
                      <td colSpan={7} className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                        {!detail[u.id] ? (
                          <p className="text-xs text-slate-400">Loading...</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Actions */}
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Actions</p>
                              <div className="flex flex-wrap gap-2">
                                {u.plan === 'free' ? (
                                  <button
                                    onClick={() => changePlan(u.id, 'pro')}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-moss-600 text-white rounded-lg hover:bg-moss-700 transition-colors"
                                  >
                                    <ShieldCheck size={12} /> Upgrade to Pro
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => changePlan(u.id, 'free')}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                                  >
                                    Downgrade to Free
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteUser(u.id, u.name)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                  <Trash2 size={12} /> Delete Account
                                </button>
                              </div>
                            </div>

                            {/* Group members */}
                            {detail[u.id]?.members?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Group Members ({detail[u.id].members.length})</p>
                                <div className="space-y-1">
                                  {detail[u.id].members.map(m => (
                                    <div key={m.id} className="flex items-center gap-2 text-xs text-slate-600">
                                      <div className="w-5 h-5 rounded-full bg-terra-100 flex items-center justify-center flex-shrink-0">
                                        <span className="text-terra-600 font-semibold text-[9px]">{m.name[0]?.toUpperCase()}</span>
                                      </div>
                                      <span className="font-medium">{m.name}</span>
                                      <span className="text-slate-400">{m.email}</span>
                                      {planBadge(m.plan)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Member of other groups */}
                            {detail[u.id]?.memberOf?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Member of Group</p>
                                {detail[u.id].memberOf.map(g => (
                                  <p key={g.id} className="text-xs text-slate-600">
                                    <span className="font-medium">{g.name}</span> — owned by {g.owner_name}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Stripe info */}
                            {detail[u.id]?.user?.stripe_customer_id && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Stripe</p>
                                <p className="text-xs text-slate-400 font-mono">{detail[u.id].user.stripe_customer_id}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <p>Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">
              Previous
            </button>
            <button disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
