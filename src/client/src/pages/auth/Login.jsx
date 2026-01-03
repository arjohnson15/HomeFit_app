import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../services/authStore'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearError()

    const result = await login(email, password)
    if (result.success) {
      navigate('/today')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
        <p className="text-gray-400 mt-1">Sign in to continue your training</p>
      </div>

      {error && (
        <div className="bg-error/20 border border-error/50 text-error px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="Enter your password"
            required
            autoComplete="current-password"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center">
          <input type="checkbox" className="rounded border-dark-border bg-dark-elevated text-accent" />
          <span className="ml-2 text-sm text-gray-400">Remember me</span>
        </label>
        <Link to="/forgot-password" className="text-sm text-accent hover:text-accent-hover">
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary w-full"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>

      <p className="text-center text-gray-400 text-sm">
        Don't have an account?{' '}
        <Link to="/signup" className="text-accent hover:text-accent-hover">
          Sign up
        </Link>
      </p>
    </form>
  )
}

export default Login
