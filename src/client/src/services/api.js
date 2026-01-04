import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Track if we're currently refreshing to prevent multiple refresh attempts
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Token is set in authStore when logging in
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor with automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't try to refresh if this was already the refresh request
      if (originalRequest.url === '/auth/refresh') {
        // Refresh failed - clear auth and dispatch event for app to handle
        try {
          localStorage.removeItem('homefit-auth')
        } catch (e) {
          console.error('Failed to clear localStorage:', e)
        }
        // Dispatch event instead of hard redirect so app can handle gracefully
        window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'refresh_failed' } }))
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`
          return api(originalRequest)
        }).catch(err => {
          return Promise.reject(err)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      // Get refresh token from localStorage
      try {
        let authData
        try {
          authData = JSON.parse(localStorage.getItem('homefit-auth') || '{}')
        } catch (parseError) {
          console.error('Failed to parse auth data:', parseError)
          throw new Error('Invalid auth data')
        }

        const refreshToken = authData.state?.refreshToken

        if (!refreshToken) {
          throw new Error('No refresh token')
        }

        const response = await api.post('/auth/refresh', { refreshToken })
        const { token, user } = response.data

        // Update stored auth state
        authData.state.token = token
        authData.state.user = user
        authData.state.isAuthenticated = true

        try {
          localStorage.setItem('homefit-auth', JSON.stringify(authData))
        } catch (storageError) {
          console.error('Failed to save auth data:', storageError)
        }

        // Update default header
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`

        // Process queued requests
        processQueue(null, token)

        // Retry original request
        originalRequest.headers['Authorization'] = `Bearer ${token}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        // Refresh failed - clear auth and dispatch event for app to handle
        try {
          localStorage.removeItem('homefit-auth')
        } catch (e) {
          console.error('Failed to clear localStorage:', e)
        }
        window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'refresh_failed' } }))
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // Handle network errors
    if (!error.response) {
      error.message = 'Network error. Please check your connection.'
    }

    return Promise.reject(error)
  }
)

export default api
