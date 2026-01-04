import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../services/authStore'

function Signup() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    shareWorkouts: true
  })
  const [validationError, setValidationError] = useState('')
  const { signup, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormData({ ...formData, [e.target.name]: value })
    setValidationError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearError()

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setValidationError('Passwords do not match')
      return
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setValidationError('Password must be at least 8 characters')
      return
    }

    const result = await signup({
      name: formData.name,
      email: formData.email,
      username: formData.username,
      password: formData.password,
      shareWorkouts: formData.shareWorkouts
    })

    if (result.success) {
      navigate('/today')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">Create Account</h2>
        <p className="text-gray-400 mt-1">Start your fitness journey</p>
      </div>

      {(error || validationError) && (
        <div className="bg-error/20 border border-error/50 text-error px-4 py-3 rounded-xl text-sm">
          {error || validationError}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
            Full Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            className="input"
            placeholder="John Doe"
            required
            autoComplete="name"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            className="input"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={formData.username}
            onChange={handleChange}
            className="input"
            placeholder="johndoe"
            required
            autoComplete="username"
          />
          <p className="text-gray-500 text-xs mt-1">Letters, numbers, and underscores only</p>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            className="input"
            placeholder="At least 8 characters"
            required
            autoComplete="new-password"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            className="input"
            placeholder="Confirm your password"
            required
            autoComplete="new-password"
          />
        </div>
      </div>

      {/* Social Sharing Option */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="shareWorkouts"
            checked={formData.shareWorkouts}
            onChange={handleChange}
            className="mt-1 w-5 h-5 rounded border-dark-border bg-dark text-accent focus:ring-accent focus:ring-offset-0"
          />
          <div>
            <span className="text-white font-medium">Share my workouts with friends</span>
            <p className="text-gray-400 text-sm mt-1">
              Let your friends see your workout schedule and session stats. You can change this anytime in Settings.
            </p>
          </div>
        </label>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary w-full"
      >
        {isLoading ? 'Creating account...' : 'Create Account'}
      </button>

      <p className="text-center text-gray-400 text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-accent hover:text-accent-hover">
          Sign in
        </Link>
      </p>
    </form>
  )
}

export default Signup
