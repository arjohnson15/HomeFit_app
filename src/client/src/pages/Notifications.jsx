import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useNotificationSocket } from '../hooks/useNotificationSocket'

function Notifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState(null)
  const [filter, setFilter] = useState('all') // all, unread

  // Handle new real-time notifications
  const handleNewNotification = useCallback((notification) => {
    setNotifications(prev => [notification, ...prev])
  }, [])

  useNotificationSocket({ onNewNotification: handleNewNotification })

  const fetchNotifications = useCallback(async (reset = false) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: '20',
        ...(filter === 'unread' && { unreadOnly: 'true' }),
        ...(!reset && cursor && { cursor })
      })

      const response = await api.get(`/notifications?${params}`)

      if (reset) {
        setNotifications(response.data.notifications || [])
      } else {
        setNotifications(prev => [...prev, ...(response.data.notifications || [])])
      }
      setHasMore(response.data.hasMore || false)
      setCursor(response.data.nextCursor)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [cursor, filter])

  useEffect(() => {
    setCursor(null)
    fetchNotifications(true)
  }, [filter])

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
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

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'long' })
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-dark-elevated transition-colors">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-gray-500 text-sm">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-accent text-sm hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-dark-elevated rounded-xl p-1">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'unread' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Unread
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`bg-dark-card rounded-2xl p-4 flex gap-4 transition-all ${
              !notification.read ? 'border-l-4 border-accent' : 'border border-dark-border'
            }`}
          >
            <span className="text-2xl flex-shrink-0">{getNotificationIcon(notification.type)}</span>
            <div
              className="flex-1 cursor-pointer min-w-0"
              onClick={() => {
                if (!notification.read) {
                  markAsRead(notification.id)
                }
                if (notification.data?.url) {
                  navigate(notification.data.url)
                } else if (notification.data?.friendId) {
                  navigate(`/friend/${notification.data.friendId}`)
                }
              }}
            >
              <p className={`${notification.read ? 'text-gray-400' : 'text-white font-medium'}`}>
                {notification.title}
              </p>
              <p className="text-gray-500 text-sm mt-1">{notification.body}</p>
              <p className="text-gray-600 text-xs mt-2">
                {formatDate(notification.createdAt)}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                deleteNotification(notification.id)
              }}
              className="text-gray-600 hover:text-red-400 p-2 -m-2 transition-colors flex-shrink-0"
              aria-label="Delete notification"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}

        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🔔</div>
            <p className="text-gray-400 text-lg">No notifications</p>
            <p className="text-gray-600 text-sm mt-2">
              {filter === 'unread'
                ? "You're all caught up!"
                : "Reminders and friend activity will appear here"
              }
            </p>
          </div>
        )}

        {hasMore && !loading && (
          <button
            onClick={() => fetchNotifications()}
            className="w-full py-3 text-accent text-center hover:underline font-medium"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  )
}

export default Notifications
