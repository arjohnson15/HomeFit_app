// HomeFit Service Worker with Offline Support
const CACHE_NAME = 'homefit-v15'
const API_CACHE_NAME = 'homefit-api-v1'
const IMAGE_CACHE_NAME = 'homefit-images-v1'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
]

// API endpoints to cache for offline use
const CACHEABLE_API_ROUTES = [
  '/api/schedules/today',
  '/api/exercises/',
  '/api/workouts/exercise/',
  '/api/workouts/stats/prs'
]

// IndexedDB constants (must match client-side)
const DB_NAME = 'homefit-offline'
const DB_VERSION = 1
const PENDING_SYNC_STORE = 'pendingSync'

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME && name !== IMAGE_CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Skip non-http(s) requests (like chrome-extension://)
  if (!event.request.url.startsWith('http')) return

  // Skip Vite dev server requests
  if (url.pathname.includes('/@vite') ||
      url.pathname.includes('/@react-refresh') ||
      url.pathname.includes('.jsx') ||
      url.pathname.includes('node_modules') ||
      url.href.includes('?t=') ||
      url.pathname.includes('__vite')) {
    return
  }

  // Handle API requests specially
  if (url.pathname.startsWith('/api/')) {
    // Only cache GET requests for specific endpoints
    if (event.request.method === 'GET' && shouldCacheApiRequest(url.pathname)) {
      event.respondWith(handleApiRequest(event.request))
    }
    // Non-GET or non-cacheable API requests go to network
    return
  }

  // Handle exercise images/GIFs (cache for offline viewing)
  if (isExerciseMedia(url)) {
    event.respondWith(handleMediaRequest(event.request))
    return
  }

  // Skip non-GET requests for other resources
  if (event.request.method !== 'GET') return

  // Handle other requests (static assets)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update cache in background
        event.waitUntil(
          fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse)
              })
            }
          }).catch(() => {})
        )
        return cachedResponse
      }

      // Not in cache - fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Cache successful responses
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone)
          })
        }
        return networkResponse
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/')
        }
      })
    })
  )
})

// Check if an API request should be cached
function shouldCacheApiRequest(pathname) {
  return CACHEABLE_API_ROUTES.some(route => pathname.startsWith(route))
}

// Check if a URL is exercise media (images/GIFs)
function isExerciseMedia(url) {
  const mediaExtensions = ['.gif', '.png', '.jpg', '.jpeg', '.webp', '.mp4']
  return mediaExtensions.some(ext => url.pathname.toLowerCase().includes(ext)) ||
         url.hostname.includes('exercisedb') ||
         url.hostname.includes('cloudinary')
}

// Handle API requests with network-first, cache-fallback strategy
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME)

  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      // Clone and cache the response
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      // Add header to indicate this is cached data
      const headers = new Headers(cachedResponse.headers)
      headers.set('X-From-Cache', 'true')

      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers
      })
    }

    // Return offline error response
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'You are offline and this data is not cached',
        offline: true
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Handle media requests with cache-first strategy
// Limit image cache to ~50MB to prevent storage issues on mobile
const MAX_IMAGE_CACHE_ITEMS = 100

async function handleMediaRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME)

  // Check cache first
  const cachedResponse = await cache.match(request)
  if (cachedResponse) {
    return cachedResponse
  }

  // Not in cache, fetch from network
  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      // Cache the response for offline use
      cache.put(request, networkResponse.clone())

      // Cleanup old images if cache is getting too large
      trimImageCache(cache)
    }

    return networkResponse
  } catch (error) {
    // Return a placeholder or error for failed media
    return new Response('', { status: 404 })
  }
}

// Keep image cache under limit by removing oldest entries
async function trimImageCache(cache) {
  const keys = await cache.keys()
  if (keys.length > MAX_IMAGE_CACHE_ITEMS) {
    // Remove oldest 20% of cached images
    const toDelete = keys.slice(0, Math.floor(keys.length * 0.2))
    await Promise.all(toDelete.map(key => cache.delete(key)))
  }
}

// Background sync for offline workout data
self.addEventListener('sync', (event) => {
  if (event.tag === 'workout-sync') {
    event.waitUntil(syncWorkouts())
  }
})

// Sync workouts from IndexedDB to server
async function syncWorkouts() {
  try {
    const db = await openIndexedDB()
    const pendingItems = await getPendingItems(db)

    if (pendingItems.length === 0) {
      return
    }

    console.log(`[SW] Syncing ${pendingItems.length} pending items`)

    // Notify the client to handle the sync
    // The client has the full sync logic with auth tokens
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_REQUIRED',
        count: pendingItems.length
      })
    })
  } catch (error) {
    console.error('[SW] Sync failed:', error)
  }
}

// Open IndexedDB in service worker
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

// Get pending sync items from IndexedDB
function getPendingItems(db) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(PENDING_SYNC_STORE, 'readonly')
      const store = transaction.objectStore(PENDING_SYNC_STORE)
      const index = store.index('status')
      const request = index.getAll(IDBKeyRange.only('pending'))

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    } catch (error) {
      // Store might not exist yet
      resolve([])
    }
  })
}

// Periodic sync (for browsers that support it)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'workout-sync-periodic') {
    event.waitUntil(syncWorkouts())
  }
})

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push event with no data')
    return
  }

  try {
    const data = event.data.json()

    const options = {
      body: data.body || 'Time for your workout!',
      icon: data.icon || '/logo.png',
      badge: data.badge || '/logo.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.data?.url || '/today',
        dateOfArrival: Date.now()
      },
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      tag: data.tag || 'homefit-notification',
      renotify: true
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'HomeFit', options)
    )
  } catch (error) {
    console.error('Error handling push notification:', error)
  }
})

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification.tag)
  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  // Get the URL to open
  const urlToOpen = event.notification.data?.url || '/today'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen)
          return client.focus()
        }
      }
      // Open a new window if none exists
      return clients.openWindow(urlToOpen)
    })
  )
})

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push subscription changed')
  // Handle subscription renewal if needed
})

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'CACHE_WORKOUT_DATA') {
    // Pre-cache workout data sent from client
    event.waitUntil(cacheWorkoutData(event.data.payload))
  }
})

// Cache workout data sent from client
async function cacheWorkoutData(data) {
  const cache = await caches.open(API_CACHE_NAME)

  // Cache the workout schedule
  if (data.schedule) {
    const scheduleResponse = new Response(JSON.stringify(data.schedule), {
      headers: { 'Content-Type': 'application/json' }
    })
    await cache.put('/api/schedules/today', scheduleResponse)
  }

  // Cache exercise details
  if (data.exercises) {
    for (const exercise of data.exercises) {
      const exerciseResponse = new Response(JSON.stringify(exercise), {
        headers: { 'Content-Type': 'application/json' }
      })
      await cache.put(`/api/exercises/${exercise.id}`, exerciseResponse)
    }
  }

  console.log('[SW] Workout data cached for offline use')
}
