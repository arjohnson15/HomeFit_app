import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function AIAdminSettings() {
  const [settings, setSettings] = useState({
    globalOpenaiApiKey: '',
    globalOpenaiEnabled: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await api.get('/admin/settings')
      const s = response.data.settings
      setSettings({
        globalOpenaiApiKey: s.globalOpenaiApiKey || '',
        globalOpenaiEnabled: s.globalOpenaiEnabled || false
      })
    } catch (error) {
      console.error('Error fetching AI settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.patch('/admin/settings', settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Save error:', err)
      setError(err.response?.data?.message || 'Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    if (!settings.globalOpenaiApiKey) {
      setTestResult({ success: false, message: 'Please enter an API key first' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${settings.globalOpenaiApiKey}`
        }
      })
      if (response.ok) {
        setTestResult({ success: true, message: 'API key is valid!' })
      } else {
        setTestResult({ success: false, message: 'Invalid API key' })
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Connection failed. Check your key.' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
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
        <h1 className="text-2xl font-bold text-white">AI Integration</h1>
        {saved && (
          <span className="text-success text-sm ml-auto flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
      </div>

      {/* Info Card */}
      <div className="card bg-accent/10 border border-accent/30">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-white font-medium">Global AI Access</p>
            <p className="text-gray-400 text-sm mt-1">
              Provide your OpenAI API key to enable AI features for all users. Users can still add their own key for privacy, which will override the global key.
            </p>
          </div>
        </div>
      </div>

      {/* Enable Global AI */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Enable Global AI for Users</p>
            <p className="text-gray-500 text-sm">Share your API key with all users</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, globalOpenaiEnabled: !settings.globalOpenaiEnabled })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.globalOpenaiEnabled ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.globalOpenaiEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* API Key Input */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">OpenAI API Key</h3>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={settings.globalOpenaiApiKey}
            onChange={(e) => setSettings({ ...settings, globalOpenaiApiKey: e.target.value })}
            placeholder="sk-..."
            className="input w-full pr-20"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-2"
          >
            {showKey ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        <div className="flex gap-3">
          <button
            onClick={testConnection}
            disabled={testing}
            className="btn-secondary flex-1"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost flex items-center gap-2"
          >
            Get Key
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
        {testResult && (
          <div className={`p-3 rounded-xl ${testResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {testResult.message}
          </div>
        )}
      </div>

      {/* Usage Info */}
      {settings.globalOpenaiEnabled && settings.globalOpenaiApiKey && (
        <div className="card bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-yellow-400 font-medium">Cost Warning</p>
              <p className="text-yellow-400/80 text-sm mt-1">
                All users will use your API key for AI features. Monitor your OpenAI usage to avoid unexpected charges.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={saveSettings}
        disabled={saving}
        className={`w-full py-3 rounded-xl font-medium transition-all ${
          saved
            ? 'bg-green-500 text-white'
            : 'bg-accent text-white hover:bg-accent/90'
        }`}
      >
        {saving ? 'Saving...' : saved ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        ) : 'Save Settings'}
      </button>
    </div>
  )
}

export default AIAdminSettings
