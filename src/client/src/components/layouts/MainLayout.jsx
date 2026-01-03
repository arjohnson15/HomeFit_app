import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useLocation, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../services/authStore'
import PrivacyOnboardingModal from '../PrivacyOnboardingModal'
import api from '../../services/api'

// Icons (using simple SVG for now - can replace with icon library)
const icons = {
  today: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  catalog: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  schedule: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  history: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  social: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  nutrition: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
}

const navItems = [
  { path: '/today', label: 'Today', icon: 'today' },
  { path: '/catalog', label: 'Catalog', icon: 'catalog' },
  { path: '/schedule', label: 'Schedule', icon: 'schedule' },
  { path: '/nutrition', label: 'Nutrition', icon: 'nutrition' },
  { path: '/history', label: 'History', icon: 'history' },
  { path: '/social', label: 'Social', icon: 'social' },
]

function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushAvailable, setPushAvailable] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const profileMenuRef = useRef(null)

  // Check if user needs onboarding (first login)
  useEffect(() => {
    const checkOnboarding = async () => {
      if (onboardingChecked) return
      try {
        const response = await api.get('/users/profile')
        const settings = response.data?.user?.settings
        if (settings && !settings.hasCompletedOnboarding) {
          setShowOnboarding(true)
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
      } finally {
        setOnboardingChecked(true)
      }
    }
    checkOnboarding()
  }, [onboardingChecked])

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close menu on route change
  useEffect(() => {
    setShowProfileMenu(false)
  }, [location.pathname])

  // Check push notification status on mount
  useEffect(() => {
    const checkPushStatus = async () => {
      try {
        // Check if push is available on server
        const statusResponse = await api.get('/notifications/status')
        setPushAvailable(statusResponse.data.push)

        if (statusResponse.data.push && 'Notification' in window && Notification.permission === 'granted') {
          // Check if we have an active subscription
          const registration = await navigator.serviceWorker.getRegistration()
          const subscription = await registration?.pushManager?.getSubscription()
          setPushEnabled(!!subscription)
        }
      } catch (error) {
        console.error('Error checking push status:', error)
      }
    }
    checkPushStatus()
  }, [])

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  const togglePushNotifications = async () => {
    if (pushLoading) return
    setPushLoading(true)

    try {
      if (pushEnabled) {
        // Unsubscribe
        const registration = await navigator.serviceWorker.getRegistration()
        const subscription = await registration?.pushManager?.getSubscription()
        if (subscription) {
          await subscription.unsubscribe()
          await api.delete('/notifications/unsubscribe', {
            data: { endpoint: subscription.endpoint }
          })
        }
        setPushEnabled(false)
      } else {
        // Request permission if needed
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') {
            setPushLoading(false)
            return
          }
        } else if (Notification.permission === 'denied') {
          alert('Push notifications are blocked. Please enable them in your browser settings.')
          setPushLoading(false)
          return
        }

        // Get VAPID key and subscribe
        const vapidResponse = await api.get('/notifications/vapid-public-key')
        if (!vapidResponse.data.available) {
          alert('Push notifications are not configured on the server')
          setPushLoading(false)
          return
        }

        const registration = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidResponse.data.publicKey)
        })

        const subJson = subscription.toJSON()
        await api.post('/notifications/subscribe', {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          userAgent: navigator.userAgent
        })

        setPushEnabled(true)
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error)
    } finally {
      setPushLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-dark-bg">
      {/* Privacy Onboarding Modal for first-time users */}
      {showOnboarding && (
        <PrivacyOnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}
      {/* Top Header with Profile */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-dark-bg/95 backdrop-blur-sm border-b border-dark-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="HomeFit" className="w-8 h-8" />
            <h1 className="text-lg font-semibold text-white">HomeFit</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Push Notification Toggle */}
            {pushAvailable && (
              <button
                onClick={togglePushNotifications}
                disabled={pushLoading}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  pushEnabled ? 'bg-accent/20 text-accent' : 'bg-dark-elevated text-gray-400 hover:bg-dark-border'
                } ${pushLoading ? 'opacity-50' : ''}`}
                title={pushEnabled ? 'Disable push notifications' : 'Enable push notifications'}
              >
                {pushLoading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : pushEnabled ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                )}
              </button>
            )}

            {/* Profile Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-9 h-9 rounded-full bg-dark-elevated flex items-center justify-center hover:bg-dark-border transition-colors overflow-hidden"
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-medium">{user?.name?.charAt(0) || 'U'}</span>
                )}
              </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-11 w-48 bg-dark-card border border-dark-border rounded-xl shadow-lg overflow-hidden z-50">
                <Link
                  to="/profile"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-dark-elevated transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-white">Profile</span>
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-dark-elevated transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-white">Settings</span>
                </Link>
                <div className="border-t border-dark-border">
                  <Link
                    to="/feature-suggestion"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-dark-elevated transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-white">Suggest Feature</span>
                  </Link>
                  <Link
                    to="/bug-report"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-dark-elevated transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-white">Report Bug</span>
                  </Link>
                </div>
                <div className="border-t border-dark-border">
                  <button
                    onClick={() => {
                      logout()
                      navigate('/login')
                    }}
                    className="flex items-center gap-3 px-4 py-3 w-full hover:bg-dark-elevated transition-colors text-error"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 pt-14 pb-20 overflow-y-auto">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Bottom Navigation - Mobile First */}
      <nav className="fixed bottom-0 left-0 right-0 bg-dark-card border-t border-dark-border">
        <div className="flex justify-around items-center px-2 pb-safe-bottom">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              {icons[item.icon]}
              <span className="text-xs mt-1">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default MainLayout
