import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function CustomizeSettings() {
  const [settings, setSettings] = useState({
    appName: 'HomeFit',
    tagline: 'Your Personal Home Gym Tracker',
    primaryColor: '#0a84ff',
    logoUrl: '',
    fullLogoUrl: '',
    faviconUrl: '',
    welcomeMessage: 'Welcome back! Ready to crush your workout?',
    features: {
      social: true,
      leaderboard: true,
      achievements: true,
      aiCoach: true
    }
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await api.get('/admin/settings/customize')
      if (response.data.settings) {
        setSettings(prev => ({ ...prev, ...response.data.settings }))
      }
    } catch (error) {
      console.error('Error fetching customize settings:', error)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.put('/admin/settings/customize', settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Error saving settings:', err)
      setError(err.response?.data?.message || 'Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const colors = [
    { id: '#0a84ff', label: 'Blue' },
    { id: '#30d158', label: 'Green' },
    { id: '#bf5af2', label: 'Purple' },
    { id: '#ff9f0a', label: 'Orange' },
    { id: '#ff453a', label: 'Red' },
    { id: '#ff375f', label: 'Pink' }
  ]

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/settings" className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">App Customization</h1>
      </div>

      {/* Branding */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Branding</h3>

        <div>
          <label className="text-gray-400 text-sm mb-1 block">App Name</label>
          <input
            type="text"
            value={settings.appName}
            onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
            placeholder="HomeFit"
            className="input w-full"
          />
        </div>

        <div>
          <label className="text-gray-400 text-sm mb-1 block">Tagline</label>
          <input
            type="text"
            value={settings.tagline}
            onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
            placeholder="Your Personal Home Gym Tracker"
            className="input w-full"
          />
        </div>

        <div>
          <label className="text-gray-400 text-sm mb-1 block">Header Logo URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.logoUrl}
              onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
              placeholder="/logo.png (default)"
              className="input flex-1"
            />
            {settings.logoUrl && (
              <div className="w-10 h-10 bg-dark-elevated rounded flex items-center justify-center shrink-0">
                <img src={settings.logoUrl} alt="Preview" className="max-w-full max-h-full" />
              </div>
            )}
          </div>
          <p className="text-gray-500 text-xs mt-1">Small logo in app header (64x64px)</p>
        </div>

        <div>
          <label className="text-gray-400 text-sm mb-1 block">Login Page Logo URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.fullLogoUrl}
              onChange={(e) => setSettings({ ...settings, fullLogoUrl: e.target.value })}
              placeholder="/full-logo.png (default)"
              className="input flex-1"
            />
            {settings.fullLogoUrl && (
              <div className="w-16 h-10 bg-dark-elevated rounded flex items-center justify-center shrink-0">
                <img src={settings.fullLogoUrl} alt="Preview" className="max-w-full max-h-full" />
              </div>
            )}
          </div>
          <p className="text-gray-500 text-xs mt-1">Full logo on login/signup pages (300x100px)</p>
        </div>

        <div>
          <label className="text-gray-400 text-sm mb-1 block">Favicon URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.faviconUrl}
              onChange={(e) => setSettings({ ...settings, faviconUrl: e.target.value })}
              placeholder="/logo.png (default)"
              className="input flex-1"
            />
            {settings.faviconUrl && (
              <div className="w-8 h-8 bg-dark-elevated rounded flex items-center justify-center shrink-0">
                <img src={settings.faviconUrl} alt="Preview" className="max-w-full max-h-full" />
              </div>
            )}
          </div>
          <p className="text-gray-500 text-xs mt-1">Browser tab icon (32x32px or 64x64px)</p>
        </div>
      </div>

      {/* Primary Color */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Primary Color</h3>
        <div className="flex flex-wrap gap-2">
          {colors.map((color) => (
            <button
              key={color.id}
              onClick={() => setSettings({ ...settings, primaryColor: color.id })}
              className={`w-8 h-8 rounded-lg transition-all ${
                settings.primaryColor === color.id ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-card scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color.id }}
              title={color.label}
            />
          ))}
        </div>
        <div className="mt-4">
          <label className="text-gray-400 text-sm mb-1 block">Custom Color</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={settings.primaryColor}
              onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
              className="w-10 h-10 rounded-lg cursor-pointer border-0"
            />
            <input
              type="text"
              value={settings.primaryColor}
              onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
              placeholder="#0a84ff"
              className="input flex-1"
            />
          </div>
        </div>
      </div>

      {/* Welcome Message */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Welcome Message</h3>
        <textarea
          value={settings.welcomeMessage}
          onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
          placeholder="Welcome back! Ready to crush your workout?"
          className="input w-full min-h-[80px] resize-none"
        />
        <p className="text-gray-500 text-xs mt-2">
          Shown on the Today page when users log in
        </p>
      </div>

      {/* Features */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Features</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Social Features</p>
            <p className="text-gray-500 text-sm">Friends and activity feed</p>
          </div>
          <button
            onClick={() => setSettings({
              ...settings,
              features: { ...settings.features, social: !settings.features.social }
            })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.features.social ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.features.social ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Leaderboard</p>
            <p className="text-gray-500 text-sm">Competitive rankings</p>
          </div>
          <button
            onClick={() => setSettings({
              ...settings,
              features: { ...settings.features, leaderboard: !settings.features.leaderboard }
            })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.features.leaderboard ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.features.leaderboard ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Achievements</p>
            <p className="text-gray-500 text-sm">Badges and milestones</p>
          </div>
          <button
            onClick={() => setSettings({
              ...settings,
              features: { ...settings.features, achievements: !settings.features.achievements }
            })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.features.achievements ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.features.achievements ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">AI Coach</p>
            <p className="text-gray-500 text-sm">ChatGPT integration</p>
          </div>
          <button
            onClick={() => setSettings({
              ...settings,
              features: { ...settings.features, aiCoach: !settings.features.aiCoach }
            })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.features.aiCoach ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.features.aiCoach ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Save Button */}
      <div className="flex gap-2">
        <button
          onClick={saveSettings}
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
          onClick={() => {
            if (confirm('Reset logos to defaults? This will use the built-in HomeFit logos.')) {
              setSettings(prev => ({ ...prev, logoUrl: '', fullLogoUrl: '', faviconUrl: '' }))
            }
          }}
          className="btn-secondary"
        >
          Reset Logos
        </button>
      </div>
    </div>
  )
}

export default CustomizeSettings
