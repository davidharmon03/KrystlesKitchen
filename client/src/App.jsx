import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SyncProvider } from './contexts/SyncContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Kitchen from './pages/Kitchen'
import Corner from './pages/Corner'
import Cuisine from './pages/Cuisine'
import Garden from './pages/Garden'
import Labels from './pages/Labels'
import Equipment from './pages/Equipment'
import CreateGroup from './pages/CreateGroup'
import AcceptInvite from './pages/AcceptInvite'
import GroupCalendar from './pages/Calendar'
import Gallery from './pages/Gallery'
import Profile from './pages/Profile'
import MealSwap from './pages/MealSwap'
import Help from './pages/Help'
import Suggestions from './pages/Suggestions'
import Orders from './pages/Orders'
import Chat from './pages/Chat'
import Billing from './pages/Billing'
import Welcome from './pages/Welcome'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminGroups from './pages/admin/AdminGroups'
import TwoFactorModal from './components/TwoFactorModal'
import { useTwoFactor } from './hooks/useTwoFactor'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-moss-300 border-t-moss-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-moss-700 font-serif italic">Loading the cottage…</p>
      </div>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to={user.role === 'superadmin' ? '/admin' : '/'} replace /> : children
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  const twoFa = useTwoFactor()
  const [verified, setVerified] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user || user.role !== 'superadmin') { setChecking(false); return }
    // Check if there's already a valid 2FA session
    const token = twoFa.getToken('login')
    if (token) { setVerified(true); setChecking(false); return }
    // No valid session — stop the loading state so modal can show, then request 2FA
    setChecking(false)
    twoFa.request('login')
      .then(() => setVerified(true))
      .catch(() => {})
  }, [user])

  if (loading || checking) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'superadmin') return <Navigate to="/" replace />
  if (!verified && !twoFa.isOpen) return <Navigate to="/" replace />

  return (
    <>
      <TwoFactorModal
        isOpen={twoFa.isOpen}
        state={twoFa.state}
        error={twoFa.error}
        purpose="login"
        onSubmit={twoFa.submit}
        onCancel={() => { twoFa.cancel(); window.history.back() }}
      />
      {verified ? children : null}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"            element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register"         element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot-password"  element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/welcome"          element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
          <Route path="/reset-password"   element={<ResetPassword />} />
          <Route path="/accept-invite"    element={<AcceptInvite />} />
          {/* Admin routes */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index          element={<AdminDashboard />} />
            <Route path="users"   element={<AdminUsers />} />
            <Route path="groups"  element={<AdminGroups />} />
          </Route>

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index               element={<Dashboard />} />
            <Route path="kitchen"      element={<Kitchen />} />
            <Route path="corner"       element={<Corner />} />
            <Route path="cuisine"      element={<Cuisine />} />
            <Route path="garden"       element={<Garden />} />
            <Route path="equipment"    element={<Equipment />} />
            <Route path="labels"       element={<Labels />} />
            <Route path="calendar"     element={<GroupCalendar />} />
            <Route path="gallery"      element={<Gallery />} />
            <Route path="profile"      element={<Profile />} />
            <Route path="swap"         element={<MealSwap />} />
            <Route path="suggestions"  element={<Suggestions />} />
            <Route path="orders"       element={<Orders />} />
            <Route path="chat"         element={<Chat />} />
            <Route path="billing"      element={<Billing />} />
            <Route path="help"         element={<Help />} />
            <Route path="create-group" element={<CreateGroup />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </SyncProvider>
    </AuthProvider>
  )
}
