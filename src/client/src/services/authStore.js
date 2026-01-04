import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from './api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      _hasHydrated: false,
      _isRefreshing: false,

      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },

      // Login action
      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/auth/login', { email, password })
          const { user, token, refreshToken } = response.data

          set({
            user,
            token,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null
          })

          // Set token in API headers
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`

          return { success: true }
        } catch (error) {
          const message = error.response?.data?.message || 'Login failed'
          set({ isLoading: false, error: message })
          return { success: false, error: message }
        }
      },

      // Signup action
      signup: async (userData) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/auth/signup', userData)
          const { user, token, refreshToken } = response.data

          set({
            user,
            token,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null
          })

          api.defaults.headers.common['Authorization'] = `Bearer ${token}`

          return { success: true }
        } catch (error) {
          const message = error.response?.data?.message || 'Signup failed'
          set({ isLoading: false, error: message })
          return { success: false, error: message }
        }
      },

      // Refresh access token using refresh token
      refreshAccessToken: async () => {
        const { refreshToken, _isRefreshing } = get()

        // Prevent multiple simultaneous refresh attempts
        if (_isRefreshing) return false
        if (!refreshToken) return false

        set({ _isRefreshing: true })

        try {
          const response = await api.post('/auth/refresh', { refreshToken })
          const { token, user } = response.data

          set({
            token,
            user,
            isAuthenticated: true,
            _isRefreshing: false
          })

          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          return true
        } catch (error) {
          // Refresh failed - clear auth state
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            _isRefreshing: false
          })
          delete api.defaults.headers.common['Authorization']
          return false
        }
      },

      // Logout action
      logout: async () => {
        const { refreshToken } = get()

        // Invalidate refresh token on server
        try {
          await api.post('/auth/logout', { refreshToken })
        } catch (error) {
          // Ignore errors - we're logging out anyway
        }

        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null
        })
        delete api.defaults.headers.common['Authorization']
      },

      // Update user profile
      updateProfile: async (updates) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.patch('/auth/profile', updates)
          set({
            user: response.data.user,
            isLoading: false
          })
          return { success: true }
        } catch (error) {
          const message = error.response?.data?.message || 'Update failed'
          set({ isLoading: false, error: message })
          return { success: false, error: message }
        }
      },

      // Request password reset
      forgotPassword: async (email) => {
        set({ isLoading: true, error: null })
        try {
          await api.post('/auth/forgot-password', { email })
          set({ isLoading: false })
          return { success: true }
        } catch (error) {
          const message = error.response?.data?.message || 'Request failed'
          set({ isLoading: false, error: message })
          return { success: false, error: message }
        }
      },

      // Reset password with token
      resetPassword: async (token, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/auth/reset-password', { token, password })
          set({ isLoading: false })
          return { success: true, message: response.data.message }
        } catch (error) {
          const message = error.response?.data?.message || 'Password reset failed'
          set({ isLoading: false, error: message })
          return { success: false, error: message }
        }
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Set user directly (for local updates)
      setUser: (user) => set({ user }),

      // Rehydrate auth on app load and refresh token if needed
      rehydrate: async () => {
        const { token, refreshToken, refreshAccessToken } = get()

        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        }

        // If we have a refresh token, try to get a fresh access token
        // This ensures the user stays logged in when they open the PWA
        if (refreshToken) {
          await refreshAccessToken()
        }
      }
    }),
    {
      name: 'homefit-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true)
          // Restore Authorization header
          if (state.token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`
          }
          // Auto-refresh token when app loads
          if (state.refreshToken) {
            state.refreshAccessToken()
          }
        }
      }
    }
  )
)
