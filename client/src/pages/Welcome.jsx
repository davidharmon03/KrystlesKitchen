import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'
import { Users, Hash } from 'lucide-react'

export default function Welcome() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()

  const [joinCode, setJoinCode]       = useState('')
  const [joinError, setJoinError]     = useState('')
  const [joinLoading, setJoinLoading] = useState(false)

  const [groupName, setGroupName]         = useState('')
  const [createError, setCreateError]     = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  const handleJoin = async e => {
    e.preventDefault()
    setJoinError('')
    setJoinLoading(true)
    try {
      await api.post('/groups/join', { invite_code: joinCode.trim().toUpperCase() })
      await refreshUser()
      navigate('/')
    } catch (err) {
      setJoinError(err.response?.data?.error || 'Invalid invite code')
    } finally {
      setJoinLoading(false)
    }
  }

  const handleCreate = async e => {
    e.preventDefault()
    setCreateError('')
    setCreateLoading(true)
    try {
      await api.post('/groups', { name: groupName.trim() })
      await refreshUser()
      navigate('/')
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Could not create group')
    } finally {
      setCreateLoading(false)
    }
  }

  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <div className="min-h-screen bg-gradient-to-br from-moss-900 via-moss-700 to-moss-500 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center mx-auto mb-4 ring-2 ring-white ring-opacity-30">
            <span className="text-white font-serif font-bold text-3xl leading-none">K</span>
          </div>
          <h1 className="text-white font-serif text-3xl font-semibold">
            Welcome to Krystle's Cottage, {firstName}!
          </h1>
          <p className="text-moss-200 text-sm mt-2 max-w-sm mx-auto">
            The Cottage is organized around groups — join one with an invite code, or start your own. Groups unlock Kitchen, Corner, Cuisine, and Garden.
          </p>
        </div>

        {/* Two cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">

          {/* Join a Group */}
          <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-moss-100 flex items-center justify-center mb-4">
              <Hash size={20} className="text-moss-600" />
            </div>
            <h2 className="font-serif font-semibold text-ink text-lg mb-1">Join a Group</h2>
            <p className="text-sm text-slate-500 mb-4 flex-1">
              Have an invite code? Enter it below to jump straight in.
            </p>
            {joinError && (
              <p className="text-red-600 text-sm mb-3">{joinError}</p>
            )}
            <form onSubmit={handleJoin} className="space-y-3">
              <input
                className="input font-mono uppercase tracking-widest text-center text-base"
                required
                placeholder="KREW2024"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                maxLength={8}
              />
              <button
                type="submit"
                disabled={joinLoading}
                className="btn-primary w-full"
              >
                {joinLoading ? 'Joining…' : 'Join Group'}
              </button>
            </form>
          </div>

          {/* Create a Group */}
          <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-terra-100 flex items-center justify-center mb-4">
              <Users size={20} className="text-terra-600" />
            </div>
            <h2 className="font-serif font-semibold text-ink text-lg mb-1">Create a Group</h2>
            <p className="text-sm text-slate-500 mb-4 flex-1">
              Start a new group and invite up to 4 others once you're in.
            </p>
            {createError && (
              <p className="text-red-600 text-sm mb-3">{createError}</p>
            )}
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                className="input"
                required
                placeholder="The Harmon House"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                maxLength={60}
              />
              <button
                type="submit"
                disabled={createLoading}
                className="btn-terra w-full"
              >
                {createLoading ? 'Creating…' : 'Create Group'}
              </button>
            </form>
          </div>
        </div>

        {/* Skip */}
        <p className="text-center">
          <button
            onClick={() => navigate('/')}
            className="text-moss-200 hover:text-white text-sm underline underline-offset-2 transition-colors"
          >
            Skip for now
          </button>
        </p>

      </div>
    </div>
  )
}
