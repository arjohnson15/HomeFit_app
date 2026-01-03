import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

function NutritionSettings() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState({
    fatSecretClientId: '',
    fatSecretClientSecret: '',
    fatSecretTier: 'basic'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await api.get('/admin/settings')
      setSettings({
        fatSecretClientId: response.data.settings.fatSecretClientId || '',
        fatSecretClientSecret: response.data.settings.fatSecretClientSecret || '',
        fatSecretTier: response.data.settings.fatSecretTier || 'basic'
      })
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      await api.patch('/admin/settings', {
        fatSecretClientId: settings.fatSecretClientId || null,
        fatSecretClientSecret: settings.fatSecretClientSecret || null,
        fatSecretTier: settings.fatSecretTier
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Save error:', error)
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setMessage(null)
    try {
      const response = await api.get('/nutrition/search/foods', {
        params: { q: 'chicken breast', limit: 1 }
      })
      if (response.data.foods?.length > 0) {
        setMessage({ type: 'success', text: 'FatSecret API connection successful!' })
      } else {
        setMessage({ type: 'warning', text: 'Connected but no results returned' })
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to connect to FatSecret API. Check your credentials.'
      setMessage({ type: 'error', text: errorMessage })
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/settings')} className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Nutrition API</h1>
          <p className="text-gray-400">Configure FatSecret API for food search</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="card bg-blue-500/10 border border-blue-500/30">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-white font-medium">FatSecret Platform API</h3>
            <p className="text-gray-400 text-sm mt-1">
              FatSecret provides access to a comprehensive food and nutrition database with over 1.9 million foods.
              Sign up for free at{' '}
              <a
                href="https://platform.fatsecret.com/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline"
              >
                platform.fatsecret.com
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`card ${
          message.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
          message.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
          'bg-red-500/10 border-red-500/30'
        } border`}>
          <p className={`${
            message.type === 'success' ? 'text-green-500' :
            message.type === 'warning' ? 'text-yellow-500' :
            'text-red-500'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="card space-y-4">
        <div>
          <label className="block text-gray-400 text-sm mb-1">Client ID (Consumer Key)</label>
          <input
            type="text"
            value={settings.fatSecretClientId}
            onChange={(e) => setSettings({ ...settings, fatSecretClientId: e.target.value })}
            className="input w-full"
            placeholder="Your FatSecret Client ID"
          />
        </div>

        <div>
          <label className="block text-gray-400 text-sm mb-1">Client Secret (Consumer Secret)</label>
          <input
            type="password"
            value={settings.fatSecretClientSecret}
            onChange={(e) => setSettings({ ...settings, fatSecretClientSecret: e.target.value })}
            className="input w-full"
            placeholder="Your FatSecret Client Secret"
          />
        </div>

        <div>
          <label className="block text-gray-400 text-sm mb-1">API Tier</label>
          <select
            value={settings.fatSecretTier}
            onChange={(e) => setSettings({ ...settings, fatSecretTier: e.target.value })}
            className="input w-full"
          >
            <option value="basic">Basic (Free tier - 5,000 calls/day)</option>
            <option value="premier">Premier (Paid/Startup - Unlimited)</option>
          </select>
          <p className="text-gray-500 text-xs mt-1">
            Select the tier that matches your FatSecret subscription
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
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
          <button
            type="button"
            onClick={handleTest}
            disabled={!settings.fatSecretClientId || !settings.fatSecretClientSecret}
            className="btn-secondary"
          >
            Test Connection
          </button>
        </div>
      </form>

      {/* Features */}
      <div className="card">
        <h3 className="text-white font-medium mb-3">Features Enabled</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-gray-300">Search 1.9M+ foods with nutrition data</span>
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-gray-300">Auto-populate calories, protein, carbs, fat</span>
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-gray-300">Search recipes from FatSecret database</span>
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-gray-500">Barcode scanning (Premier tier required)</span>
          </li>
        </ul>
      </div>

      {/* Rate Limits */}
      <div className="card">
        <h3 className="text-white font-medium mb-3">API Limits</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Basic Tier</p>
            <p className="text-white">5,000 calls/day</p>
          </div>
          <div>
            <p className="text-gray-500">Premier Free</p>
            <p className="text-white">Unlimited (startups)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NutritionSettings
