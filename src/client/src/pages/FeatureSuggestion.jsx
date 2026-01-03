import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'

function FeatureSuggestion() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    useCase: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const categories = [
    { value: 'workout', label: 'Workout & Exercises' },
    { value: 'nutrition', label: 'Nutrition & Meals' },
    { value: 'social', label: 'Social Features' },
    { value: 'tracking', label: 'Progress Tracking' },
    { value: 'ui', label: 'User Interface' },
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
      setError('Please enter a title for your suggestion')
      return
    }
    if (!formData.category) {
      setError('Please select a category')
      return
    }
    if (!formData.description.trim()) {
      setError('Please describe your feature suggestion')
      return
    }

    setLoading(true)
    setError('')

    try {
      await api.post('/feedback/feature', formData)
      setSuccess(true)
      setFormData({ title: '', category: '', description: '', useCase: '' })
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit suggestion. Please try again.')
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
          <h1 className="text-2xl font-bold text-white">Feature Suggestion</h1>
        </div>

        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Thank You!</h2>
          <p className="text-gray-400 mb-6">Your feature suggestion has been submitted successfully. We appreciate your feedback!</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setSuccess(false)} className="btn-secondary">
              Submit Another
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
        <h1 className="text-2xl font-bold text-white">Feature Suggestion</h1>
      </div>

      {/* Info Card */}
      <div className="card bg-accent/10 border border-accent/20">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <div>
            <h3 className="text-white font-medium mb-1">Have an idea?</h3>
            <p className="text-gray-400 text-sm">We'd love to hear your suggestions for making HomeFit even better. Your feedback helps shape the future of the app!</p>
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
            <label className="block text-gray-400 text-sm mb-2">Feature Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Brief title for your suggestion"
              className="input w-full"
              maxLength={100}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Category *</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="input w-full"
            >
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the feature you'd like to see. What problem would it solve?"
              className="input w-full min-h-[120px] resize-none"
              maxLength={1000}
            />
            <p className="text-gray-500 text-xs mt-1 text-right">{formData.description.length}/1000</p>
          </div>

          {/* Use Case */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Use Case (Optional)</label>
            <textarea
              name="useCase"
              value={formData.useCase}
              onChange={handleChange}
              placeholder="How would you use this feature? Any specific scenarios?"
              className="input w-full min-h-[80px] resize-none"
              maxLength={500}
            />
          </div>
        </div>

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
            'Submit Suggestion'
          )}
        </button>
      </form>
    </div>
  )
}

export default FeatureSuggestion
