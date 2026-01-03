import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function TimerSettings() {
  const [settings, setSettings] = useState({
    defaultRestTime: 90,
    autoStartRest: true,
    vibrate: true,
    sound: true,
    countdownBeep: true,
    beepAtSeconds: 3
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Load settings from localStorage or API
    const saved = localStorage.getItem('timerSettings')
    if (saved) {
      setSettings(JSON.parse(saved))
    }
  }, [])

  const saveSettings = () => {
    setSaving(true)
    localStorage.setItem('timerSettings', JSON.stringify(settings))
    setTimeout(() => setSaving(false), 500)
  }

  const restTimeOptions = [30, 45, 60, 90, 120, 180, 240, 300]

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/settings" className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">Rest Timer</h1>
      </div>

      {/* Default Rest Time */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Default Rest Time</h3>
        <div className="grid grid-cols-4 gap-2">
          {restTimeOptions.map((seconds) => (
            <button
              key={seconds}
              onClick={() => setSettings({ ...settings, defaultRestTime: seconds })}
              className={`py-3 rounded-xl text-sm transition-colors ${
                settings.defaultRestTime === seconds
                  ? 'bg-accent text-white'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              {seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}
            </button>
          ))}
        </div>
      </div>

      {/* Timer Behavior */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Timer Behavior</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Auto-start Rest Timer</p>
            <p className="text-gray-500 text-sm">Start timer automatically after logging a set</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, autoStartRest: !settings.autoStartRest })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.autoStartRest ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.autoStartRest ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Notifications</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Vibration</p>
            <p className="text-gray-500 text-sm">Vibrate when timer ends</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, vibrate: !settings.vibrate })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.vibrate ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.vibrate ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Sound</p>
            <p className="text-gray-500 text-sm">Play sound when timer ends</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, sound: !settings.sound })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.sound ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.sound ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Countdown Beep</p>
            <p className="text-gray-500 text-sm">Beep in the last few seconds</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, countdownBeep: !settings.countdownBeep })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.countdownBeep ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.countdownBeep ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={saveSettings}
        disabled={saving}
        className="btn-primary w-full"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}

export default TimerSettings
