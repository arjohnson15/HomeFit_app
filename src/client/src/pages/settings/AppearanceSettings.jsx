import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { applyTheme } from '../../services/themeService'

function AppearanceSettings() {
  const [settings, setSettings] = useState({
    theme: 'dark',
    accentColor: 'blue',
    fontSize: 'medium',
    compactMode: false
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const colorOptions = [
    { id: 'blue', color: '#0a84ff', label: 'Blue' },
    { id: 'green', color: '#30d158', label: 'Green' },
    { id: 'purple', color: '#bf5af2', label: 'Purple' },
    { id: 'orange', color: '#ff9f0a', label: 'Orange' },
    { id: 'red', color: '#ff453a', label: 'Red' },
    { id: 'pink', color: '#ff375f', label: 'Pink' }
  ]

  useEffect(() => {
    const saved = localStorage.getItem('appearanceSettings')
    if (saved) {
      setSettings(JSON.parse(saved))
    }
  }, [])

  const saveSettings = () => {
    setSaving(true)
    setSaved(false)
    localStorage.setItem('appearanceSettings', JSON.stringify(settings))
    applyTheme(settings)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 300)
  }

  // Apply theme immediately when settings change
  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    applyTheme(newSettings)
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/settings" className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">Appearance</h1>
      </div>

      {/* Theme */}
      <div className="card p-3">
        <h3 className="text-white font-medium text-sm mb-2">Theme</h3>
        <div className="flex gap-2">
          {[
            { id: 'dark', label: 'Dark', bg: 'bg-gray-900 border-gray-700' },
            { id: 'light', label: 'Light', bg: 'bg-white border-gray-300' },
            { id: 'system', label: 'System', bg: 'bg-gradient-to-br from-white to-gray-900 border-gray-500' }
          ].map((theme) => (
            <button
              key={theme.id}
              onClick={() => updateSetting('theme', theme.id)}
              className={`flex-1 p-2 rounded-lg text-center transition-colors ${
                settings.theme === theme.id
                  ? 'bg-accent text-white'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              <div className={`w-8 h-8 mx-auto mb-1 rounded-lg border ${theme.bg}`} />
              <span className="text-xs">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div className="card p-3">
        <h3 className="text-white font-medium text-sm mb-2">Accent Color</h3>
        <div className="flex gap-2">
          {colorOptions.map((color) => (
            <button
              key={color.id}
              onClick={() => updateSetting('accentColor', color.id)}
              className={`w-8 h-8 rounded-lg transition-all ${
                settings.accentColor === color.id ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color.color }}
              title={color.label}
            />
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="card p-3">
        <h3 className="text-white font-medium text-sm mb-2">Font Size</h3>
        <div className="flex gap-2">
          {['small', 'medium', 'large'].map((size) => (
            <button
              key={size}
              onClick={() => updateSetting('fontSize', size)}
              className={`flex-1 py-2 rounded-lg capitalize text-sm transition-colors ${
                settings.fontSize === size
                  ? 'bg-accent text-white'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div className="card p-3">
        <h3 className="text-white font-medium text-sm mb-2">Layout</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm">Compact Mode</p>
            <p className="text-gray-500 text-xs">Denser UI layout</p>
          </div>
          <button
            onClick={() => updateSetting('compactMode', !settings.compactMode)}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.compactMode ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.compactMode ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={saveSettings}
        disabled={saving}
        className={`w-full py-3 rounded-xl font-medium transition-all ${
          saved ? 'bg-success text-white' : 'btn-primary'
        }`}
      >
        {saving ? 'Saving...' : saved ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved!
          </span>
        ) : 'Save Settings'}
      </button>
    </div>
  )
}

export default AppearanceSettings
