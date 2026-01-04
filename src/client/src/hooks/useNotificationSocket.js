import { useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useAuthStore } from '../services/authStore'

// Singleton socket for notifications (reuses existing connection if available)
let notificationSocket = null

export function useNotificationSocket({ onNewNotification } = {}) {
  const token = useAuthStore((state) => state.token)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const callbackRef = useRef(onNewNotification)

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onNewNotification
  }, [onNewNotification])

  useEffect(() => {
    if (!isAuthenticated || !token) return

    // Create socket if not exists
    if (!notificationSocket || !notificationSocket.connected) {
      const socketUrl = import.meta.env.VITE_API_URL || ''
      notificationSocket = io(socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      })

      notificationSocket.on('connect', () => {
        console.log('[NotificationSocket] Connected')
      })

      notificationSocket.on('disconnect', (reason) => {
        console.log('[NotificationSocket] Disconnected:', reason)
      })
    }

    // Listen for new notifications
    const handleNewNotification = (notification) => {
      console.log('[NotificationSocket] New notification:', notification)
      callbackRef.current?.(notification)
    }

    notificationSocket.on('notification:new', handleNewNotification)

    return () => {
      notificationSocket?.off('notification:new', handleNewNotification)
    }
  }, [isAuthenticated, token])

  const markAsRead = useCallback((notificationId) => {
    notificationSocket?.emit('notifications:mark-read', notificationId)
  }, [])

  return {
    isConnected: notificationSocket?.connected ?? false,
    markAsRead
  }
}

export default useNotificationSocket
