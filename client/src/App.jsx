import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SyncProvider } from './contexts/SyncContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Kitchen from './pages/Kitchen'
import Korner from './pages/Korner'
import Kuzine from './pages/Kuzine'
import Kultivate from './pages/Kultivate'
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

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-moss-300 border-t-moss-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-moss-700 font-serif italic">Loading the hub…</p>
      </div>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" replace /> : children
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
          <Route path="/reset-password"   element={<ResetPassword />} />
          <Route path="/accept-invite"    element={<AcceptInvite />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index               element={<Dashboard />} />
            <Route path="kitchen"      element={<Kitchen />} />
            <Route path="korner"       element={<Korner />} />
            <Route path="kuzine"       element={<Kuzine />} />
            <Route path="kultivate"    element={<Kultivate />} />
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
