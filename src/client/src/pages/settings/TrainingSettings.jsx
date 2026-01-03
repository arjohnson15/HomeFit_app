import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function TrainingSettings() {
  const [settings, setSettings] = useState({
    experienceLevel: 'intermediate',
    primaryGoal: 'strength',
    workoutDays: 4,
    sessionLength: 60,
    equipmentAccess: ['barbell', 'dumbbell', 'flat_bench', 'squat_rack'],
    // Rest timer settings
    defaultRestTime: 90,
    autoStartRest: true,
    vibrate: true,
    sound: true,
    countdownBeep: true
  })

  const restTimeOptions = [30, 45, 60, 90, 120, 180, 240, 300]
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const experienceLevels = [
    {
      id: 'beginner',
      label: 'Beginner',
      desc: 'Less than 1 year training',
      details: 'Focuses on learning proper form and building foundational strength. Workouts include more guided rest periods, simpler exercise variations, and gradual progression.'
    },
    {
      id: 'intermediate',
      label: 'Intermediate',
      desc: '1-3 years training',
      details: 'Ready for more complex movements and higher volume. Includes progressive overload tracking, supersets, and varied rep ranges for optimal gains.'
    },
    {
      id: 'advanced',
      label: 'Advanced',
      desc: '3+ years training',
      details: 'Advanced programming with periodization, intensity techniques (drop sets, rest-pause), and specialized training splits. Assumes solid form on all exercises.'
    }
  ]

  const liftingStyles = [
    {
      id: 'powerlifting',
      label: 'Powerlifting',
      icon: '🏋️',
      desc: 'Focus on squat, bench, deadlift. Heavy compound lifts with low reps (1-5) and long rest periods. Build maximal strength.'
    },
    {
      id: 'bodybuilding',
      label: 'Bodybuilding',
      icon: '💪',
      desc: 'Hypertrophy-focused with moderate weights, higher reps (8-12), and mind-muscle connection. Emphasis on muscle symmetry and definition.'
    },
    {
      id: 'strength',
      label: 'Strength Training',
      icon: '🔥',
      desc: 'Balanced approach building functional strength. Mix of compound and isolation exercises with progressive overload.'
    },
    {
      id: 'crossfit',
      label: 'CrossFit Style',
      icon: '⚡',
      desc: 'High-intensity functional fitness. Varied workouts combining weightlifting, cardio, and gymnastics movements.'
    },
    {
      id: 'calisthenics',
      label: 'Calisthenics',
      icon: '🤸',
      desc: 'Bodyweight-focused training. Progress through skill levels from basic to advanced movements like muscle-ups and planches.'
    }
  ]

  const equipmentCategories = [
    {
      category: 'Free Weights',
      items: [
        { id: 'barbell', label: 'Barbell (Olympic)' },
        { id: 'ez_barbell', label: 'EZ Curl Bar' },
        { id: 'trap_bar', label: 'Trap/Hex Bar' },
        { id: 'dumbbell', label: 'Dumbbells' },
        { id: 'kettlebell', label: 'Kettlebells' },
        { id: 'weight_plates', label: 'Weight Plates' }
      ]
    },
    {
      category: 'Benches & Racks',
      items: [
        { id: 'flat_bench', label: 'Flat Bench' },
        { id: 'incline_bench', label: 'Incline Bench' },
        { id: 'decline_bench', label: 'Decline Bench' },
        { id: 'adjustable_bench', label: 'Adjustable Bench' },
        { id: 'squat_rack', label: 'Squat Rack/Power Cage' },
        { id: 'smith_machine', label: 'Smith Machine' }
      ]
    },
    {
      category: 'Machines',
      items: [
        { id: 'cable_machine', label: 'Cable Machine' },
        { id: 'lat_pulldown', label: 'Lat Pulldown' },
        { id: 'leg_press', label: 'Leg Press' },
        { id: 'leg_curl', label: 'Leg Curl Machine' },
        { id: 'leg_extension', label: 'Leg Extension' },
        { id: 'chest_press', label: 'Chest Press Machine' },
        { id: 'pec_deck', label: 'Pec Deck/Fly Machine' },
        { id: 'shoulder_press', label: 'Shoulder Press Machine' },
        { id: 'rowing_machine', label: 'Seated Row Machine' }
      ]
    },
    {
      category: 'Bodyweight & Accessories',
      items: [
        { id: 'pullup_bar', label: 'Pull-up Bar' },
        { id: 'dip_station', label: 'Dip Station' },
        { id: 'resistance_bands', label: 'Resistance Bands' },
        { id: 'suspension_trainer', label: 'Suspension Trainer (TRX)' },
        { id: 'ab_wheel', label: 'Ab Wheel' },
        { id: 'medicine_ball', label: 'Medicine Ball' },
        { id: 'stability_ball', label: 'Stability Ball' },
        { id: 'foam_roller', label: 'Foam Roller' }
      ]
    },
    {
      category: 'Cardio',
      items: [
        { id: 'treadmill', label: 'Treadmill' },
        { id: 'stationary_bike', label: 'Stationary Bike' },
        { id: 'elliptical', label: 'Elliptical' },
        { id: 'rowing_erg', label: 'Rowing Ergometer' },
        { id: 'stair_climber', label: 'Stair Climber' },
        { id: 'jump_rope', label: 'Jump Rope' }
      ]
    }
  ]

  useEffect(() => {
    // Load training settings
    const savedTraining = localStorage.getItem('trainingSettings')
    // Load timer settings (for backwards compatibility)
    const savedTimer = localStorage.getItem('timerSettings')

    let merged = {}
    if (savedTraining) {
      merged = { ...merged, ...JSON.parse(savedTraining) }
    }
    if (savedTimer) {
      merged = { ...merged, ...JSON.parse(savedTimer) }
    }
    if (Object.keys(merged).length > 0) {
      setSettings(prev => ({ ...prev, ...merged }))
    }
  }, [])

  const toggleEquipment = (id) => {
    setSettings(prev => ({
      ...prev,
      equipmentAccess: prev.equipmentAccess.includes(id)
        ? prev.equipmentAccess.filter(e => e !== id)
        : [...prev.equipmentAccess, id]
    }))
  }

  const saveSettings = async () => {
    setSaving(true)
    setSaved(false)
    try {
      // Save all settings to trainingSettings
      localStorage.setItem('trainingSettings', JSON.stringify(settings))
      // Also save timer settings separately for backwards compatibility
      const timerSettings = {
        defaultRestTime: settings.defaultRestTime,
        autoStartRest: settings.autoStartRest,
        vibrate: settings.vibrate,
        sound: settings.sound,
        countdownBeep: settings.countdownBeep
      }
      localStorage.setItem('timerSettings', JSON.stringify(timerSettings))
      await api.put('/users/settings', { trainingPreferences: settings }).catch(() => {})
      setSaved(true)
      // Auto-hide after 2 seconds
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
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
        <h1 className="text-2xl font-bold text-white">Training Style</h1>
      </div>

      {/* Experience Level */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Experience Level</h3>
        <div className="space-y-2">
          {experienceLevels.map((level) => (
            <button
              key={level.id}
              onClick={() => setSettings({ ...settings, experienceLevel: level.id })}
              className={`w-full p-4 rounded-xl text-left transition-colors ${
                settings.experienceLevel === level.id
                  ? 'bg-accent text-white ring-2 ring-accent'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium">{level.label}</p>
                <p className={`text-xs ${settings.experienceLevel === level.id ? 'text-white/70' : 'text-gray-500'}`}>
                  {level.desc}
                </p>
              </div>
              <p className={`text-sm ${settings.experienceLevel === level.id ? 'text-white/80' : 'text-gray-500'}`}>
                {level.details}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Lifting Style */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Lifting Style</h3>
        <div className="space-y-2">
          {liftingStyles.map((style) => (
            <button
              key={style.id}
              onClick={() => setSettings({ ...settings, primaryGoal: style.id })}
              className={`w-full p-4 rounded-xl text-left transition-colors ${
                settings.primaryGoal === style.id
                  ? 'bg-accent text-white ring-2 ring-accent'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xl">{style.icon}</span>
                <p className="font-medium">{style.label}</p>
              </div>
              <p className={`text-sm ml-9 ${settings.primaryGoal === style.id ? 'text-white/80' : 'text-gray-500'}`}>
                {style.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Workout Frequency */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Workouts Per Week</h3>
        <div className="grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((days) => (
            <button
              key={days}
              onClick={() => setSettings({ ...settings, workoutDays: days })}
              className={`py-3 rounded-xl font-medium transition-colors ${
                settings.workoutDays === days
                  ? 'bg-accent text-white'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              {days}
            </button>
          ))}
        </div>
        <p className="text-gray-500 text-sm mt-2">
          {settings.workoutDays === 1 && 'Full body workout once per week'}
          {settings.workoutDays === 2 && 'Upper/Lower split twice per week'}
          {settings.workoutDays === 3 && 'Push/Pull/Legs or Full Body 3x'}
          {settings.workoutDays === 4 && 'Upper/Lower split or 4-day bro split'}
          {settings.workoutDays === 5 && 'Push/Pull/Legs/Upper/Lower'}
          {settings.workoutDays === 6 && 'Push/Pull/Legs twice per week'}
          {settings.workoutDays === 7 && 'Daily training with active recovery'}
        </p>
      </div>

      {/* Session Length */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Session Length</h3>
        <div className="flex items-center gap-4">
          <input
            type="number"
            min="15"
            max="180"
            value={settings.sessionLength}
            onChange={(e) => setSettings({ ...settings, sessionLength: Math.max(15, Math.min(180, parseInt(e.target.value) || 60)) })}
            className="input w-24 text-center text-lg"
          />
          <span className="text-gray-400">minutes</span>
        </div>
        <p className="text-gray-500 text-sm mt-2">
          {settings.sessionLength < 30 && 'Quick workout - great for busy days'}
          {settings.sessionLength >= 30 && settings.sessionLength < 45 && 'Short session - efficient and focused'}
          {settings.sessionLength >= 45 && settings.sessionLength < 60 && 'Standard workout duration'}
          {settings.sessionLength >= 60 && settings.sessionLength < 90 && 'Full workout with proper rest'}
          {settings.sessionLength >= 90 && 'Extended session - includes extra warm-up and cool-down'}
        </p>
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

      {/* Equipment */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Available Equipment</h3>
        <p className="text-gray-500 text-sm mb-4">Select all equipment you have access to. This helps filter exercises to match your setup.</p>

        <div className="space-y-6">
          {equipmentCategories.map((category) => (
            <div key={category.category}>
              <h4 className="text-gray-400 text-sm font-medium mb-2">{category.category}</h4>
              <div className="grid grid-cols-2 gap-2">
                {category.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleEquipment(item.id)}
                    className={`p-3 rounded-xl text-sm text-left transition-colors flex items-center gap-2 ${
                      settings.equipmentAccess.includes(item.id)
                        ? 'bg-accent text-white'
                        : 'bg-dark-elevated text-gray-400 hover:text-white'
                    }`}
                  >
                    <svg
                      className={`w-4 h-4 flex-shrink-0 ${settings.equipmentAccess.includes(item.id) ? 'text-white' : 'text-gray-600'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {settings.equipmentAccess.includes(item.id) ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      )}
                    </svg>
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-dark-border flex gap-2">
          <button
            onClick={() => {
              const allIds = equipmentCategories.flatMap(c => c.items.map(i => i.id))
              setSettings({ ...settings, equipmentAccess: allIds })
            }}
            className="btn-secondary flex-1 text-sm"
          >
            Select All
          </button>
          <button
            onClick={() => setSettings({ ...settings, equipmentAccess: [] })}
            className="btn-secondary flex-1 text-sm"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={saveSettings}
        disabled={saving}
        className={`w-full py-3 rounded-xl font-medium transition-all ${
          saved
            ? 'bg-success text-white'
            : 'btn-primary'
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

export default TrainingSettings
