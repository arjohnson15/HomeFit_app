// Sync manager for processing offline queue and syncing with server
import api from './api'
import { useOfflineStore, SYNC_TYPES } from './offlineStore'
import {
  getPendingSyncItems,
  removePendingSyncItem,
  updatePendingSyncItem,
  cacheWorkout,
  cacheExercises,
  cacheExerciseHistory
} from './indexedDB'

class SyncManager {
  constructor() {
    this.isSyncing = false
    this.syncInterval = null
    this.maxRetries = 3
  }

  // Start automatic sync (call on app mount)
  startAutoSync() {
    // Sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      const { isOnline } = useOfflineStore.getState()
      if (isOnline && !this.isSyncing) {
        this.syncPendingItems()
      }
    }, 30000)

    // Listen for online event to trigger immediate sync
    window.addEventListener('online', this.handleOnline)

    // Register for background sync if available
    this.registerBackgroundSync()
  }

  // Stop automatic sync (call on app unmount)
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
    window.removeEventListener('online', this.handleOnline)
  }

  handleOnline = () => {
    // Delay slightly to ensure connection is stable
    setTimeout(() => {
      this.syncPendingItems()
    }, 2000)
  }

  // Register for background sync API
  async registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in window.SyncManager) {
      try {
        const registration = await navigator.serviceWorker.ready
        await registration.sync.register('workout-sync')
      } catch (error) {
        console.log('Background sync registration failed:', error)
      }
    }
  }

  // Main sync function - processes all pending items in order
  async syncPendingItems() {
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress' }
    }

    const store = useOfflineStore.getState()
    if (!store.isOnline) {
      return { success: false, message: 'Offline' }
    }

    this.isSyncing = true
    store.setSyncing(true)
    store.setSyncError(null)

    try {
      const pendingItems = await getPendingSyncItems()

      if (pendingItems.length === 0) {
        return { success: true, message: 'Nothing to sync' }
      }

      console.log(`Syncing ${pendingItems.length} pending items...`)

      let successCount = 0
      let failCount = 0

      // Process items in order (important for dependencies)
      for (const item of pendingItems) {
        try {
          await this.processSyncItem(item)
          await removePendingSyncItem(item.id)
          successCount++
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error)
          failCount++

          // Update retry count
          const newRetryCount = (item.retryCount || 0) + 1
          if (newRetryCount >= this.maxRetries) {
            // Mark as permanently failed
            await updatePendingSyncItem(item.id, {
              status: 'failed',
              error: error.message,
              retryCount: newRetryCount
            })
          } else {
            await updatePendingSyncItem(item.id, {
              retryCount: newRetryCount,
              lastError: error.message
            })
          }

          // For critical errors (auth, etc.), stop syncing
          if (error.response?.status === 401 || error.response?.status === 403) {
            store.setSyncError('Authentication error. Please log in again.')
            break
          }
        }
      }

      await store.updatePendingSyncCount()
      store.updateLastSyncTime()

      return {
        success: failCount === 0,
        message: `Synced ${successCount} items, ${failCount} failed`
      }
    } catch (error) {
      console.error('Sync error:', error)
      store.setSyncError(error.message)
      return { success: false, message: error.message }
    } finally {
      this.isSyncing = false
      store.setSyncing(false)
    }
  }

  // Process a single sync item based on its type
  async processSyncItem(item) {
    const store = useOfflineStore.getState()

    switch (item.type) {
      case SYNC_TYPES.START_WORKOUT: {
        const response = await api.post('/workouts', item.data)
        // Map temp ID to real ID
        if (item.tempId) {
          store.mapTempId(item.tempId, response.data.id)
        }
        return response.data
      }

      case SYNC_TYPES.LOG_EXERCISE: {
        // Resolve session ID if it was a temp ID
        let sessionId = item.data.sessionId
        if (item.sessionTempId) {
          sessionId = store.getRealId(item.sessionTempId)
        }

        const response = await api.post(`/workouts/${sessionId}/exercises`, {
          exerciseId: item.data.exerciseId,
          exerciseName: item.data.exerciseName
        })

        // Map temp ID to real ID
        if (item.tempId) {
          store.mapTempId(item.tempId, response.data.id)
        }
        return response.data
      }

      case SYNC_TYPES.LOG_SET: {
        // Resolve IDs if they were temp IDs
        let sessionId = store.getRealId(item.data.sessionId)
        let exerciseLogId = store.getRealId(item.data.exerciseLogId)

        if (item.exerciseLogTempId) {
          exerciseLogId = store.getRealId(item.exerciseLogTempId)
        }

        const response = await api.post(
          `/workouts/${sessionId}/exercises/${exerciseLogId}/sets`,
          item.data.setData
        )

        if (item.tempId) {
          store.mapTempId(item.tempId, response.data.id)
        }
        return response.data
      }

      case SYNC_TYPES.PAUSE_WORKOUT:
      case SYNC_TYPES.RESUME_WORKOUT: {
        const sessionId = store.getRealId(item.data.sessionId)
        return await api.post(`/workouts/${sessionId}/pause`, {
          isPaused: item.data.isPaused,
          elapsedTime: item.data.elapsedTime
        })
      }

      case SYNC_TYPES.COMPLETE_WORKOUT: {
        const sessionId = store.getRealId(item.data.sessionId)
        return await api.patch(`/workouts/${sessionId}`, {
          endTime: item.data.endTime,
          notes: item.data.notes,
          rating: item.data.rating
        })
      }

      case SYNC_TYPES.CANCEL_WORKOUT: {
        const sessionId = store.getRealId(item.data.sessionId)
        return await api.delete(`/workouts/${sessionId}`)
      }

      default:
        console.warn(`Unknown sync type: ${item.type}`)
        return null
    }
  }

  // Cache today's workout data for offline use
  async cacheWorkoutData() {
    try {
      // Fetch and cache today's workout
      const scheduleResponse = await api.get('/schedules/today')
      if (scheduleResponse.data) {
        const workout = scheduleResponse.data
        const today = new Date().toISOString().split('T')[0]

        await cacheWorkout({
          ...workout,
          date: today
        })

        // Cache all exercises in the workout
        if (workout.exercises && workout.exercises.length > 0) {
          const exerciseDetails = []

          for (const exercise of workout.exercises) {
            try {
              const exerciseResponse = await api.get(`/exercises/${exercise.exerciseId}`)
              exerciseDetails.push(exerciseResponse.data)

              // Also cache exercise history
              const historyResponse = await api.get(
                `/workouts/exercise/${exercise.exerciseId}/history?limit=5`
              )
              if (historyResponse.data) {
                await cacheExerciseHistory(exercise.exerciseId, historyResponse.data)
              }
            } catch (error) {
              console.warn(`Failed to cache exercise ${exercise.exerciseId}:`, error)
            }
          }

          if (exerciseDetails.length > 0) {
            await cacheExercises(exerciseDetails)
          }
        }

        console.log('Workout data cached for offline use')
        return true
      }
    } catch (error) {
      console.error('Failed to cache workout data:', error)
      return false
    }
  }

  // Force sync now (for manual trigger)
  async forceSyncNow() {
    // First check if we're actually online
    const store = useOfflineStore.getState()

    try {
      await api.head('/health')
      store.setOnline(true)
      return await this.syncPendingItems()
    } catch (error) {
      store.setOnline(false)
      return { success: false, message: 'Cannot reach server' }
    }
  }
}

// Create singleton instance
const syncManager = new SyncManager()

export default syncManager
