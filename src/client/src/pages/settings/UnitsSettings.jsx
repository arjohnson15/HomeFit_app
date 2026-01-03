import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function UnitsSettings() {
  const [settings, setSettings] = useState({
    weightUnit: 'lbs',
    distanceUnit: 'miles',
    heightUnit: 'ft'
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('unitSettings')
    if (saved) {
      setSettings(JSON.parse(saved))
    }
  }, [])

  const saveSettings = () => {
    setSaving(true)
    setSaved(false)
    localStorage.setItem('unitSettings', JSON.stringify(settings))
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 500)
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
        <h1 className="text-2xl font-bold text-white">Units</h1>
      </div>

      {/* Weight Unit */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Weight</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSettings({ ...settings, weightUnit: 'lbs' })}
            className={`py-4 rounded-xl transition-colors ${
              settings.weightUnit === 'lbs'
                ? 'bg-accent text-white'
                : 'bg-dark-elevated text-gray-400 hover:text-white'
            }`}
          >
            <span className="text-lg font-medium">Pounds</span>
            <span className="block text-sm opacity-60">lbs</span>
          </button>
          <button
            onClick={() => setSettings({ ...settings, weightUnit: 'kg' })}
            className={`py-4 rounded-xl transition-colors ${
              settings.weightUnit === 'kg'
                ? 'bg-accent text-white'
                : 'bg-dark-elevated text-gray-400 hover:text-white'
            }`}
          >
            <span className="text-lg font-medium">Kilograms</span>
            <span className="block text-sm opacity-60">kg</span>
          </button>
        </div>
      </div>

      {/* Distance Unit */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Distance</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSettings({ ...settings, distanceUnit: 'miles' })}
            className={`py-4 rounded-xl transition-colors ${
              settings.distanceUnit === 'miles'
                ? 'bg-accent text-white'
                : 'bg-dark-elevated text-gray-400 hover:text-white'
            }`}
          >
            <span className="text-lg font-medium">Miles</span>
            <span className="block text-sm opacity-60">mi</span>
          </button>
          <button
            onClick={() => setSettings({ ...settings, distanceUnit: 'km' })}
            className={`py-4 rounded-xl transition-colors ${
              settings.distanceUnit === 'km'
                ? 'bg-accent text-white'
                : 'bg-dark-elevated text-gray-400 hover:text-white'
            }`}
          >
            <span className="text-lg font-medium">Kilometers</span>
            <span className="block text-sm opacity-60">km</span>
          </button>
        </div>
      </div>

      {/* Height Unit */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Height</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSettings({ ...settings, heightUnit: 'ft' })}
            className={`py-4 rounded-xl transition-colors ${
              settings.heightUnit === 'ft'
                ? 'bg-accent text-white'
                : 'bg-dark-elevated text-gray-400 hover:text-white'
            }`}
          >
            <span className="text-lg font-medium">Feet/Inches</span>
            <span className="block text-sm opacity-60">ft/in</span>
          </button>
          <button
            onClick={() => setSettings({ ...settings, heightUnit: 'cm' })}
            className={`py-4 rounded-xl transition-colors ${
              settings.heightUnit === 'cm'
                ? 'bg-accent text-white'
                : 'bg-dark-elevated text-gray-400 hover:text-white'
            }`}
          >
            <span className="text-lg font-medium">Centimeters</span>
            <span className="block text-sm opacity-60">cm</span>
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

export default UnitsSettings
