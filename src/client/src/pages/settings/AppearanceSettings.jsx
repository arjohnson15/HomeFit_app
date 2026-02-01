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
  const [customColorInput, setCustomColorInput] = useState('#0a84ff')
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  const colorOptions = [
    { id: 'blue', color: '#0a84ff', label: 'Blue' },
    { id: 'green', color: '#30d158', label: 'Green' },
    { id: 'purple', color: '#bf5af2', label: 'Purple' },
    { id: 'orange', color: '#ff9f0a', label: 'Orange' },
    { id: 'red', color: '#ff453a', label: 'Red' },
    { id: 'pink', color: '#ff375f', label: 'Pink' }
  ]

  const isCustomColor = settings.accentColor?.startsWith('#')

  useEffect(() => {
    const saved = localStorage.getItem('appearanceSettings')
    if (saved) {
      const parsed = JSON.parse(saved)
      setSettings(parsed)
      if (parsed.accentColor?.startsWith('#')) {
        setCustomColorInput(parsed.accentColor)
        setShowCustomPicker(true)
      }
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
        <div className="flex gap-2 flex-wrap">
          {colorOptions.map((color) => (
            <button
              key={color.id}
              onClick={() => { updateSetting('accentColor', color.id); setShowCustomPicker(false) }}
              className={`w-8 h-8 rounded-lg transition-all ${
                settings.accentColor === color.id ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color.color }}
              title={color.label}
            />
          ))}
          {/* Custom color toggle */}
          <button
            onClick={() => {
              setShowCustomPicker(true)
              updateSetting('accentColor', customColorInput)
            }}
            className={`w-8 h-8 rounded-lg transition-all border-2 border-dashed ${
              isCustomColor ? 'ring-2 ring-white scale-110 border-white' : 'border-gray-500 hover:scale-105 hover:border-gray-400'
            }`}
            style={isCustomColor ? { backgroundColor: settings.accentColor } : { background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
            title="Custom Color"
          />
        </div>

        {/* Custom Color Picker */}
        {showCustomPicker && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={customColorInput}
                onChange={(e) => {
                  setCustomColorInput(e.target.value)
                  updateSetting('accentColor', e.target.value)
                }}
                className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                style={{ WebkitAppearance: 'none' }}
              />
              <div className="flex-1 flex items-center gap-2">
                <span className="text-gray-400 text-sm">#</span>
                <input
                  type="text"
                  value={customColorInput.replace('#', '').toUpperCase()}
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
                    if (val.length <= 6) {
                      setCustomColorInput('#' + val)
                      if (val.length === 6) {
                        updateSetting('accentColor', '#' + val)
                      }
                    }
                  }}
                  maxLength={6}
                  className="input flex-1 font-mono text-sm uppercase"
                  placeholder="0A84FF"
                />
              </div>
            </div>
            {/* Preview bar */}
            <div
              className="h-8 rounded-lg w-full"
              style={{ backgroundColor: customColorInput }}
            />
          </div>
        )}
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
