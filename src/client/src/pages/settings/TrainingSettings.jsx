import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

// Display labels for equipment from the catalog
const equipmentLabels = {
  'barbell': 'Barbell',
  'dumbbell': 'Dumbbells',
  'kettlebells': 'Kettlebells',
  'cable': 'Cable Machine',
  'machine': 'Machines (General)',
  'bands': 'Resistance Bands',
  'medicine ball': 'Medicine Ball',
  'exercise ball': 'Exercise/Stability Ball',
  'foam roll': 'Foam Roller',
  'e-z curl bar': 'EZ Curl Bar',
  'body only': 'Bodyweight Only',
  'other': 'Other Equipment',
  // Benches
  'flat bench': 'Flat Bench',
  'incline bench': 'Incline Bench',
  'decline bench': 'Decline Bench',
  // Pull/Dip stations
  'pull-up bar': 'Pull-Up Bar',
  'dip bars': 'Dip Bars/Station',
  // Specific Machines - Legs
  'leg extension machine': 'Leg Extension Machine',
  'leg curl machine': 'Leg Curl Machine',
  'leg press': 'Leg Press',
  'hack squat machine': 'Hack Squat Machine',
  'hip abductor/adductor': 'Hip Abductor/Adductor',
  'seated calf raise machine': 'Seated Calf Raise',
  'standing calf raise machine': 'Standing Calf Raise',
  'glute ham raise': 'Glute Ham Raise (GHD)',
  // Specific Machines - Upper Body
  'smith machine': 'Smith Machine',
  'chest press machine': 'Chest Press Machine',
  'shoulder press machine': 'Shoulder Press Machine',
  'pec deck machine': 'Pec Deck / Rear Delt Fly',
  'lat pulldown': 'Lat Pulldown',
  'row machine': 'Seated Row Machine',
  't-bar row': 'T-Bar Row',
  'bicep curl machine': 'Bicep Curl Machine',
  'preacher curl machine': 'Preacher Curl Machine',
  'tricep extension machine': 'Tricep Extension Machine',
  'assisted dip machine': 'Assisted Dip/Pull-Up',
  'ab crunch machine': 'Ab Crunch Machine',
  'reverse hyper machine': 'Reverse Hyper',
  // Cardio
  'treadmill': 'Treadmill',
  'stationary bike': 'Stationary Bike',
  'elliptical': 'Elliptical',
  'rowing machine': 'Rowing Machine',
  'stair climber': 'Stair Climber'
}

// Categorize equipment for display
const getEquipmentCategory = (equipment) => {
  const categories = {
    'Free Weights': ['barbell', 'dumbbell', 'kettlebells', 'e-z curl bar'],
    'Benches': ['flat bench', 'incline bench', 'decline bench'],
    'Leg Machines': ['leg extension machine', 'leg curl machine', 'leg press', 'hack squat machine', 'hip abductor/adductor', 'seated calf raise machine', 'standing calf raise machine', 'glute ham raise'],
    'Upper Body Machines': ['smith machine', 'chest press machine', 'shoulder press machine', 'pec deck machine', 'lat pulldown', 'row machine', 't-bar row', 'bicep curl machine', 'preacher curl machine', 'tricep extension machine', 'assisted dip machine', 'ab crunch machine', 'reverse hyper machine', 'cable', 'machine'],
    'Cardio': ['treadmill', 'stationary bike', 'elliptical', 'rowing machine', 'stair climber'],
    'Bars & Stations': ['pull-up bar', 'dip bars'],
    'Accessories': ['bands', 'medicine ball', 'exercise ball', 'foam roll', 'other']
  }
  for (const [category, items] of Object.entries(categories)) {
    if (items.includes(equipment)) return category
  }
  return 'Other'
}

function TrainingSettings() {
  const [settings, setSettings] = useState({
    experienceLevel: 'intermediate',
    primaryGoal: 'strength',
    workoutDays: 4,
    sessionLength: 60,
    equipmentAccess: ['barbell', 'dumbbell'],
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
  const [equipmentOptions, setEquipmentOptions] = useState([])
  const [loadingEquipment, setLoadingEquipment] = useState(true)
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState(false)

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

  useEffect(() => {
    // Fetch available equipment from catalog
    const fetchEquipment = async () => {
      try {
        const response = await api.get('/exercises/filters/options')
        // Filter out 'body only' since those exercises are always available
        // Sort to put common equipment first
        const sortOrder = ['barbell', 'dumbbell', 'kettlebells', 'cable', 'machine', 'bands', 'e-z curl bar', 'medicine ball', 'exercise ball', 'foam roll', 'other']
        const equipment = (response.data.equipment || [])
          .filter(e => e !== 'body only') // Bodyweight exercises don't need equipment selection
          .sort((a, b) => {
            const aIdx = sortOrder.indexOf(a)
            const bIdx = sortOrder.indexOf(b)
            if (aIdx === -1 && bIdx === -1) return a.localeCompare(b)
            if (aIdx === -1) return 1
            if (bIdx === -1) return -1
            return aIdx - bIdx
          })
        setEquipmentOptions(equipment)
      } catch (error) {
        console.error('Error fetching equipment options:', error)
      } finally {
        setLoadingEquipment(false)
      }
    }
    fetchEquipment()
  }, [])

  useEffect(() => {
    // Load training settings from localStorage first
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

    // Always fetch equipment from server - server is source of truth
    const loadEquipmentFromServer = async () => {
      try {
        const response = await api.get('/users/profile')
        const serverEquipment = response.data.user?.settings?.availableEquipment || []
        const localEquipment = merged.equipmentAccess || []

        console.log('[TrainingSettings] Server equipment:', serverEquipment.length, 'Local equipment:', localEquipment.length)

        // Server has equipment - use it and sync to localStorage
        if (serverEquipment.length > 0) {
          console.log('[TrainingSettings] Using server equipment as source of truth')
          setSettings(prev => ({ ...prev, equipmentAccess: serverEquipment }))
          // Sync to localStorage
          const existing = localStorage.getItem('trainingSettings')
          const parsed = existing ? JSON.parse(existing) : {}
          parsed.equipmentAccess = serverEquipment
          localStorage.setItem('trainingSettings', JSON.stringify(parsed))
        } else if (localEquipment.length > 0) {
          // Server is empty but local has data - sync TO server
          console.log('[TrainingSettings] Syncing local equipment to server:', localEquipment)
          await api.put('/users/settings', {
            availableEquipment: localEquipment
          })
        }
      } catch (error) {
        console.log('[TrainingSettings] Load error:', error.message)
      }
    }
    loadEquipmentFromServer()
  }, [])

  // Filter equipment options based on search and exclude already selected
  const filteredEquipmentOptions = useMemo(() => {
    const search = equipmentSearch.toLowerCase()
    return equipmentOptions.filter(equip => {
      // Don't show already selected equipment
      if (settings.equipmentAccess.includes(equip)) return false
      // Filter by search
      const label = equipmentLabels[equip] || equip
      return label.toLowerCase().includes(search) || equip.toLowerCase().includes(search)
    })
  }, [equipmentOptions, equipmentSearch, settings.equipmentAccess])

  // Group selected equipment by category
  const groupedSelectedEquipment = useMemo(() => {
    const groups = {}
    settings.equipmentAccess.forEach(equip => {
      const category = getEquipmentCategory(equip)
      if (!groups[category]) groups[category] = []
      groups[category].push(equip)
    })
    return groups
  }, [settings.equipmentAccess])

  const addEquipment = (equip) => {
    setSettings(prev => ({
      ...prev,
      equipmentAccess: [...prev.equipmentAccess, equip]
    }))
    setEquipmentSearch('')
    setShowEquipmentDropdown(false)
  }

  const removeEquipment = (equip) => {
    setSettings(prev => ({
      ...prev,
      equipmentAccess: prev.equipmentAccess.filter(e => e !== equip)
    }))
  }

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

      // Save to server - include equipment for AI personalization
      await api.put('/users/settings', {
        trainingPreferences: settings,
        availableEquipment: settings.equipmentAccess // Sync equipment to database for AI
      }).catch(() => {})

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
              className={`w-full px-3 py-2.5 rounded-xl text-left transition-colors ${
                settings.experienceLevel === level.id
                  ? 'bg-accent text-white ring-2 ring-accent'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{level.label}</p>
                <p className={`text-xs ${settings.experienceLevel === level.id ? 'text-white/70' : 'text-gray-500'}`}>
                  {level.desc}
                </p>
              </div>
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
              className={`w-full px-3 py-2.5 rounded-xl text-left transition-colors ${
                settings.primaryGoal === style.id
                  ? 'bg-accent text-white ring-2 ring-accent'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{style.icon}</span>
                <p className="font-medium text-sm">{style.label}</p>
              </div>
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
        <p className="text-gray-500 text-sm mb-4">Search and add equipment you have access to. This helps filter exercises and personalize AI suggestions. Bodyweight exercises are always available.</p>

        {loadingEquipment ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Search and Add */}
            <div className="relative mb-4">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={equipmentSearch}
                  onChange={(e) => {
                    setEquipmentSearch(e.target.value)
                    setShowEquipmentDropdown(true)
                  }}
                  onFocus={() => setShowEquipmentDropdown(true)}
                  placeholder="Search equipment to add..."
                  className="input w-full pl-10 pr-4"
                />
              </div>

              {/* Dropdown */}
              {showEquipmentDropdown && filteredEquipmentOptions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-dark-card border border-dark-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {filteredEquipmentOptions.map((equip) => (
                    <button
                      key={equip}
                      onClick={() => addEquipment(equip)}
                      className="w-full px-4 py-3 text-left text-gray-300 hover:bg-dark-elevated hover:text-white flex items-center gap-3 transition-colors"
                    >
                      <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>{equipmentLabels[equip] || equip}</span>
                      <span className="ml-auto text-xs text-gray-500">{getEquipmentCategory(equip)}</span>
                    </button>
                  ))}
                </div>
              )}

              {showEquipmentDropdown && equipmentSearch && filteredEquipmentOptions.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-dark-card border border-dark-border rounded-xl shadow-lg p-4 text-center text-gray-500">
                  No equipment found matching "{equipmentSearch}"
                </div>
              )}
            </div>

            {/* Click outside to close dropdown */}
            {showEquipmentDropdown && (
              <div
                className="fixed inset-0 z-0"
                onClick={() => setShowEquipmentDropdown(false)}
              />
            )}

            {/* Selected Equipment by Category */}
            {settings.equipmentAccess.length > 0 ? (
              <div className="space-y-4">
                {Object.entries(groupedSelectedEquipment).map(([category, items]) => (
                  <div key={category}>
                    <h4 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">{category}</h4>
                    <div className="flex flex-wrap gap-2">
                      {items.map((equip) => (
                        <div
                          key={equip}
                          className="bg-accent/20 border border-accent/40 text-accent px-3 py-2 rounded-lg flex items-center gap-2 text-sm"
                        >
                          <span>{equipmentLabels[equip] || equip}</span>
                          <button
                            onClick={() => removeEquipment(equip)}
                            className="hover:text-white transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <p>No equipment added yet</p>
                <p className="text-sm mt-1">Search above to add your equipment</p>
              </div>
            )}

            {/* Quick actions */}
            {settings.equipmentAccess.length > 0 && (
              <div className="mt-4 pt-4 border-t border-dark-border">
                <button
                  onClick={() => setSettings({ ...settings, equipmentAccess: [] })}
                  className="btn-ghost text-sm text-gray-400 hover:text-red-400"
                >
                  Clear All Equipment
                </button>
              </div>
            )}
          </>
        )}
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
