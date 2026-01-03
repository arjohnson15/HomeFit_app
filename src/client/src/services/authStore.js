import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from './api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },

      // Login action
      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/auth/login', { email, password })
          const { user, token } = response.data

          set({
            user,
            token,
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
          const { user, token } = response.data

          set({
            user,
            token,
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

      // Logout action
      logout: () => {
        set({
          user: null,
          token: null,
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

      // Rehydrate auth on app load
      rehydrate: () => {
        const { token } = get()
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        }
      }
    }),
    {
      name: 'homefit-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true)
          // Restore Authorization header
          if (state.token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`
          }
        }
      }
    }
  )
)
