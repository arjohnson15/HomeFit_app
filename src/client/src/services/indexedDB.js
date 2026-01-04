// IndexedDB service for offline workout data storage
const DB_NAME = 'homefit-offline'
const DB_VERSION = 1

const STORES = {
  WORKOUTS: 'workouts',           // Cached workout plans
  EXERCISES: 'exercises',          // Cached exercise details
  ACTIVE_SESSION: 'activeSession', // Current workout session
  EXERCISE_LOGS: 'exerciseLogs',   // Exercise logs for active session
  PENDING_SYNC: 'pendingSync',     // Queue of changes to sync
  EXERCISE_HISTORY: 'exerciseHistory' // Cached exercise history
}

let dbInstance = null

// Initialize the database
export const initDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('IndexedDB error:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // Store for cached workout plans (today's workout)
      if (!db.objectStoreNames.contains(STORES.WORKOUTS)) {
        const workoutStore = db.createObjectStore(STORES.WORKOUTS, { keyPath: 'id' })
        workoutStore.createIndex('date', 'date', { unique: false })
      }

      // Store for cached exercise details
      if (!db.objectStoreNames.contains(STORES.EXERCISES)) {
        db.createObjectStore(STORES.EXERCISES, { keyPath: 'id' })
      }

      // Store for active workout session
      if (!db.objectStoreNames.contains(STORES.ACTIVE_SESSION)) {
        db.createObjectStore(STORES.ACTIVE_SESSION, { keyPath: 'id' })
      }

      // Store for exercise logs in current session
      if (!db.objectStoreNames.contains(STORES.EXERCISE_LOGS)) {
        const logsStore = db.createObjectStore(STORES.EXERCISE_LOGS, { keyPath: 'id' })
        logsStore.createIndex('sessionId', 'sessionId', { unique: false })
        logsStore.createIndex('exerciseId', 'exerciseId', { unique: false })
      }

      // Store for pending sync items (offline changes)
      if (!db.objectStoreNames.contains(STORES.PENDING_SYNC)) {
        const syncStore = db.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'id', autoIncrement: true })
        syncStore.createIndex('timestamp', 'timestamp', { unique: false })
        syncStore.createIndex('type', 'type', { unique: false })
        syncStore.createIndex('status', 'status', { unique: false })
      }

      // Store for exercise history (last 5 sessions per exercise)
      if (!db.objectStoreNames.contains(STORES.EXERCISE_HISTORY)) {
        const historyStore = db.createObjectStore(STORES.EXERCISE_HISTORY, { keyPath: 'exerciseId' })
      }
    }
  })
}

// Get database instance
const getDB = async () => {
  if (!dbInstance) {
    await initDB()
  }
  return dbInstance
}

// Generic CRUD operations
const dbOperation = async (storeName, mode, operation) => {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = operation(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ============ WORKOUT OPERATIONS ============

export const cacheWorkout = async (workout) => {
  return dbOperation(STORES.WORKOUTS, 'readwrite', (store) => {
    return store.put({
      ...workout,
      cachedAt: Date.now()
    })
  })
}

export const getCachedWorkout = async (id) => {
  return dbOperation(STORES.WORKOUTS, 'readonly', (store) => {
    return store.get(id)
  })
}

export const getTodaysCachedWorkout = async () => {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.WORKOUTS, 'readonly')
    const store = transaction.objectStore(STORES.WORKOUTS)
    const today = new Date().toISOString().split('T')[0]
    const index = store.index('date')
    const request = index.getAll(IDBKeyRange.only(today))

    request.onsuccess = () => resolve(request.result[0] || null)
    request.onerror = () => reject(request.error)
  })
}

export const clearOldWorkouts = async () => {
  const db = await getDB()
  const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000)

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.WORKOUTS, 'readwrite')
    const store = transaction.objectStore(STORES.WORKOUTS)
    const request = store.openCursor()

    request.onsuccess = (event) => {
      const cursor = event.target.result
      if (cursor) {
        if (cursor.value.cachedAt < threeDaysAgo) {
          cursor.delete()
        }
        cursor.continue()
      } else {
        resolve()
      }
    }
    request.onerror = () => reject(request.error)
  })
}

// ============ EXERCISE OPERATIONS ============

export const cacheExercise = async (exercise) => {
  return dbOperation(STORES.EXERCISES, 'readwrite', (store) => {
    return store.put({
      ...exercise,
      cachedAt: Date.now()
    })
  })
}

export const getCachedExercise = async (id) => {
  return dbOperation(STORES.EXERCISES, 'readonly', (store) => {
    return store.get(id)
  })
}

export const cacheExercises = async (exercises) => {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.EXERCISES, 'readwrite')
    const store = transaction.objectStore(STORES.EXERCISES)

    exercises.forEach(exercise => {
      store.put({
        ...exercise,
        cachedAt: Date.now()
      })
    })

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

// ============ ACTIVE SESSION OPERATIONS ============

export const saveActiveSession = async (session) => {
  return dbOperation(STORES.ACTIVE_SESSION, 'readwrite', (store) => {
    return store.put({
      ...session,
      updatedAt: Date.now()
    })
  })
}

export const getActiveSession = async () => {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ACTIVE_SESSION, 'readonly')
    const store = transaction.objectStore(STORES.ACTIVE_SESSION)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result[0] || null)
    request.onerror = () => reject(request.error)
  })
}

export const clearActiveSession = async () => {
  return dbOperation(STORES.ACTIVE_SESSION, 'readwrite', (store) => {
    return store.clear()
  })
}

// ============ EXERCISE LOGS OPERATIONS ============

export const saveExerciseLog = async (log) => {
  return dbOperation(STORES.EXERCISE_LOGS, 'readwrite', (store) => {
    return store.put({
      ...log,
      updatedAt: Date.now()
    })
  })
}

export const getExerciseLogs = async (sessionId) => {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.EXERCISE_LOGS, 'readonly')
    const store = transaction.objectStore(STORES.EXERCISE_LOGS)
    const index = store.index('sessionId')
    const request = index.getAll(IDBKeyRange.only(sessionId))

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const clearExerciseLogs = async (sessionId) => {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.EXERCISE_LOGS, 'readwrite')
    const store = transaction.objectStore(STORES.EXERCISE_LOGS)
    const index = store.index('sessionId')
    const request = index.openCursor(IDBKeyRange.only(sessionId))

    request.onsuccess = (event) => {
      const cursor = event.target.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      } else {
        resolve()
      }
    }
    request.onerror = () => reject(request.error)
  })
}

// ============ PENDING SYNC OPERATIONS ============

export const addPendingSync = async (item) => {
  return dbOperation(STORES.PENDING_SYNC, 'readwrite', (store) => {
    return store.add({
      ...item,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    })
  })
}

export const getPendingSyncItems = async () => {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING_SYNC, 'readonly')
    const store = transaction.objectStore(STORES.PENDING_SYNC)
    const index = store.index('status')
    const request = index.getAll(IDBKeyRange.only('pending'))

    request.onsuccess = () => {
      // Sort by timestamp (oldest first)
      const items = request.result.sort((a, b) => a.timestamp - b.timestamp)
      resolve(items)
    }
    request.onerror = () => reject(request.error)
  })
}

export const updatePendingSyncItem = async (id, updates) => {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING_SYNC, 'readwrite')
    const store = transaction.objectStore(STORES.PENDING_SYNC)
    const getRequest = store.get(id)

    getRequest.onsuccess = () => {
      const item = getRequest.result
      if (item) {
        const putRequest = store.put({ ...item, ...updates })
        putRequest.onsuccess = () => resolve(putRequest.result)
        putRequest.onerror = () => reject(putRequest.error)
      } else {
        reject(new Error('Item not found'))
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}

export const removePendingSyncItem = async (id) => {
  return dbOperation(STORES.PENDING_SYNC, 'readwrite', (store) => {
    return store.delete(id)
  })
}

export const getPendingSyncCount = async () => {
  const items = await getPendingSyncItems()
  return items.length
}

export const clearAllPendingSync = async () => {
  return dbOperation(STORES.PENDING_SYNC, 'readwrite', (store) => {
    return store.clear()
  })
}

// ============ EXERCISE HISTORY OPERATIONS ============

export const cacheExerciseHistory = async (exerciseId, history) => {
  return dbOperation(STORES.EXERCISE_HISTORY, 'readwrite', (store) => {
    return store.put({
      exerciseId,
      history,
      cachedAt: Date.now()
    })
  })
}

export const getCachedExerciseHistory = async (exerciseId) => {
  const result = await dbOperation(STORES.EXERCISE_HISTORY, 'readonly', (store) => {
    return store.get(exerciseId)
  })
  return result?.history || null
}

// ============ UTILITY FUNCTIONS ============

export const clearAllData = async () => {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const storeNames = Object.values(STORES)
    const transaction = db.transaction(storeNames, 'readwrite')

    storeNames.forEach(storeName => {
      transaction.objectStore(storeName).clear()
    })

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

// Export store names for external use
export { STORES }

export default {
  initDB,
  cacheWorkout,
  getCachedWorkout,
  getTodaysCachedWorkout,
  clearOldWorkouts,
  cacheExercise,
  getCachedExercise,
  cacheExercises,
  saveActiveSession,
  getActiveSession,
  clearActiveSession,
  saveExerciseLog,
  getExerciseLogs,
  clearExerciseLogs,
  addPendingSync,
  getPendingSyncItems,
  updatePendingSyncItem,
  removePendingSyncItem,
  getPendingSyncCount,
  clearAllPendingSync,
  cacheExerciseHistory,
  getCachedExerciseHistory,
  clearAllData,
  STORES
}
