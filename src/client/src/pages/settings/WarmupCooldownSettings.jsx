import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function WarmupCooldownSettings() {
  const [settings, setSettings] = useState({
    showWarmupSuggestions: true,
    showCooldownSuggestions: true,
    useAiForWarmups: false,
    showDailyTips: true
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const [warmupRes, aiRes] = await Promise.all([
        api.get('/schedules/warmup-settings'),
        api.get('/users/ai-settings')
      ])

      setSettings({
        showWarmupSuggestions: warmupRes.data.showWarmupSuggestions,
        showCooldownSuggestions: warmupRes.data.showCooldownSuggestions,
        useAiForWarmups: warmupRes.data.useAiForWarmups,
        showDailyTips: warmupRes.data.showDailyTips
      })

      // Check if user has API key configured
      setHasApiKey(!!aiRes.data.apiKey || aiRes.data.globalKeyAvailable)
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async (newSettings) => {
    setSaving(true)
    try {
      await api.put('/schedules/warmup-settings', newSettings)
      setSettings(newSettings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const toggleSetting = (key) => {
    const newSettings = { ...settings, [key]: !settings[key] }

    // If enabling AI for warmups but no API key, show warning
    if (key === 'useAiForWarmups' && !settings.useAiForWarmups && !hasApiKey) {
      alert('Please configure your OpenAI API key in AI Settings first.')
      return
    }

    saveSettings(newSettings)
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
        <h1 className="text-2xl font-bold text-white">Warmup & Cooldown</h1>
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
            <p className="text-white font-medium">Smart Suggestions</p>
            <p className="text-gray-400 text-sm mt-1">
              Get personalized warmup and cooldown suggestions based on your scheduled workout.
              Suggestions target the muscle groups you'll be working that day.
            </p>
          </div>
        </div>
      </div>

      {/* Warmup Settings */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <span className="text-xl">🔥</span>
          Warmup Suggestions
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Show Warmup Section</p>
            <p className="text-gray-500 text-sm">Display warmup suggestions on the Today page</p>
          </div>
          <button
            onClick={() => toggleSetting('showWarmupSuggestions')}
            disabled={saving}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.showWarmupSuggestions ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.showWarmupSuggestions ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Cooldown Settings */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <span className="text-xl">🧊</span>
          Cooldown Suggestions
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Show Cooldown Section</p>
            <p className="text-gray-500 text-sm">Display stretch suggestions after your workout</p>
          </div>
          <button
            onClick={() => toggleSetting('showCooldownSuggestions')}
            disabled={saving}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.showCooldownSuggestions ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.showCooldownSuggestions ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* AI Enhancement */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <span className="text-xl">🤖</span>
          AI Enhancement
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Use AI for Suggestions</p>
            <p className="text-gray-500 text-sm">
              {hasApiKey
                ? 'Get AI-personalized warmup and cooldown routines'
                : 'Requires OpenAI API key (configure in AI Settings)'}
            </p>
          </div>
          <button
            onClick={() => toggleSetting('useAiForWarmups')}
            disabled={saving || !hasApiKey}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.useAiForWarmups ? 'bg-accent' : 'bg-dark-elevated'
            } ${!hasApiKey ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.useAiForWarmups ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {!hasApiKey && (
          <Link
            to="/settings/ai"
            className="block text-center py-2 px-4 rounded-xl bg-accent/20 text-accent text-sm hover:bg-accent/30 transition-colors"
          >
            Configure AI Settings →
          </Link>
        )}
      </div>

      {/* Daily Tips */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <span className="text-xl">💡</span>
          Daily Tips
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Show Daily Tips</p>
            <p className="text-gray-500 text-sm">Display helpful tips about warmups, form, and recovery</p>
          </div>
          <button
            onClick={() => toggleSetting('showDailyTips')}
            disabled={saving}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.showDailyTips ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.showDailyTips ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <p className="text-gray-500 text-xs">
          Tips can also be dismissed individually on the Today page. They reset each day.
        </p>
      </div>

      {/* Preview Section */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Preview</h3>
        <p className="text-gray-400 text-sm">
          Here's what you'll see on the Today page based on your settings:
        </p>

        <div className="space-y-3">
          {settings.showWarmupSuggestions && (
            <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
              <div className="flex items-center gap-2 text-orange-400 font-medium text-sm">
                <span>🔥</span>
                <span>Warmup Section</span>
              </div>
              <p className="text-gray-400 text-xs mt-1">
                Dynamic warmups based on your scheduled exercises
              </p>
            </div>
          )}

          {settings.showDailyTips && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-center gap-2 text-blue-400 font-medium text-sm">
                <span>💡</span>
                <span>Daily Tip</span>
              </div>
              <p className="text-gray-400 text-xs mt-1">
                Helpful tips you can dismiss or disable
              </p>
            </div>
          )}

          <div className="p-3 rounded-xl bg-dark-elevated border border-gray-700">
            <div className="flex items-center gap-2 text-white font-medium text-sm">
              <span>💪</span>
              <span>Today's Workout</span>
            </div>
            <p className="text-gray-400 text-xs mt-1">
              Your main workout from schedule
            </p>
          </div>

          {settings.showCooldownSuggestions && (
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
              <div className="flex items-center gap-2 text-cyan-400 font-medium text-sm">
                <span>🧊</span>
                <span>Cooldown Section</span>
              </div>
              <p className="text-gray-400 text-xs mt-1">
                Stretches targeting muscles you worked
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WarmupCooldownSettings
