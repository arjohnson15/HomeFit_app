// Hook for monitoring network status
import { useState, useEffect, useCallback } from 'react'
import { useOfflineStore } from '../services/offlineStore'

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [connectionQuality, setConnectionQuality] = useState('unknown') // 'good', 'slow', 'offline'
  const setStoreOnline = useOfflineStore(state => state.setOnline)

  // Check actual connectivity by pinging the server
  const checkConnectivity = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false)
      setStoreOnline(false)
      setConnectionQuality('offline')
      return false
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const start = Date.now()
      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store'
      })
      clearTimeout(timeoutId)

      const latency = Date.now() - start

      if (response.ok) {
        setIsOnline(true)
        setStoreOnline(true)
        setConnectionQuality(latency < 1000 ? 'good' : 'slow')
        return true
      }
    } catch (error) {
      // If we can't reach the server, we're effectively offline
      if (navigator.onLine) {
        // Browser thinks we're online but can't reach server
        setIsOnline(false)
        setStoreOnline(false)
        setConnectionQuality('offline')
      }
    }

    return false
  }, [setStoreOnline])

  useEffect(() => {
    const handleOnline = () => {
      // Browser says we're online, verify with server
      checkConnectivity()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setStoreOnline(false)
      setConnectionQuality('offline')
    }

    // Listen for browser events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Also monitor connection quality changes (if supported)
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (connection) {
      const handleConnectionChange = () => {
        if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
          setConnectionQuality('slow')
        } else if (connection.effectiveType === '4g' || connection.effectiveType === '3g') {
          setConnectionQuality('good')
        }
      }
      connection.addEventListener('change', handleConnectionChange)
    }

    // Initial check
    checkConnectivity()

    // Periodic connectivity check (every 30 seconds when online, every 10 when offline)
    const intervalId = setInterval(() => {
      checkConnectivity()
    }, isOnline ? 30000 : 10000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(intervalId)
    }
  }, [isOnline, checkConnectivity, setStoreOnline])

  return {
    isOnline,
    connectionQuality,
    checkConnectivity
  }
}

export default useNetworkStatus
