// Sync status indicator component for offline support
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOfflineStore } from '../services/offlineStore'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { clearAllPendingSync } from '../services/indexedDB'
import syncManager from '../services/syncManager'

export const SyncStatus = ({ className = '' }) => {
  const { isOnline, connectionQuality } = useNetworkStatus()
  const {
    isSyncing,
    pendingSyncCount,
    lastSyncTime,
    syncError
  } = useOfflineStore()

  const [showDetails, setShowDetails] = useState(false)
  const [manualSyncLoading, setManualSyncLoading] = useState(false)

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never'
    const diff = Date.now() - lastSyncTime
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(lastSyncTime).toLocaleDateString()
  }

  // Manual sync trigger
  const handleManualSync = async () => {
    setManualSyncLoading(true)
    try {
      await syncManager.forceSyncNow()
    } finally {
      setManualSyncLoading(false)
    }
  }

  // Clear stuck/failed pending items
  const handleClearPending = async () => {
    await clearAllPendingSync()
    useOfflineStore.getState().updatePendingSyncCount()
    setShowDetails(false)
  }

  // Don't show anything if online and no pending changes
  if (isOnline && pendingSyncCount === 0 && !isSyncing && !syncError) {
    return null
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main status pill */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
          transition-all duration-200
          ${!isOnline
            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            : isSyncing
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : pendingSyncCount > 0
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : syncError
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-green-500/20 text-green-400 border border-green-500/30'
          }
        `}
      >
        {/* Status icon */}
        {!isOnline ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
        ) : isSyncing ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : pendingSyncCount > 0 ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : syncError ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5 13l4 4L19 7" />
          </svg>
        )}

        {/* Status text */}
        <span>
          {!isOnline
            ? 'Offline'
            : isSyncing
              ? 'Syncing...'
              : pendingSyncCount > 0
                ? `${pendingSyncCount} pending`
                : syncError
                  ? 'Sync error'
                  : 'Synced'
          }
        </span>

        {/* Dropdown indicator */}
        <svg
          className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Details dropdown */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {/* Connection status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Connection</span>
                <span className={`text-sm font-medium ${
                  !isOnline ? 'text-yellow-400' :
                  connectionQuality === 'slow' ? 'text-orange-400' :
                  'text-green-400'
                }`}>
                  {!isOnline ? 'Offline' :
                   connectionQuality === 'slow' ? 'Slow' :
                   'Good'}
                </span>
              </div>

              {/* Pending changes */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Pending changes</span>
                <span className="text-sm font-medium text-white">{pendingSyncCount}</span>
              </div>

              {/* Last sync */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Last sync</span>
                <span className="text-sm font-medium text-white">{formatLastSync()}</span>
              </div>

              {/* Error message */}
              {syncError && (
                <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
                  {syncError}
                </div>
              )}

              {/* Offline mode info */}
              {!isOnline && (
                <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm text-yellow-400">
                  Your workout is being saved locally. It will sync when you're back online.
                </div>
              )}

              {/* Manual sync / clear buttons */}
              {isOnline && pendingSyncCount > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing || manualSyncLoading}
                    className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50
                             text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {isSyncing || manualSyncLoading ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button
                    onClick={handleClearPending}
                    className="py-2 px-3 bg-zinc-700 hover:bg-zinc-600
                             text-zinc-300 text-sm font-medium rounded-lg transition-colors"
                    title="Clear stuck items"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Compact inline indicator for use in workout logging UI
export const SyncIndicator = ({ className = '' }) => {
  const { isOnline } = useNetworkStatus()
  const { isSyncing, pendingSyncCount } = useOfflineStore()

  if (isOnline && pendingSyncCount === 0 && !isSyncing) {
    return null
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {!isOnline ? (
        <>
          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          <span className="text-xs text-yellow-500">Offline</span>
        </>
      ) : isSyncing ? (
        <>
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-xs text-blue-500">Syncing</span>
        </>
      ) : pendingSyncCount > 0 ? (
        <>
          <span className="w-2 h-2 bg-orange-500 rounded-full" />
          <span className="text-xs text-orange-500">{pendingSyncCount} pending</span>
        </>
      ) : null}
    </span>
  )
}

// Toast notification for sync events
export const useSyncNotifications = () => {
  const { isOnline } = useNetworkStatus()
  const { pendingSyncCount } = useOfflineStore()
  const [wasOffline, setWasOffline] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
    } else if (wasOffline && isOnline) {
      // Just came back online
      setWasOffline(false)
      if (pendingSyncCount > 0) {
        setToastMessage(`Back online! Syncing ${pendingSyncCount} changes...`)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      }
    }
  }, [isOnline, wasOffline, pendingSyncCount])

  return { showToast, toastMessage }
}

export default SyncStatus
