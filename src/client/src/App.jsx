import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './services/authStore'

// Layouts
import MainLayout from './components/layouts/MainLayout'
import AuthLayout from './components/layouts/AuthLayout'

// Pages
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import Today from './pages/Today'
import Catalog from './pages/Catalog'
import Schedule from './pages/Schedule'
import History from './pages/History'
import Social from './pages/Social'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Nutrition from './pages/Nutrition'
import Recipes from './pages/Recipes'
import MealPlans from './pages/MealPlans'
import FeatureSuggestion from './pages/FeatureSuggestion'
import BugReport from './pages/BugReport'
import Goals from './pages/Goals'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import FriendProfile from './pages/FriendProfile'
import Notifications from './pages/Notifications'

// Settings Sub-pages
import TimerSettings from './pages/settings/TimerSettings'
import UnitsSettings from './pages/settings/UnitsSettings'
import AISettings from './pages/settings/AISettings'
import NotificationSettings from './pages/settings/NotificationSettings'
import TrainingSettings from './pages/settings/TrainingSettings'
import PrivacySettings from './pages/settings/PrivacySettings'
import AppearanceSettings from './pages/settings/AppearanceSettings'
import AboutSettings from './pages/settings/AboutSettings'
import NutritionSettings from './pages/settings/NutritionSettings'
import WarmupCooldownSettings from './pages/settings/WarmupCooldownSettings'
import BackupSettings from './pages/settings/BackupSettings'

// Admin Pages
import UserManagement from './pages/admin/UserManagement'
import EmailSettings from './pages/admin/EmailSettings'
import UpdatesSettings from './pages/admin/UpdatesSettings'
import CustomizeSettings from './pages/admin/CustomizeSettings'
import AIAdminSettings from './pages/admin/AIAdminSettings'
import AdminNutritionSettings from './pages/admin/NutritionSettings'
import AchievementSettings from './pages/admin/AchievementSettings'
import FeedbackSettings from './pages/admin/FeedbackSettings'
import BackupManagement from './pages/admin/BackupManagement'
import Achievements from './pages/Achievements'

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasHydrated = useAuthStore((state) => state._hasHydrated)

  // Wait for auth state to be restored from localStorage
  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Admin Route wrapper
function AdminRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role?.toLowerCase() !== 'admin') {
    return <Navigate to="/today" replace />
  }

  return children
}

// Public Route wrapper (redirects to app if already logged in)
function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasHydrated = useAuthStore((state) => state._hasHydrated)

  // Wait for auth state to be restored from localStorage
  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/today" replace />
  }

  return children
}

function App() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)

  // Listen for auth:logout events from API interceptor
  useEffect(() => {
    const handleLogout = (event) => {
      console.log('Auth logout event received:', event.detail?.reason)
      logout()
      navigate('/login', { replace: true })
    }

    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [logout, navigate])

  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />
        <Route path="/signup" element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        } />
        <Route path="/forgot-password" element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        } />
        <Route path="/reset-password" element={
          <PublicRoute>
            <ResetPassword />
          </PublicRoute>
        } />
      </Route>

      {/* Protected App Routes */}
      <Route element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route path="/today" element={<Today />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/history" element={<History />} />
        <Route path="/social" element={<Social />} />
        <Route path="/friend/:friendId" element={<FriendProfile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/meal-plans" element={<MealPlans />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/feature-suggestion" element={<FeatureSuggestion />} />
        <Route path="/bug-report" element={<BugReport />} />

        {/* Settings Sub-pages */}
        <Route path="/settings/timer" element={<TimerSettings />} />
        <Route path="/settings/units" element={<UnitsSettings />} />
        <Route path="/settings/ai" element={<AISettings />} />
        <Route path="/settings/notifications" element={<NotificationSettings />} />
        <Route path="/settings/training" element={<TrainingSettings />} />
        <Route path="/settings/privacy" element={<PrivacySettings />} />
        <Route path="/settings/appearance" element={<AppearanceSettings />} />
        <Route path="/settings/about" element={<AboutSettings />} />
        <Route path="/settings/nutrition" element={<NutritionSettings />} />
        <Route path="/settings/warmup" element={<WarmupCooldownSettings />} />
        <Route path="/settings/backup" element={<BackupSettings />} />

        {/* Admin Routes */}
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/email" element={<EmailSettings />} />
        <Route path="/admin/updates" element={<UpdatesSettings />} />
        <Route path="/admin/customize" element={<CustomizeSettings />} />
        <Route path="/admin/ai" element={<AIAdminSettings />} />
        <Route path="/admin/nutrition" element={<AdminNutritionSettings />} />
        <Route path="/admin/achievements" element={<AchievementSettings />} />
        <Route path="/admin/feedback" element={<FeedbackSettings />} />
        <Route path="/admin/backup" element={<BackupManagement />} />
      </Route>

      {/* Public Legal Pages (accessible with or without auth) */}
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  )
}

export default App
