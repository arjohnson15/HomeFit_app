import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function FeedbackSettings() {
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ type: 'all', status: 'all' })
  const [selectedItem, setSelectedItem] = useState(null)
  const [settings, setSettings] = useState({
    feedbackEmailEnabled: false,
    feedbackEmail: '',
    feedbackPushEnabled: false
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => {
    fetchFeedback()
    fetchSettings()
  }, [filter])

  const fetchSettings = async () => {
    try {
      const response = await api.get('/admin/settings')
      const s = response.data.settings
      setSettings({
        feedbackEmailEnabled: s.feedbackEmailEnabled || false,
        feedbackEmail: s.feedbackEmail || '',
        feedbackPushEnabled: s.feedbackPushEnabled || false
      })
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const fetchFeedback = async () => {
    try {
      const params = new URLSearchParams()
      if (filter.type !== 'all') params.append('type', filter.type)
      if (filter.status !== 'all') params.append('status', filter.status)

      const response = await api.get(`/admin/feedback?${params}`)
      setFeedback(response.data)
    } catch (error) {
      console.error('Error fetching feedback:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      await api.patch('/admin/settings', settings)
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSavingSettings(false)
    }
  }

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/feedback/${id}`, { status })
      setFeedback(prev => prev.map(f => f.id === id ? { ...f, status } : f))
      if (selectedItem?.id === id) {
        setSelectedItem(prev => ({ ...prev, status }))
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const updateNotes = async (id, adminNotes) => {
    try {
      await api.patch(`/admin/feedback/${id}`, { adminNotes })
      setFeedback(prev => prev.map(f => f.id === id ? { ...f, adminNotes } : f))
    } catch (error) {
      console.error('Error updating notes:', error)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'NEW': return 'bg-blue-500/20 text-blue-400'
      case 'REVIEWED': return 'bg-yellow-500/20 text-yellow-400'
      case 'IN_PROGRESS': return 'bg-purple-500/20 text-purple-400'
      case 'RESOLVED': return 'bg-success/20 text-success'
      case 'WONT_FIX': return 'bg-gray-500/20 text-gray-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-error'
      case 'high': return 'text-orange-400'
      case 'medium': return 'text-yellow-400'
      case 'low': return 'text-gray-400'
      default: return 'text-gray-400'
    }
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/settings" className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">Feedback Management</h1>
      </div>

      {/* Notification Settings */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-medium">Notification Settings</h2>
          {settingsSaved && (
            <span className="text-success text-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
        </div>

        <div className="space-y-4">
          {/* Email Notifications */}
          <div className="flex items-start gap-3">
            <button
              onClick={() => setSettings(prev => ({ ...prev, feedbackEmailEnabled: !prev.feedbackEmailEnabled }))}
              className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                settings.feedbackEmailEnabled ? 'bg-accent' : 'bg-dark-border'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                settings.feedbackEmailEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
            <div className="flex-1">
              <p className="text-white">Email notifications for new feedback</p>
              <p className="text-gray-500 text-sm">Receive an email when users submit bug reports or feature suggestions</p>
              {settings.feedbackEmailEnabled && (
                <input
                  type="email"
                  value={settings.feedbackEmail}
                  onChange={(e) => setSettings(prev => ({ ...prev, feedbackEmail: e.target.value }))}
                  placeholder="admin@example.com"
                  className="input w-full mt-2"
                />
              )}
            </div>
          </div>

          {/* Push Notifications */}
          <div className="flex items-start gap-3">
            <button
              onClick={() => setSettings(prev => ({ ...prev, feedbackPushEnabled: !prev.feedbackPushEnabled }))}
              className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                settings.feedbackPushEnabled ? 'bg-accent' : 'bg-dark-border'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                settings.feedbackPushEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
            <div>
              <p className="text-white">Push notifications for new feedback</p>
              <p className="text-gray-500 text-sm">Receive push notifications on admin devices when feedback is submitted</p>
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="btn-primary"
          >
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={filter.type}
          onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
          className="input"
        >
          <option value="all">All Types</option>
          <option value="FEATURE">Feature Suggestions</option>
          <option value="BUG">Bug Reports</option>
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
          className="input"
        >
          <option value="all">All Status</option>
          <option value="NEW">New</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="WONT_FIX">Won't Fix</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-white">{feedback.filter(f => f.status === 'NEW').length}</p>
          <p className="text-gray-500 text-sm">New</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-white">{feedback.filter(f => f.type === 'BUG').length}</p>
          <p className="text-gray-500 text-sm">Bugs</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-white">{feedback.filter(f => f.type === 'FEATURE').length}</p>
          <p className="text-gray-500 text-sm">Features</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-white">{feedback.filter(f => f.status === 'RESOLVED').length}</p>
          <p className="text-gray-500 text-sm">Resolved</p>
        </div>
      </div>

      {/* Feedback List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : feedback.length === 0 ? (
        <div className="card text-center py-8">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-gray-400">No feedback found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
              className="card cursor-pointer hover:bg-dark-elevated transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Type Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.type === 'BUG' ? 'bg-error/20' : 'bg-accent/20'
                }`}>
                  {item.type === 'BUG' ? (
                    <svg className="w-4 h-4 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-white font-medium truncate">{item.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs flex-shrink-0 ${getStatusColor(item.status)}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm">
                    {item.type === 'BUG' && item.severity && (
                      <span className={`${getSeverityColor(item.severity)} capitalize`}>{item.severity}</span>
                    )}
                    {item.type === 'FEATURE' && item.category && (
                      <span className="text-gray-500 capitalize">{item.category}</span>
                    )}
                    <span className="text-gray-600">by {item.userName || 'Unknown'}</span>
                    <span className="text-gray-600">{formatDate(item.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedItem?.id === item.id && (
                <div className="mt-4 pt-4 border-t border-dark-border space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Description</p>
                    <p className="text-white whitespace-pre-wrap">{item.description}</p>
                  </div>

                  {item.type === 'FEATURE' && item.useCase && (
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Use Case</p>
                      <p className="text-white whitespace-pre-wrap">{item.useCase}</p>
                    </div>
                  )}

                  {item.type === 'BUG' && (
                    <>
                      {item.steps && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Steps to Reproduce</p>
                          <p className="text-white whitespace-pre-wrap">{item.steps}</p>
                        </div>
                      )}
                      {item.expected && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Expected Behavior</p>
                          <p className="text-white whitespace-pre-wrap">{item.expected}</p>
                        </div>
                      )}
                      {item.page && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Page</p>
                          <p className="text-white capitalize">{item.page}</p>
                        </div>
                      )}
                      {item.userAgent && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Browser/Device</p>
                          <p className="text-gray-500 text-sm break-all">{item.userAgent}</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Admin Notes */}
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Admin Notes</p>
                    <textarea
                      value={item.adminNotes || ''}
                      onChange={(e) => {
                        setFeedback(prev => prev.map(f => f.id === item.id ? { ...f, adminNotes: e.target.value } : f))
                        setSelectedItem(prev => ({ ...prev, adminNotes: e.target.value }))
                      }}
                      onBlur={(e) => updateNotes(item.id, e.target.value)}
                      placeholder="Add internal notes..."
                      className="input w-full min-h-[60px] resize-none"
                    />
                  </div>

                  {/* Status Actions */}
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Update Status</p>
                    <div className="flex flex-wrap gap-2">
                      {['NEW', 'REVIEWED', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX'].map((status) => (
                        <button
                          key={status}
                          onClick={() => updateStatus(item.id, status)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            item.status === status
                              ? getStatusColor(status)
                              : 'bg-dark-elevated text-gray-400 hover:bg-dark-border'
                          }`}
                        >
                          {status.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FeedbackSettings
