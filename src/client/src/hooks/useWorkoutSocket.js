import { useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useAuthStore } from '../services/authStore'

// Singleton socket instance with connection state tracking
let socketInstance = null
let connectionPromise = null
let connectionState = 'disconnected' // 'disconnected', 'connecting', 'connected'

// Get or create socket connection
const getSocket = (token) => {
  // Return existing connected socket
  if (socketInstance?.connected && connectionState === 'connected') {
    return Promise.resolve(socketInstance)
  }

  // Return pending connection promise if already connecting
  if (connectionState === 'connecting' && connectionPromise) {
    return connectionPromise
  }

  // Clean up stale socket if exists but not connected
  if (socketInstance && !socketInstance.connected) {
    socketInstance.removeAllListeners()
    socketInstance.disconnect()
    socketInstance = null
  }

  connectionState = 'connecting'

  connectionPromise = new Promise((resolve, reject) => {
    const socketUrl = import.meta.env.VITE_API_URL || ''

    socketInstance = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    })

    const timeoutId = setTimeout(() => {
      if (connectionState === 'connecting') {
        connectionState = 'disconnected'
        connectionPromise = null
        // Still resolve with socket - it may connect later via reconnection
        resolve(socketInstance)
      }
    }, 5000)

    socketInstance.on('connect', () => {
      clearTimeout(timeoutId)
      connectionState = 'connected'
      connectionPromise = null
      console.log('[Socket] Connected:', socketInstance.id)
      resolve(socketInstance)
    })

    socketInstance.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message)
      // Don't reset state here - let reconnection handle it
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
      connectionState = 'disconnected'
    })

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts')
      connectionState = 'connected'
    })
  })

  return connectionPromise
}

// Disconnect socket
export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
  connectionPromise = null
}

/**
 * Hook for real-time workout synchronization across browser tabs/devices
 */
export function useWorkoutSocket({
  onWorkoutStarted,
  onWorkoutPaused,
  onWorkoutEnded,
  onWorkoutCanceled,
  onRestTimerSync,
  onSetLogged,
  onTimerUpdate
} = {}) {
  const token = useAuthStore((state) => state.token)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const socketRef = useRef(null)
  const listenersRef = useRef([])

  // Initialize socket connection
  useEffect(() => {
    if (!isAuthenticated || !token) {
      return
    }

    let mounted = true

    const initSocket = async () => {
      const socket = await getSocket(token)
      if (!mounted) return
      socketRef.current = socket

      // Clear any existing listeners
      listenersRef.current.forEach(({ event, handler }) => {
        socket.off(event, handler)
      })
      listenersRef.current = []

      // Add event listeners
      const addListener = (event, handler) => {
        if (handler) {
          socket.on(event, handler)
          listenersRef.current.push({ event, handler })
        }
      }

      // Workout sync events from other tabs/devices
      addListener('workout:started', onWorkoutStarted)
      addListener('workout:paused', onWorkoutPaused)
      addListener('workout:ended', onWorkoutEnded)
      addListener('workout:canceled', onWorkoutCanceled)
      addListener('workout:rest-timer-sync', onRestTimerSync)
      addListener('workout:set-logged-sync', onSetLogged)
      addListener('workout:timer-update', onTimerUpdate)
    }

    initSocket()

    return () => {
      mounted = false
      // Clean up listeners on unmount
      if (socketRef.current) {
        listenersRef.current.forEach(({ event, handler }) => {
          socketRef.current.off(event, handler)
        })
        listenersRef.current = []
      }
    }
  }, [isAuthenticated, token, onWorkoutStarted, onWorkoutPaused, onWorkoutEnded, onWorkoutCanceled, onRestTimerSync, onSetLogged, onTimerUpdate])

  // Emit workout started
  const emitWorkoutStart = useCallback((sessionId, startTime, workoutName) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('workout:start', { sessionId, startTime, workoutName })
    }
  }, [])

  // Emit pause/resume
  const emitWorkoutPause = useCallback((sessionId, isPaused, elapsedTime, pausedAt) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('workout:pause', { sessionId, isPaused, elapsedTime, pausedAt })
    }
  }, [])

  // Emit workout end
  const emitWorkoutEnd = useCallback((sessionId, endTime) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('workout:end', { sessionId, endTime })
    }
  }, [])

  // Emit workout cancel
  const emitWorkoutCancel = useCallback((sessionId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('workout:cancel', { sessionId })
    }
  }, [])

  // Emit rest timer update
  const emitRestTimer = useCallback((sessionId, restTimer, restTimerRunning, showRestTimer) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('workout:rest-timer', { sessionId, restTimer, restTimerRunning, showRestTimer })
    }
  }, [])

  // Emit set logged
  const emitSetLogged = useCallback((sessionId, exerciseId, setData, exerciseLogs) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('workout:set-logged', { sessionId, exerciseId, setData, exerciseLogs })
    }
  }, [])

  // Emit timer sync (for periodic sync)
  const emitTimerSync = useCallback((sessionId, elapsedTime, isPaused) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('workout:timer-sync', { sessionId, elapsedTime, isPaused })
    }
  }, [])

  return {
    isConnected: socketRef.current?.connected ?? false,
    emitWorkoutStart,
    emitWorkoutPause,
    emitWorkoutEnd,
    emitWorkoutCancel,
    emitRestTimer,
    emitSetLogged,
    emitTimerSync
  }
}

export default useWorkoutSocket
