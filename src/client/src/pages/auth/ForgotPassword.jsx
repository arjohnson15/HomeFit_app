import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../services/authStore'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const { forgotPassword, isLoading, error, clearError } = useAuthStore()

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearError()

    const result = await forgotPassword(email)
    if (result.success) {
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-success/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Check Your Email</h2>
          <p className="text-gray-400 mt-2">
            We've sent a password reset link to <span className="text-white">{email}</span>
          </p>
        </div>
        <Link to="/login" className="btn-secondary inline-block">
          Back to Sign In
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">Reset Password</h2>
        <p className="text-gray-400 mt-1">Enter your email to receive a reset link</p>
      </div>

      {error && (
        <div className="bg-error/20 border border-error/50 text-error px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

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

      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary w-full"
      >
        {isLoading ? 'Sending...' : 'Send Reset Link'}
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

export default ForgotPassword
