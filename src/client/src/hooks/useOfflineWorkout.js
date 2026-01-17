// Hook for offline-first workout functionality
import { useCallback, useEffect } from 'react'
import api from '../services/api'
import { useOfflineStore } from '../services/offlineStore'
import { useNetworkStatus } from './useNetworkStatus'
import syncManager from '../services/syncManager'
import {
  initDB,
  cacheWorkout,
  cacheExercises,
  cacheExerciseHistory,
  getTodaysCachedWorkout,
  getCachedExercise,
  getCachedExerciseHistory,
  clearOldWorkouts
} from '../services/indexedDB'

export const useOfflineWorkout = () => {
  const { isOnline } = useNetworkStatus()
  const {
    pendingSyncCount,
    isSyncing,
    offlineSession,
    offlineExerciseLogs,
    startOfflineSession,
    setOfflineSession,
    logExerciseOffline,
    logSetOffline,
    togglePauseOffline,
    completeWorkoutOffline,
    cancelWorkoutOffline,
    loadOfflineState,
    generateTempId,
    getRealId,
    mapTempId
  } = useOfflineStore()

  // Initialize IndexedDB and load offline state on mount
  useEffect(() => {
    const init = async () => {
      await initDB()
      await loadOfflineState()
      // Clean up old cached workouts (keeps only last 3 days)
      await clearOldWorkouts()
      syncManager.startAutoSync()
    }
    init()

    // Listen for sync messages from service worker
    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type === 'SYNC_REQUIRED') {
        syncManager.syncPendingItems()
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage)

    return () => {
      syncManager.stopAutoSync()
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage)
    }
  }, [loadOfflineState])

  // Cache today's workout data when online
  const cacheWorkoutData = useCallback(async (workout, exercises) => {
    if (!workout) return

    try {
      const today = new Date().toISOString().split('T')[0]
      await cacheWorkout({ ...workout, date: today })

      if (exercises && exercises.length > 0) {
        await cacheExercises(exercises)
      }

      // Also tell the service worker to cache this data
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CACHE_WORKOUT_DATA',
          payload: { schedule: workout, exercises }
        })
      }
    } catch (error) {
      console.error('Error caching workout data:', error)
    }
  }, [])

  // Cache exercise history for offline access
  const cacheHistory = useCallback(async (exerciseId, history) => {
    try {
      await cacheExerciseHistory(exerciseId, history)
    } catch (error) {
      console.error('Error caching exercise history:', error)
    }
  }, [])

  // Get cached workout if offline
  const getCachedWorkout = useCallback(async () => {
    try {
      return await getTodaysCachedWorkout()
    } catch (error) {
      console.error('Error getting cached workout:', error)
      return null
    }
  }, [])

  // Get cached exercise details
  const getCachedExerciseDetails = useCallback(async (exerciseId) => {
    try {
      return await getCachedExercise(exerciseId)
    } catch (error) {
      console.error('Error getting cached exercise:', error)
      return null
    }
  }, [])

  // Get cached exercise history
  const getCachedHistory = useCallback(async (exerciseId) => {
    try {
      return await getCachedExerciseHistory(exerciseId)
    } catch (error) {
      console.error('Error getting cached history:', error)
      return null
    }
  }, [])

  // Start workout - works online and offline
  const startWorkoutOfflineFirst = useCallback(async (workoutData) => {
    const { name, scheduledWorkoutId } = workoutData

    if (isOnline) {
      try {
        // Try online first
        await api.post('/workouts/cleanup-orphaned')
        const response = await api.post('/workouts', { name, scheduledWorkoutId })

        // Save to offline store for persistence
        await setOfflineSession(response.data.workout)

        return { success: true, workout: response.data.workout, offline: false }
      } catch (error) {
        console.error('Error starting workout online:', error)
        // Fall through to offline mode
      }
    }

    // Offline mode
    const session = await startOfflineSession({ name, scheduledWorkoutId })
    return { success: true, workout: session, offline: true }
  }, [isOnline, setOfflineSession, startOfflineSession])

  // Log exercise - creates exercise log entry
  const logExerciseOfflineFirst = useCallback(async (sessionId, exerciseId, exerciseName) => {
    const realSessionId = getRealId(sessionId)

    if (isOnline && sessionId && !sessionId.toString().startsWith('temp_')) {
      try {
        const response = await api.post(`/workouts/${realSessionId}/exercises`, {
          exerciseId,
          exerciseName
        })
        return { success: true, log: response.data, offline: false }
      } catch (error) {
        console.error('Error logging exercise online:', error)
        // Fall through to offline mode
      }
    }

    // Offline mode
    const log = await logExerciseOffline(sessionId, { exerciseId, exerciseName })
    return { success: true, log, offline: true }
  }, [isOnline, getRealId, logExerciseOffline])

  // Complete set - works online and offline
  const completeSetOfflineFirst = useCallback(async (sessionId, exerciseLogId, exerciseId, setData) => {
    const realSessionId = getRealId(sessionId)
    const realLogId = getRealId(exerciseLogId)

    if (isOnline && sessionId && exerciseLogId && !sessionId.toString().startsWith('temp_') && !exerciseLogId.toString().startsWith('temp_')) {
      try {
        const response = await api.post(
          `/workouts/${realSessionId}/exercises/${realLogId}/sets`,
          setData
        )
        return { success: true, set: response.data, offline: false, isPR: response.data.isPR }
      } catch (error) {
        console.error('Error completing set online:', error)
        // Fall through to offline mode
      }
    }

    // Offline mode - queue for later sync
    const set = await logSetOffline(sessionId, exerciseLogId, exerciseId, setData)
    return { success: true, set, offline: true, isPR: false }
  }, [isOnline, getRealId, logSetOffline])

  // Toggle pause - works online and offline
  const togglePauseOfflineFirst = useCallback(async (sessionId, isPaused, elapsedTime) => {
    const realSessionId = getRealId(sessionId)

    if (isOnline && sessionId && !sessionId.toString().startsWith('temp_')) {
      try {
        const response = await api.post(`/workouts/${realSessionId}/pause`)
        return { success: true, workout: response.data, offline: false }
      } catch (error) {
        console.error('Error toggling pause online:', error)
        // Fall through to offline mode
      }
    }

    // Offline mode
    await togglePauseOffline(sessionId, isPaused, elapsedTime)
    return { success: true, offline: true, isPaused }
  }, [isOnline, getRealId, togglePauseOffline])

  // End workout - works online and offline
  const endWorkoutOfflineFirst = useCallback(async (sessionId, completionData) => {
    const realSessionId = getRealId(sessionId)

    if (isOnline && sessionId && !sessionId.toString().startsWith('temp_')) {
      try {
        await api.patch(`/workouts/${realSessionId}`, completionData)
        await setOfflineSession(null)
        return { success: true, offline: false }
      } catch (error) {
        console.error('Error ending workout online:', error)
        // Fall through to offline mode
      }
    }

    // Offline mode
    await completeWorkoutOffline(sessionId, completionData)
    return { success: true, offline: true }
  }, [isOnline, getRealId, setOfflineSession, completeWorkoutOffline])

  // Cancel workout - works online and offline
  const cancelWorkoutOfflineFirst = useCallback(async (sessionId) => {
    const realSessionId = getRealId(sessionId)

    if (isOnline && sessionId && !sessionId.toString().startsWith('temp_')) {
      try {
        await api.post('/workouts/cleanup-orphaned')
        await setOfflineSession(null)
        return { success: true, offline: false }
      } catch (error) {
        console.error('Error canceling workout online:', error)
        try {
          await api.delete(`/workouts/${realSessionId}`)
          await setOfflineSession(null)
          return { success: true, offline: false }
        } catch (deleteError) {
          if (deleteError.response?.status !== 404) {
            console.error('Error deleting workout:', deleteError)
          }
        }
      }
    }

    // Offline mode
    await cancelWorkoutOffline(sessionId)
    return { success: true, offline: true }
  }, [isOnline, getRealId, setOfflineSession, cancelWorkoutOffline])

  // Force sync now
  const syncNow = useCallback(async () => {
    return await syncManager.forceSyncNow()
  }, [])

  return {
    // State
    isOnline,
    pendingSyncCount,
    isSyncing,
    offlineSession,
    offlineExerciseLogs,

    // Caching functions
    cacheWorkoutData,
    cacheHistory,
    getCachedWorkout,
    getCachedExerciseDetails,
    getCachedHistory,

    // Offline-first workout functions
    startWorkout: startWorkoutOfflineFirst,
    logExercise: logExerciseOfflineFirst,
    completeSet: completeSetOfflineFirst,
    togglePause: togglePauseOfflineFirst,
    endWorkout: endWorkoutOfflineFirst,
    cancelWorkout: cancelWorkoutOfflineFirst,

    // Sync functions
    syncNow,

    // Utility
    generateTempId,
    getRealId,
    mapTempId
  }
}

export default useOfflineWorkout
