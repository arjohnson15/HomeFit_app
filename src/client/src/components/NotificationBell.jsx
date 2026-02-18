import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useNotificationSocket } from '../hooks/useNotificationSocket'

function NotificationBell() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushAvailable, setPushAvailable] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const dropdownRef = useRef(null)

  // Handle new real-time notifications
  const handleNewNotification = useCallback((notification) => {
    setNotifications(prev => [notification, ...prev.slice(0, 9)])
    setUnreadCount(prev => prev + 1)
  }, [])

  useNotificationSocket({ onNewNotification: handleNewNotification })

  useEffect(() => {
    fetchNotifications()
    checkPushStatus()
  }, [])

  const checkPushStatus = async () => {
    try {
      const statusResponse = await api.get('/notifications/status')
      setPushAvailable(statusResponse.data.push)

      if (statusResponse.data.push && 'Notification' in window && Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.getRegistration()
        const subscription = await registration?.pushManager?.getSubscription()
        setPushEnabled(!!subscription)
      }
    } catch (error) {
      console.error('Error checking push status:', error)
    }
  }

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

        const vapidResponse = await api.get('/notifications/vapid-public-key')
        if (!vapidResponse.data.available) {
          alert('Push notifications are not configured on the server')
          setPushLoading(false)
          return
        }

        const registration = await navigator.serviceWorker.register('/sw.js')

        // Add timeout to prevent infinite hanging if service worker fails to activate
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Service worker activation timeout')), 10000)
          )
        ])

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
      if (error.message?.includes('timeout')) {
        alert('Failed to enable push notifications. The service worker failed to activate. Try refreshing the page.')
      } else {
        alert('Failed to enable push notifications. Please try again.')
      }
    } finally {
      setPushLoading(false)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await api.get('/notifications?limit=10')
      setNotifications(response.data.notifications || [])
      setUnreadCount(response.data.unreadCount || 0)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification.id)
    }
    if (notification.data?.url) {
      navigate(notification.data.url)
    } else if (notification.data?.friendId) {
      navigate(`/friend/${notification.data.friendId}`)
    }
    setIsOpen(false)
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'FRIEND_WORKOUT_COMPLETED': return '💪'
      case 'FRIEND_ACHIEVEMENT_UNLOCKED': return '🏆'
      case 'FRIEND_STREAK_MILESTONE': return '🔥'
      case 'FRIEND_REQUEST': return '👋'
      case 'FRIEND_ACCEPTED': return '🤝'
      case 'WORKOUT_REMINDER': return '🏋️'
      case 'STREAK_ALERT': return '🔥'
      case 'ACHIEVEMENT_TEASE': return '⭐'
      case 'SOCIAL_MOTIVATION': return '👥'
      default: return '🔔'
    }
  }

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    const diff = Date.now() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-dark-elevated transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-accent text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-dark-card rounded-2xl shadow-xl border border-dark-border overflow-hidden z-50">
          <div className="flex items-center justify-between p-4 border-b border-dark-border">
            <h3 className="font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-accent text-sm hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-4xl mb-2">🔔</div>
                <p className="text-gray-500">No notifications yet</p>
                <p className="text-gray-600 text-sm mt-1">Reminders and friend activity will appear here</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full p-4 text-left hover:bg-dark-elevated transition-colors border-b border-dark-border last:border-b-0 ${
                    !notification.read ? 'bg-accent/5' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="text-xl flex-shrink-0">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${notification.read ? 'text-gray-400' : 'text-white font-medium'}`}>
                        {notification.title}
                      </p>
                      <p className="text-gray-500 text-xs mt-1 truncate">
                        {notification.body}
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-3 border-t border-dark-border space-y-3">
            {notifications.length > 0 && (
              <button
                onClick={() => {
                  navigate('/notifications')
                  setIsOpen(false)
                }}
                className="w-full py-2 text-center text-accent text-sm hover:underline"
              >
                View all notifications
              </button>
            )}

            {pushAvailable && (
              <button
                onClick={togglePushNotifications}
                disabled={pushLoading}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                  pushEnabled ? 'bg-accent/10' : 'bg-dark-elevated'
                } ${pushLoading ? 'opacity-50' : 'hover:bg-dark-border'}`}
              >
                <div className="flex items-center gap-3">
                  {pushLoading ? (
                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className={`w-5 h-5 ${pushEnabled ? 'text-accent' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  )}
                  <span className={`text-sm ${pushEnabled ? 'text-white' : 'text-gray-400'}`}>
                    Push notifications
                  </span>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${pushEnabled ? 'bg-accent' : 'bg-dark-border'} relative`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${pushEnabled ? 'left-5' : 'left-1'}`} />
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
