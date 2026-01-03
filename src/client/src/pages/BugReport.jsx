import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'

function BugReport() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    title: '',
    severity: '',
    page: '',
    description: '',
    steps: '',
    expected: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const severityLevels = [
    { value: 'low', label: 'Low - Minor issue, cosmetic', color: 'text-gray-400' },
    { value: 'medium', label: 'Medium - Annoying but workable', color: 'text-yellow-400' },
    { value: 'high', label: 'High - Significantly impacts usage', color: 'text-orange-400' },
    { value: 'critical', label: 'Critical - App is unusable', color: 'text-error' }
  ]

  const pages = [
    { value: 'today', label: 'Today' },
    { value: 'catalog', label: 'Exercise Catalog' },
    { value: 'schedule', label: 'Schedule' },
    { value: 'nutrition', label: 'Nutrition' },
    { value: 'history', label: 'History' },
    { value: 'social', label: 'Social' },
    { value: 'profile', label: 'Profile' },
    { value: 'settings', label: 'Settings' },
    { value: 'login', label: 'Login/Signup' },
    { value: 'other', label: 'Other' }
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      setError('Please enter a title for the bug')
      return
    }
    if (!formData.severity) {
      setError('Please select a severity level')
      return
    }
    if (!formData.description.trim()) {
      setError('Please describe the bug')
      return
    }

    setLoading(true)
    setError('')

    try {
      await api.post('/feedback/bug', {
        ...formData,
        userAgent: navigator.userAgent,
        url: window.location.href
      })
      setSuccess(true)
      setFormData({ title: '', severity: '', page: '', description: '', steps: '', expected: '' })
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit bug report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="p-4 space-y-6 pb-24">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 -ml-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-white">Bug Report</h1>
        </div>

        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Report Submitted!</h2>
          <p className="text-gray-400 mb-6">Thank you for helping us improve HomeFit. We'll look into this issue as soon as possible.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setSuccess(false)} className="btn-secondary">
              Report Another
            </button>
            <button onClick={() => navigate('/today')} className="btn-primary">
              Back to App
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-white">Bug Report</h1>
      </div>

      {/* Info Card */}
      <div className="card bg-error/10 border border-error/20">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-error flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="text-white font-medium mb-1">Found a bug?</h3>
            <p className="text-gray-400 text-sm">Help us squash it! Please provide as much detail as possible so we can reproduce and fix the issue.</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-error/20 border border-error/50 text-error px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="card space-y-4">
          {/* Title */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Bug Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Brief description of the issue"
              className="input w-full"
              maxLength={100}
            />
          </div>

          {/* Severity */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Severity *</label>
            <select
              name="severity"
              value={formData.severity}
              onChange={handleChange}
              className="input w-full"
            >
              <option value="">Select severity level</option>
              {severityLevels.map(level => (
                <option key={level.value} value={level.value}>{level.label}</option>
              ))}
            </select>
          </div>

          {/* Page */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Where did it happen?</label>
            <select
              name="page"
              value={formData.page}
              onChange={handleChange}
              className="input w-full"
            >
              <option value="">Select page (optional)</option>
              {pages.map(page => (
                <option key={page.value} value={page.value}>{page.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">What happened? *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe what went wrong..."
              className="input w-full min-h-[100px] resize-none"
              maxLength={1000}
            />
            <p className="text-gray-500 text-xs mt-1 text-right">{formData.description.length}/1000</p>
          </div>

          {/* Steps to Reproduce */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Steps to Reproduce (Optional)</label>
            <textarea
              name="steps"
              value={formData.steps}
              onChange={handleChange}
              placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
              className="input w-full min-h-[80px] resize-none"
              maxLength={500}
            />
          </div>

          {/* Expected Behavior */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">What should have happened? (Optional)</label>
            <textarea
              name="expected"
              value={formData.expected}
              onChange={handleChange}
              placeholder="Describe the expected behavior..."
              className="input w-full min-h-[60px] resize-none"
              maxLength={500}
            />
          </div>
        </div>

        <p className="text-gray-500 text-xs text-center">
          Device and browser info will be automatically included with your report.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Submitting...
            </span>
          ) : (
            'Submit Bug Report'
          )}
        </button>
      </form>
    </div>
  )
}

export default BugReport
