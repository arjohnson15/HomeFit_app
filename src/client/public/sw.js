// HomeFit Service Worker
const CACHE_NAME = 'homefit-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
]

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
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  // Skip non-http(s) requests (like chrome-extension://)
  if (!event.request.url.startsWith('http')) return

  // Skip API requests - always go to network
  if (event.request.url.includes('/api/')) {
    return
  }

  // Skip Vite dev server requests
  if (event.request.url.includes('/@vite') ||
      event.request.url.includes('/@react-refresh') ||
      event.request.url.includes('.jsx') ||
      event.request.url.includes('node_modules') ||
      event.request.url.includes('?t=') ||
      event.request.url.includes('__vite')) {
    return
  }

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

// Background sync for offline workout data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-workouts') {
    event.waitUntil(syncWorkouts())
  }
})

async function syncWorkouts() {
  // Get pending workouts from IndexedDB and sync them
  // Implementation would go here
}

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
