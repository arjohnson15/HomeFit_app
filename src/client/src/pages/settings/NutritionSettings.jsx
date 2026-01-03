import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function NutritionSettings() {
  const [preferences, setPreferences] = useState({
    nutritionTrackingMode: 'full',
    showDetailedMacros: true,
    showDailyGoals: true,
    enableFoodLogging: true,
    dietaryGoal: null,
    dietaryPreference: null,
    allergies: [],
    preferredProteins: [],
    dislikedFoods: []
  })

  const [bodyStats, setBodyStats] = useState({
    heightCm: null,
    weightKg: null,
    goalWeightKg: null,
    sex: null,
    birthDate: null,
    activityLevel: null
  })

  const [goals, setGoals] = useState({
    dailyCalorieGoal: null,
    dailyProteinGoal: null,
    dailyCarbsGoal: null,
    dailyFatGoal: null
  })

  const [calculatedCalories, setCalculatedCalories] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dislikedInput, setDislikedInput] = useState('')
  const [useImperial, setUseImperial] = useState(true)

  const trackingModes = [
    {
      id: 'full',
      label: 'Full Tracking',
      desc: 'Log individual foods, track all macros (calories, protein, carbs, fat)'
    },
    {
      id: 'simple',
      label: 'Simple Tracking',
      desc: 'Just track daily calorie totals without logging every food'
    },
    {
      id: 'mealPlanOnly',
      label: 'Meal Planning Only',
      desc: 'Focus on planning meals with estimated calories, no daily logging'
    }
  ]

  const dietaryGoals = [
    { id: 'weight_loss', label: 'Weight Loss', desc: 'Sustainable deficit for steady weight loss (-400 cal)', category: 'loss' },
    { id: 'aggressive_loss', label: 'Aggressive Loss', desc: 'Faster results, not for long-term (-750 cal)', category: 'loss' },
    { id: 'cut', label: 'Bodybuilding Cut', desc: 'Preserve muscle while cutting (-500 cal)', category: 'athletic' },
    { id: 'maintain', label: 'Maintain', desc: 'Stay at current weight', category: 'maintain' },
    { id: 'recomp', label: 'Recomposition', desc: 'Build muscle, lose fat at maintenance', category: 'athletic' },
    { id: 'bulk', label: 'Lean Bulk', desc: 'Muscle gain with minimal fat (+300 cal)', category: 'athletic' }
  ]

  const dietaryPreferences = [
    { id: 'none', label: 'No Restrictions' },
    { id: 'vegetarian', label: 'Vegetarian' },
    { id: 'vegan', label: 'Vegan' },
    { id: 'pescatarian', label: 'Pescatarian' },
    { id: 'keto', label: 'Keto' },
    { id: 'paleo', label: 'Paleo' }
  ]

  const allergyOptions = [
    'Gluten', 'Dairy', 'Nuts', 'Peanuts', 'Shellfish', 'Fish', 'Soy', 'Eggs', 'Sesame'
  ]

  const proteinOptions = [
    { id: 'chicken', label: 'Chicken' },
    { id: 'beef', label: 'Beef' },
    { id: 'pork', label: 'Pork' },
    { id: 'turkey', label: 'Turkey' },
    { id: 'fish', label: 'Fish' },
    { id: 'shrimp', label: 'Shrimp' },
    { id: 'tofu', label: 'Tofu' },
    { id: 'tempeh', label: 'Tempeh' },
    { id: 'eggs', label: 'Eggs' },
    { id: 'beans', label: 'Beans/Legumes' }
  ]

  const activityLevels = [
    { id: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise' },
    { id: 'light', label: 'Lightly Active', desc: '1-3 days/week' },
    { id: 'moderate', label: 'Moderately Active', desc: '3-5 days/week' },
    { id: 'active', label: 'Very Active', desc: '6-7 days/week' },
    { id: 'veryActive', label: 'Extremely Active', desc: 'Physical job + training' }
  ]

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [prefsRes, statsRes, goalsRes] = await Promise.all([
        api.get('/nutrition/preferences'),
        api.get('/nutrition/body-stats'),
        api.get('/nutrition/goals')
      ])

      setPreferences(prefsRes.data)
      setBodyStats(statsRes.data)
      setGoals({
        dailyCalorieGoal: goalsRes.data.dailyCalorieGoal,
        dailyProteinGoal: goalsRes.data.dailyProteinGoal,
        dailyCarbsGoal: goalsRes.data.dailyCarbsGoal,
        dailyFatGoal: goalsRes.data.dailyFatGoal
      })
    } catch (error) {
      console.error('Error fetching nutrition settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateCalories = async () => {
    try {
      // Pass ALL current UI values so calculation uses them immediately (before saving)
      const params = new URLSearchParams()

      // Body stats from current UI
      if (bodyStats.heightCm) params.append('heightCm', bodyStats.heightCm)
      if (bodyStats.weightKg) params.append('weightKg', bodyStats.weightKg)
      if (bodyStats.sex) params.append('sex', bodyStats.sex)
      if (bodyStats.birthDate) params.append('birthDate', bodyStats.birthDate)
      if (bodyStats.activityLevel) params.append('activityLevel', bodyStats.activityLevel)

      // Goal from current UI
      if (preferences.dietaryGoal) params.append('goal', preferences.dietaryGoal)

      const res = await api.get(`/nutrition/calculate-calories?${params.toString()}`)
      setCalculatedCalories(res.data)
    } catch (error) {
      console.error('Error calculating calories:', error)
      if (error.response?.data?.message) {
        alert(error.response.data.message)
      }
    }
  }

  const applyCalculatedGoals = () => {
    if (calculatedCalories) {
      setGoals({
        dailyCalorieGoal: calculatedCalories.suggestedCalories,
        dailyProteinGoal: calculatedCalories.suggestedMacros.protein,
        dailyCarbsGoal: calculatedCalories.suggestedMacros.carbs,
        dailyFatGoal: calculatedCalories.suggestedMacros.fat
      })
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await Promise.all([
        api.put('/nutrition/preferences', preferences),
        api.put('/nutrition/body-stats', bodyStats),
        api.put('/nutrition/goals', goals)
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const toggleAllergy = (allergy) => {
    const lower = allergy.toLowerCase()
    setPreferences(prev => ({
      ...prev,
      allergies: prev.allergies.includes(lower)
        ? prev.allergies.filter(a => a !== lower)
        : [...prev.allergies, lower]
    }))
  }

  const toggleProtein = (protein) => {
    setPreferences(prev => ({
      ...prev,
      preferredProteins: prev.preferredProteins.includes(protein)
        ? prev.preferredProteins.filter(p => p !== protein)
        : [...prev.preferredProteins, protein]
    }))
  }

  const addDislikedFood = () => {
    if (dislikedInput.trim() && !preferences.dislikedFoods.includes(dislikedInput.trim().toLowerCase())) {
      setPreferences(prev => ({
        ...prev,
        dislikedFoods: [...prev.dislikedFoods, dislikedInput.trim().toLowerCase()]
      }))
      setDislikedInput('')
    }
  }

  const removeDislikedFood = (food) => {
    setPreferences(prev => ({
      ...prev,
      dislikedFoods: prev.dislikedFoods.filter(f => f !== food)
    }))
  }

  // Unit conversion helpers
  const cmToFeetInches = (cm) => {
    if (!cm) return { feet: '', inches: '' }
    const totalInches = cm / 2.54
    const feet = Math.floor(totalInches / 12)
    const inches = Math.round(totalInches % 12)
    return { feet, inches }
  }

  const feetInchesToCm = (feet, inches) => {
    return ((parseInt(feet) || 0) * 12 + (parseInt(inches) || 0)) * 2.54
  }

  const kgToLbs = (kg) => kg ? Math.round(kg * 2.205) : ''
  const lbsToKg = (lbs) => lbs ? lbs / 2.205 : null

  const heightDisplay = cmToFeetInches(bodyStats.heightCm)

  if (loading) {
    return (
      <div className="p-4 flex justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
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
        <h1 className="text-2xl font-bold text-white">Nutrition Settings</h1>
      </div>

      {/* Tracking Mode */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Tracking Mode</h3>
        <div className="space-y-2">
          {trackingModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setPreferences({ ...preferences, nutritionTrackingMode: mode.id })}
              className={`w-full p-4 rounded-xl text-left transition-colors ${
                preferences.nutritionTrackingMode === mode.id
                  ? 'bg-accent text-white ring-2 ring-accent'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              <p className="font-medium">{mode.label}</p>
              <p className={`text-sm ${preferences.nutritionTrackingMode === mode.id ? 'text-white/80' : 'text-gray-500'}`}>
                {mode.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Display Options */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Display Options</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Show Detailed Macros</p>
            <p className="text-gray-500 text-sm">Display protein, carbs, fat (not just calories)</p>
          </div>
          <button
            onClick={() => setPreferences({ ...preferences, showDetailedMacros: !preferences.showDetailedMacros })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              preferences.showDetailedMacros ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              preferences.showDetailedMacros ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Show Daily Goals</p>
            <p className="text-gray-500 text-sm">Display calorie/macro goals and progress bars</p>
          </div>
          <button
            onClick={() => setPreferences({ ...preferences, showDailyGoals: !preferences.showDailyGoals })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              preferences.showDailyGoals ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              preferences.showDailyGoals ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Enable Food Logging</p>
            <p className="text-gray-500 text-sm">Show the food log section for daily tracking</p>
          </div>
          <button
            onClick={() => setPreferences({ ...preferences, enableFoodLogging: !preferences.enableFoodLogging })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              preferences.enableFoodLogging ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              preferences.enableFoodLogging ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Dietary Goal */}
      <div className="card">
        <h3 className="text-white font-medium mb-2">Dietary Goal</h3>
        <p className="text-gray-500 text-sm mb-4">What's your primary nutrition goal?</p>

        {/* Weight Loss Goals */}
        <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Weight Loss</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {dietaryGoals.filter(g => g.category === 'loss').map((goal) => (
            <button
              key={goal.id}
              onClick={() => setPreferences({ ...preferences, dietaryGoal: goal.id })}
              className={`p-4 rounded-xl text-left transition-colors ${
                preferences.dietaryGoal === goal.id
                  ? 'bg-accent text-white ring-2 ring-accent'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              <p className="font-medium">{goal.label}</p>
              <p className={`text-xs ${preferences.dietaryGoal === goal.id ? 'text-white/70' : 'text-gray-500'}`}>
                {goal.desc}
              </p>
            </button>
          ))}
        </div>

        {/* Maintain */}
        <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Maintenance</p>
        <div className="grid grid-cols-1 gap-2 mb-4">
          {dietaryGoals.filter(g => g.category === 'maintain').map((goal) => (
            <button
              key={goal.id}
              onClick={() => setPreferences({ ...preferences, dietaryGoal: goal.id })}
              className={`p-4 rounded-xl text-left transition-colors ${
                preferences.dietaryGoal === goal.id
                  ? 'bg-accent text-white ring-2 ring-accent'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              <p className="font-medium">{goal.label}</p>
              <p className={`text-xs ${preferences.dietaryGoal === goal.id ? 'text-white/70' : 'text-gray-500'}`}>
                {goal.desc}
              </p>
            </button>
          ))}
        </div>

        {/* Athletic Goals */}
        <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Athletic / Muscle Building</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {dietaryGoals.filter(g => g.category === 'athletic').map((goal) => (
            <button
              key={goal.id}
              onClick={() => setPreferences({ ...preferences, dietaryGoal: goal.id })}
              className={`p-4 rounded-xl text-left transition-colors ${
                preferences.dietaryGoal === goal.id
                  ? 'bg-accent text-white ring-2 ring-accent'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              <p className="font-medium text-sm">{goal.label}</p>
              <p className={`text-xs ${preferences.dietaryGoal === goal.id ? 'text-white/70' : 'text-gray-500'}`}>
                {goal.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Dietary Preference */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Dietary Preference</h3>
        <div className="grid grid-cols-3 gap-2">
          {dietaryPreferences.map((pref) => (
            <button
              key={pref.id}
              onClick={() => setPreferences({ ...preferences, dietaryPreference: pref.id })}
              className={`p-3 rounded-xl text-sm transition-colors ${
                preferences.dietaryPreference === pref.id
                  ? 'bg-accent text-white'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              {pref.label}
            </button>
          ))}
        </div>
      </div>

      {/* Allergies */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Allergies & Intolerances</h3>
        <div className="flex flex-wrap gap-2">
          {allergyOptions.map((allergy) => (
            <button
              key={allergy}
              onClick={() => toggleAllergy(allergy)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                preferences.allergies.includes(allergy.toLowerCase())
                  ? 'bg-red-500 text-white'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              {allergy}
            </button>
          ))}
        </div>
      </div>

      {/* Preferred Proteins */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Preferred Proteins</h3>
        <p className="text-gray-500 text-sm mb-3">Select proteins you enjoy eating</p>
        <div className="grid grid-cols-2 gap-2">
          {proteinOptions.map((protein) => (
            <button
              key={protein.id}
              onClick={() => toggleProtein(protein.id)}
              className={`p-3 rounded-xl text-sm text-left transition-colors flex items-center gap-2 ${
                preferences.preferredProteins.includes(protein.id)
                  ? 'bg-accent text-white'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              <svg
                className={`w-4 h-4 flex-shrink-0 ${preferences.preferredProteins.includes(protein.id) ? 'text-white' : 'text-gray-600'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {preferences.preferredProteins.includes(protein.id) ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                )}
              </svg>
              {protein.label}
            </button>
          ))}
        </div>
      </div>

      {/* Disliked Foods */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Foods to Avoid</h3>
        <p className="text-gray-500 text-sm mb-3">Add foods you don't like (will be excluded from suggestions)</p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={dislikedInput}
            onChange={(e) => setDislikedInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDislikedFood()}
            placeholder="e.g., broccoli, mushrooms..."
            className="input flex-1"
          />
          <button onClick={addDislikedFood} className="btn-secondary px-4">
            Add
          </button>
        </div>

        {preferences.dislikedFoods.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {preferences.dislikedFoods.map((food) => (
              <span
                key={food}
                className="px-3 py-1 bg-dark-elevated rounded-full text-sm text-gray-300 flex items-center gap-2"
              >
                {food}
                <button
                  onClick={() => removeDislikedFood(food)}
                  className="text-gray-500 hover:text-red-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Body Stats */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Body Stats</h3>
          <button
            onClick={() => setUseImperial(!useImperial)}
            className="text-sm text-accent"
          >
            {useImperial ? 'Use Metric' : 'Use Imperial'}
          </button>
        </div>

        <div className="space-y-4">
          {/* Height */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Height</label>
            {useImperial ? (
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    value={heightDisplay.feet}
                    onChange={(e) => setBodyStats({
                      ...bodyStats,
                      heightCm: feetInchesToCm(e.target.value, heightDisplay.inches)
                    })}
                    className="input w-full"
                    placeholder="5"
                  />
                  <span className="text-gray-500 text-xs">ft</span>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    value={heightDisplay.inches}
                    onChange={(e) => setBodyStats({
                      ...bodyStats,
                      heightCm: feetInchesToCm(heightDisplay.feet, e.target.value)
                    })}
                    className="input w-full"
                    placeholder="10"
                  />
                  <span className="text-gray-500 text-xs">in</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={bodyStats.heightCm || ''}
                  onChange={(e) => setBodyStats({ ...bodyStats, heightCm: parseFloat(e.target.value) || null })}
                  className="input w-24"
                  placeholder="178"
                />
                <span className="text-gray-500">cm</span>
              </div>
            )}
          </div>

          {/* Current Weight */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Current Weight</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={useImperial ? kgToLbs(bodyStats.weightKg) : (bodyStats.weightKg || '')}
                onChange={(e) => setBodyStats({
                  ...bodyStats,
                  weightKg: useImperial ? lbsToKg(parseFloat(e.target.value)) : (parseFloat(e.target.value) || null)
                })}
                className="input w-24"
                placeholder={useImperial ? '180' : '82'}
              />
              <span className="text-gray-500">{useImperial ? 'lbs' : 'kg'}</span>
            </div>
          </div>

          {/* Goal Weight */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Goal Weight</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={useImperial ? kgToLbs(bodyStats.goalWeightKg) : (bodyStats.goalWeightKg || '')}
                onChange={(e) => setBodyStats({
                  ...bodyStats,
                  goalWeightKg: useImperial ? lbsToKg(parseFloat(e.target.value)) : (parseFloat(e.target.value) || null)
                })}
                className="input w-24"
                placeholder={useImperial ? '160' : '72'}
              />
              <span className="text-gray-500">{useImperial ? 'lbs' : 'kg'}</span>
            </div>
            {bodyStats.weightKg && bodyStats.goalWeightKg && (
              <p className="text-xs text-gray-500 mt-1">
                {useImperial
                  ? `${Math.abs(Math.round((bodyStats.weightKg - bodyStats.goalWeightKg) * 2.205))} lbs to ${bodyStats.weightKg > bodyStats.goalWeightKg ? 'lose' : 'gain'}`
                  : `${Math.abs(Math.round((bodyStats.weightKg - bodyStats.goalWeightKg) * 10) / 10)} kg to ${bodyStats.weightKg > bodyStats.goalWeightKg ? 'lose' : 'gain'}`
                }
              </p>
            )}
          </div>

          {/* Sex */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Sex</label>
            <div className="flex gap-2">
              {['male', 'female'].map((sex) => (
                <button
                  key={sex}
                  onClick={() => setBodyStats({ ...bodyStats, sex })}
                  className={`flex-1 py-2 rounded-xl capitalize transition-colors ${
                    bodyStats.sex === sex
                      ? 'bg-accent text-white'
                      : 'bg-dark-elevated text-gray-400 hover:text-white'
                  }`}
                >
                  {sex}
                </button>
              ))}
            </div>
          </div>

          {/* Birth Date */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Birth Date</label>
            <input
              type="date"
              value={bodyStats.birthDate ? new Date(bodyStats.birthDate).toISOString().split('T')[0] : ''}
              onChange={(e) => setBodyStats({ ...bodyStats, birthDate: e.target.value || null })}
              className="input w-full"
            />
          </div>

          {/* Activity Level */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Activity Level</label>
            <div className="space-y-2">
              {activityLevels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setBodyStats({ ...bodyStats, activityLevel: level.id })}
                  className={`w-full p-3 rounded-xl text-left transition-colors ${
                    bodyStats.activityLevel === level.id
                      ? 'bg-accent text-white'
                      : 'bg-dark-elevated text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{level.label}</span>
                    <span className={`text-sm ${bodyStats.activityLevel === level.id ? 'text-white/70' : 'text-gray-500'}`}>
                      {level.desc}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Calorie Calculator */}
      <div className="card">
        <h3 className="text-white font-medium mb-2">Calorie Calculator</h3>
        <p className="text-gray-500 text-sm mb-4">
          Calculate your personalized calorie and macro targets using the Mifflin-St Jeor equation
        </p>

        <button
          onClick={calculateCalories}
          className="btn-secondary w-full mb-4"
        >
          Calculate My Calories
        </button>

        {calculatedCalories && (
          <div className="space-y-4">
            {/* Warning if calories too low */}
            {calculatedCalories.calorieWarning && (
              <div className="bg-red-500/20 border border-red-500 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-red-400 font-medium text-sm">Calorie Warning</p>
                    <p className="text-gray-400 text-sm">{calculatedCalories.calorieWarning.message}</p>
                  </div>
                </div>
              </div>
            )}

            {/* BMR and TDEE with info buttons */}
            <div className="bg-dark-elevated rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* BMR */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <p className="text-gray-500 text-sm">BMR</p>
                    <button
                      className="text-gray-500 hover:text-accent"
                      title={calculatedCalories.bmrExplanation}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-white text-2xl font-bold">{calculatedCalories.bmr}</p>
                  <p className="text-gray-500 text-xs">calories at rest</p>
                </div>
                {/* TDEE */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <p className="text-gray-500 text-sm">TDEE</p>
                    <button
                      className="text-gray-500 hover:text-accent"
                      title={calculatedCalories.tdeeExplanation}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-white text-2xl font-bold">{calculatedCalories.tdee}</p>
                  <p className="text-gray-500 text-xs">maintenance calories</p>
                </div>
              </div>
              {calculatedCalories.activity && (
                <p className="text-center text-gray-500 text-xs mt-3 pt-3 border-t border-dark-border">
                  Activity: {calculatedCalories.activity.description} (×{calculatedCalories.activity.multiplier})
                </p>
              )}
            </div>

            {/* Suggested Intake */}
            <div className="bg-accent/20 border border-accent rounded-xl p-4">
              <div className="text-center mb-4">
                <p className="text-accent text-sm font-medium">{calculatedCalories.goal?.label || 'Suggested'} Daily Intake</p>
                <p className="text-white text-4xl font-bold">{calculatedCalories.suggestedCalories}</p>
                <p className="text-gray-400 text-sm">
                  calories/day
                  {calculatedCalories.goalAdjustment !== 0 && (
                    <span className={calculatedCalories.goalAdjustment > 0 ? 'text-green-500' : 'text-orange-400'}>
                      {' '}({calculatedCalories.goalAdjustment > 0 ? '+' : ''}{calculatedCalories.goalAdjustment})
                    </span>
                  )}
                </p>
              </div>

              {/* Macros */}
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="bg-dark-card rounded-lg p-3">
                  <p className="text-blue-400 text-xs font-medium">Protein</p>
                  <p className="text-white text-lg font-bold">{calculatedCalories.suggestedMacros.protein}g</p>
                  <p className="text-gray-500 text-xs">{calculatedCalories.suggestedMacros.proteinPerKg}g/kg</p>
                </div>
                <div className="bg-dark-card rounded-lg p-3">
                  <p className="text-yellow-400 text-xs font-medium">Carbs</p>
                  <p className="text-white text-lg font-bold">{calculatedCalories.suggestedMacros.carbs}g</p>
                </div>
                <div className="bg-dark-card rounded-lg p-3">
                  <p className="text-red-400 text-xs font-medium">Fat</p>
                  <p className="text-white text-lg font-bold">{calculatedCalories.suggestedMacros.fat}g</p>
                </div>
              </div>

              {/* Expected Results */}
              {calculatedCalories.expectedResults && calculatedCalories.expectedResults.weeklyWeightChangeLbs !== 0 && (
                <div className="bg-dark-card rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">Expected Progress</p>
                  <p className="text-white font-medium">
                    {calculatedCalories.expectedResults.weeklyWeightChangeLbs > 0 ? '+' : ''}
                    {calculatedCalories.expectedResults.weeklyWeightChangeLbs} lbs/week
                  </p>
                  <p className="text-gray-500 text-xs">
                    (~{calculatedCalories.expectedResults.monthlyWeightChangeLbs > 0 ? '+' : ''}
                    {calculatedCalories.expectedResults.monthlyWeightChangeLbs} lbs/month)
                  </p>
                </div>
              )}
            </div>

            {/* Tips */}
            {calculatedCalories.tips && calculatedCalories.tips.length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-400 text-sm font-medium">Personalized Tips</p>
                {calculatedCalories.tips.map((tip, index) => (
                  <div
                    key={index}
                    className={`rounded-lg p-3 ${
                      tip.type === 'warning'
                        ? 'bg-orange-500/10 border border-orange-500/30'
                        : 'bg-dark-elevated'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {tip.type === 'warning' ? (
                        <svg className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      <div>
                        <p className={`text-sm font-medium ${tip.type === 'warning' ? 'text-orange-400' : 'text-white'}`}>
                          {tip.title}
                        </p>
                        <p className="text-gray-400 text-xs">{tip.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Your Stats Summary */}
            {calculatedCalories.inputData && (
              <div className="bg-dark-elevated rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-2">Calculated for:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-dark-card rounded text-gray-300">
                    {calculatedCalories.inputData.sex === 'male' ? '♂' : '♀'} {calculatedCalories.inputData.age} years
                  </span>
                  <span className="px-2 py-1 bg-dark-card rounded text-gray-300">
                    {calculatedCalories.inputData.weightLbs} lbs
                  </span>
                  <span className="px-2 py-1 bg-dark-card rounded text-gray-300">
                    {Math.round(calculatedCalories.inputData.heightCm / 2.54)} in
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={applyCalculatedGoals}
              className="btn-primary w-full"
            >
              Apply These Goals
            </button>
          </div>
        )}
      </div>

      {/* Manual Goals */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Daily Goals</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Calories</label>
            <input
              type="number"
              value={goals.dailyCalorieGoal || ''}
              onChange={(e) => setGoals({ ...goals, dailyCalorieGoal: parseInt(e.target.value) || null })}
              className="input w-full"
              placeholder="2000"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Protein (g)</label>
            <input
              type="number"
              value={goals.dailyProteinGoal || ''}
              onChange={(e) => setGoals({ ...goals, dailyProteinGoal: parseInt(e.target.value) || null })}
              className="input w-full"
              placeholder="150"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Carbs (g)</label>
            <input
              type="number"
              value={goals.dailyCarbsGoal || ''}
              onChange={(e) => setGoals({ ...goals, dailyCarbsGoal: parseInt(e.target.value) || null })}
              className="input w-full"
              placeholder="200"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Fat (g)</label>
            <input
              type="number"
              value={goals.dailyFatGoal || ''}
              onChange={(e) => setGoals({ ...goals, dailyFatGoal: parseInt(e.target.value) || null })}
              className="input w-full"
              placeholder="65"
            />
          </div>
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

export default NutritionSettings
