// Zustand store for offline state management
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  addPendingSync,
  getPendingSyncItems,
  removePendingSyncItem,
  updatePendingSyncItem,
  saveActiveSession,
  getActiveSession,
  saveExerciseLog,
  getExerciseLogs,
  clearActiveSession,
  clearExerciseLogs
} from './indexedDB'

// Sync item types
export const SYNC_TYPES = {
  START_WORKOUT: 'START_WORKOUT',
  LOG_EXERCISE: 'LOG_EXERCISE',
  LOG_SET: 'LOG_SET',
  PAUSE_WORKOUT: 'PAUSE_WORKOUT',
  RESUME_WORKOUT: 'RESUME_WORKOUT',
  COMPLETE_WORKOUT: 'COMPLETE_WORKOUT',
  CANCEL_WORKOUT: 'CANCEL_WORKOUT',
  UPDATE_SET: 'UPDATE_SET',
  DELETE_SET: 'DELETE_SET'
}

export const useOfflineStore = create(
  persist(
    (set, get) => ({
      // Network status
      isOnline: navigator.onLine,

      // Sync status
      isSyncing: false,
      lastSyncTime: null,
      syncError: null,
      pendingSyncCount: 0,

      // Offline session state (mirrors server session for offline use)
      offlineSession: null,
      offlineExerciseLogs: {},

      // Temporary IDs for offline-created items
      tempIdCounter: 0,
      tempIdMap: {}, // Maps temp IDs to server IDs after sync

      // Actions
      setOnline: (isOnline) => set({ isOnline }),

      setSyncing: (isSyncing) => set({ isSyncing }),

      setSyncError: (error) => set({ syncError: error }),

      updateLastSyncTime: () => set({ lastSyncTime: Date.now() }),

      // Generate a temporary ID for offline items
      generateTempId: () => {
        const counter = get().tempIdCounter + 1
        set({ tempIdCounter: counter })
        return `temp_${counter}_${Date.now()}`
      },

      // Map a temp ID to a real server ID
      mapTempId: (tempId, realId) => {
        set((state) => ({
          tempIdMap: { ...state.tempIdMap, [tempId]: realId }
        }))
      },

      // Get real ID (returns original if not a temp ID)
      getRealId: (id) => {
        const { tempIdMap } = get()
        return tempIdMap[id] || id
      },

      // Clear temp ID mappings (after successful full sync)
      clearTempIdMap: () => set({ tempIdMap: {} }),

      // ============ OFFLINE SESSION MANAGEMENT ============

      // Start a workout session offline
      startOfflineSession: async (sessionData) => {
        const tempId = get().generateTempId()
        const session = {
          ...sessionData,
          id: tempId,
          isOffline: true,
          startTime: new Date().toISOString(),
          createdAt: Date.now()
        }

        // Save to IndexedDB
        await saveActiveSession(session)

        // Add to sync queue
        await addPendingSync({
          type: SYNC_TYPES.START_WORKOUT,
          data: sessionData,
          tempId
        })

        set({
          offlineSession: session,
          offlineExerciseLogs: {}
        })

        await get().updatePendingSyncCount()

        return session
      },

      // Update offline session from server data
      setOfflineSession: async (session) => {
        if (session) {
          await saveActiveSession(session)
        } else {
          await clearActiveSession()
        }
        set({ offlineSession: session })
      },

      // Log an exercise offline
      logExerciseOffline: async (sessionId, exerciseData) => {
        const tempId = get().generateTempId()
        const log = {
          ...exerciseData,
          id: tempId,
          sessionId: get().getRealId(sessionId),
          isOffline: true,
          sets: [],
          createdAt: Date.now()
        }

        // Save to IndexedDB
        await saveExerciseLog(log)

        // Add to sync queue
        await addPendingSync({
          type: SYNC_TYPES.LOG_EXERCISE,
          data: { sessionId: get().getRealId(sessionId), ...exerciseData },
          tempId,
          sessionTempId: sessionId.startsWith('temp_') ? sessionId : null
        })

        // Update local state
        set((state) => ({
          offlineExerciseLogs: {
            ...state.offlineExerciseLogs,
            [exerciseData.exerciseId]: log
          }
        }))

        await get().updatePendingSyncCount()

        return log
      },

      // Log a set offline
      logSetOffline: async (sessionId, exerciseLogId, exerciseId, setData) => {
        const tempId = get().generateTempId()
        const set_entry = {
          ...setData,
          id: tempId,
          isOffline: true,
          completed: true,
          createdAt: Date.now()
        }

        // Update local exercise log
        set((state) => {
          const currentLog = state.offlineExerciseLogs[exerciseId] || {
            id: exerciseLogId || get().generateTempId(),
            exerciseId,
            sessionId: get().getRealId(sessionId),
            isOffline: true,
            sets: []
          }
          const updatedSets = [...(currentLog.sets || []), set_entry]
          return {
            offlineExerciseLogs: {
              ...state.offlineExerciseLogs,
              [exerciseId]: {
                ...currentLog,
                sets: updatedSets
              }
            }
          }
        })

        // Save to IndexedDB
        const updatedLog = get().offlineExerciseLogs[exerciseId]
        await saveExerciseLog(updatedLog)

        // Add to sync queue
        const logIdStr = exerciseLogId?.toString() || ''
        await addPendingSync({
          type: SYNC_TYPES.LOG_SET,
          data: {
            sessionId: get().getRealId(sessionId),
            exerciseLogId: get().getRealId(exerciseLogId),
            exerciseId,
            setData
          },
          tempId,
          exerciseLogTempId: logIdStr.startsWith('temp_') ? exerciseLogId : null
        })

        await get().updatePendingSyncCount()

        return set_entry
      },

      // Pause/resume workout offline
      togglePauseOffline: async (sessionId, isPaused, elapsedTime) => {
        const syncType = isPaused ? SYNC_TYPES.PAUSE_WORKOUT : SYNC_TYPES.RESUME_WORKOUT

        // Update local session
        set((state) => ({
          offlineSession: state.offlineSession ? {
            ...state.offlineSession,
            isPaused,
            pausedAt: isPaused ? new Date().toISOString() : null
          } : null
        }))

        // Save to IndexedDB
        const session = get().offlineSession
        if (session) {
          await saveActiveSession(session)
        }

        // Add to sync queue
        await addPendingSync({
          type: syncType,
          data: {
            sessionId: get().getRealId(sessionId),
            isPaused,
            elapsedTime,
            pausedAt: isPaused ? new Date().toISOString() : null
          }
        })

        await get().updatePendingSyncCount()
      },

      // Complete workout offline
      completeWorkoutOffline: async (sessionId, completionData) => {
        // Add to sync queue
        await addPendingSync({
          type: SYNC_TYPES.COMPLETE_WORKOUT,
          data: {
            sessionId: get().getRealId(sessionId),
            ...completionData
          }
        })

        // Clear local session
        await clearActiveSession()
        await clearExerciseLogs(sessionId)

        set({
          offlineSession: null,
          offlineExerciseLogs: {}
        })

        await get().updatePendingSyncCount()
      },

      // Cancel workout offline
      cancelWorkoutOffline: async (sessionId) => {
        // Add to sync queue
        await addPendingSync({
          type: SYNC_TYPES.CANCEL_WORKOUT,
          data: {
            sessionId: get().getRealId(sessionId)
          }
        })

        // Clear local session
        await clearActiveSession()
        await clearExerciseLogs(sessionId)

        set({
          offlineSession: null,
          offlineExerciseLogs: {}
        })

        await get().updatePendingSyncCount()
      },

      // ============ SYNC QUEUE MANAGEMENT ============

      // Update pending sync count
      updatePendingSyncCount: async () => {
        try {
          const items = await getPendingSyncItems()
          set({ pendingSyncCount: items.length })
        } catch (error) {
          console.error('Error getting pending sync count:', error)
        }
      },

      // Get all pending sync items
      getPendingItems: async () => {
        return await getPendingSyncItems()
      },

      // Remove a synced item from the queue
      removeSyncedItem: async (id) => {
        await removePendingSyncItem(id)
        await get().updatePendingSyncCount()
      },

      // Mark an item as failed
      markSyncItemFailed: async (id, error) => {
        await updatePendingSyncItem(id, {
          status: 'failed',
          error: error.message,
          retryCount: (await getPendingSyncItems()).find(i => i.id === id)?.retryCount + 1 || 1
        })
      },

      // Load offline state from IndexedDB on app start
      loadOfflineState: async () => {
        try {
          const session = await getActiveSession()
          if (session) {
            const logs = await getExerciseLogs(session.id)
            const logsMap = {}
            logs.forEach(log => {
              logsMap[log.exerciseId] = log
            })

            set({
              offlineSession: session,
              offlineExerciseLogs: logsMap
            })
          }

          await get().updatePendingSyncCount()
        } catch (error) {
          console.error('Error loading offline state:', error)
        }
      },

      // Clear all offline data (for logout)
      clearOfflineData: async () => {
        await clearActiveSession()
        set({
          offlineSession: null,
          offlineExerciseLogs: {},
          tempIdMap: {},
          tempIdCounter: 0,
          pendingSyncCount: 0
        })
      }
    }),
    {
      name: 'homefit-offline',
      partialize: (state) => ({
        tempIdCounter: state.tempIdCounter,
        tempIdMap: state.tempIdMap,
        lastSyncTime: state.lastSyncTime
      })
    }
  )
)

export default useOfflineStore
