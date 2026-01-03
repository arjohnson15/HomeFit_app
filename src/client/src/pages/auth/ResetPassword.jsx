import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../services/authStore'

function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [localError, setLocalError] = useState('')
  const { resetPassword, isLoading, error, clearError } = useAuthStore()

  useEffect(() => {
    clearError()
  }, [])

  if (!token) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-error/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Invalid Reset Link</h2>
          <p className="text-gray-400 mt-2">
            This password reset link is invalid or has expired.
          </p>
        </div>
        <Link to="/forgot-password" className="btn-primary inline-block">
          Request New Link
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')
    clearError()

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match')
      return
    }

    const result = await resetPassword(token, password)
    if (result.success) {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-success/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Password Reset!</h2>
          <p className="text-gray-400 mt-2">
            Your password has been successfully reset.
          </p>
        </div>
        <Link to="/login" className="btn-primary inline-block">
          Sign In
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">Create New Password</h2>
        <p className="text-gray-400 mt-1">Enter your new password below</p>
      </div>

      {(error || localError) && (
        <div className="bg-error/20 border border-error/50 text-error px-4 py-3 rounded-xl text-sm">
          {error || localError}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
            New Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="Enter new password"
            required
            autoComplete="new-password"
            minLength={6}
          />
          <p className="text-gray-500 text-xs mt-1">At least 6 characters</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
            placeholder="Confirm new password"
            required
            autoComplete="new-password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary w-full"
      >
        {isLoading ? 'Resetting...' : 'Reset Password'}
      </button>

      <p className="text-center text-gray-400 text-sm">
        Remember your password?{' '}
        <Link to="/login" className="text-accent hover:text-accent-hover">
          Sign in
        </Link>
      </p>
    </form>
  )
}

export default ResetPassword
