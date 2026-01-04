import { useState, useEffect } from 'react'
import api from '../../../services/api'

const activityLevels = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise' },
  { id: 'light', label: 'Lightly Active', desc: '1-3 days/week' },
  { id: 'moderate', label: 'Moderately Active', desc: '3-5 days/week' },
  { id: 'active', label: 'Very Active', desc: '6-7 days/week' },
  { id: 'veryActive', label: 'Extremely Active', desc: 'Physical job + training' }
]

const dietaryGoals = [
  { id: 'weight_loss', label: 'Weight Loss', desc: '-400 cal' },
  { id: 'maintain', label: 'Maintain', desc: 'No change' },
  { id: 'bulk', label: 'Lean Bulk', desc: '+300 cal' }
]

const dietaryPreferences = [
  { id: 'none', label: 'None' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'keto', label: 'Keto' }
]

const allergyOptions = ['Gluten', 'Dairy', 'Nuts', 'Peanuts', 'Shellfish', 'Soy', 'Eggs']

function BodyStatsStep({ data, updateData, showDietary, setShowDietary }) {
  const [useImperial, setUseImperial] = useState(true)
  const [calculatedCalories, setCalculatedCalories] = useState(null)
  const [calculating, setCalculating] = useState(false)

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

  const heightDisplay = cmToFeetInches(data.heightCm)

  // Auto-calculate when all required fields are filled
  const canCalculate = data.heightCm && data.weightKg && data.sex && data.birthDate && data.activityLevel

  const calculateCalories = async () => {
    if (!canCalculate) return

    setCalculating(true)
    try {
      const params = new URLSearchParams()
      params.append('heightCm', data.heightCm)
      params.append('weightKg', data.weightKg)
      params.append('sex', data.sex)
      params.append('birthDate', data.birthDate)
      params.append('activityLevel', data.activityLevel)
      if (data.dietaryGoal) params.append('goal', data.dietaryGoal)

      const res = await api.get(`/nutrition/calculate-calories?${params.toString()}`)
      setCalculatedCalories(res.data)
    } catch (error) {
      console.error('Error calculating calories:', error)
    } finally {
      setCalculating(false)
    }
  }

  // Trigger calculation when all fields are filled
  useEffect(() => {
    if (canCalculate) {
      calculateCalories()
    }
  }, [data.heightCm, data.weightKg, data.sex, data.birthDate, data.activityLevel, data.dietaryGoal])

  const applyCalculatedGoals = () => {
    if (calculatedCalories) {
      updateData({
        dailyCalorieGoal: calculatedCalories.suggestedCalories,
        dailyProteinGoal: calculatedCalories.suggestedMacros.protein,
        dailyCarbsGoal: calculatedCalories.suggestedMacros.carbs,
        dailyFatGoal: calculatedCalories.suggestedMacros.fat
      })
    }
  }

  const toggleAllergy = (allergy) => {
    const lower = allergy.toLowerCase()
    const current = data.allergies || []
    const updated = current.includes(lower)
      ? current.filter(a => a !== lower)
      : [...current, lower]
    updateData({ allergies: updated })
  }

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Nutrition Goals</h2>
        <p className="text-gray-400 text-sm">
          We'll calculate your personalized calorie and macro targets
        </p>
      </div>

      {/* Unit Toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setUseImperial(!useImperial)}
          className="text-sm text-accent"
        >
          {useImperial ? 'Use Metric' : 'Use Imperial'}
        </button>
      </div>

      {/* Body Stats */}
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
                  onChange={(e) => updateData({
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
                  onChange={(e) => updateData({
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
                value={data.heightCm || ''}
                onChange={(e) => updateData({ heightCm: parseFloat(e.target.value) || null })}
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
              value={useImperial ? kgToLbs(data.weightKg) : (data.weightKg || '')}
              onChange={(e) => updateData({
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
              value={useImperial ? kgToLbs(data.goalWeightKg) : (data.goalWeightKg || '')}
              onChange={(e) => updateData({
                goalWeightKg: useImperial ? lbsToKg(parseFloat(e.target.value)) : (parseFloat(e.target.value) || null)
              })}
              className="input w-24"
              placeholder={useImperial ? '160' : '72'}
            />
            <span className="text-gray-500">{useImperial ? 'lbs' : 'kg'}</span>
          </div>
        </div>

        {/* Sex */}
        <div>
          <label className="block text-gray-400 text-sm mb-1">Sex</label>
          <div className="flex gap-2">
            {['male', 'female'].map((sex) => (
              <button
                key={sex}
                onClick={() => updateData({ sex })}
                className={`flex-1 py-2 rounded-xl capitalize transition-colors ${
                  data.sex === sex
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
            value={data.birthDate ? new Date(data.birthDate).toISOString().split('T')[0] : ''}
            onChange={(e) => updateData({ birthDate: e.target.value || null })}
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
                onClick={() => updateData({ activityLevel: level.id })}
                className={`w-full p-3 rounded-xl text-left transition-colors flex justify-between items-center ${
                  data.activityLevel === level.id
                    ? 'bg-accent text-white'
                    : 'bg-dark-elevated text-gray-400 hover:text-white'
                }`}
              >
                <span className="font-medium">{level.label}</span>
                <span className={`text-sm ${data.activityLevel === level.id ? 'text-white/70' : 'text-gray-500'}`}>
                  {level.desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calculated Results */}
      {calculatedCalories && (
        <div className="bg-accent/20 border border-accent rounded-xl p-4">
          <div className="text-center mb-3">
            <p className="text-accent text-sm font-medium">Your Daily Target</p>
            <p className="text-white text-3xl font-bold">{calculatedCalories.suggestedCalories}</p>
            <p className="text-gray-400 text-sm">calories/day</p>
          </div>

          {/* Macros */}
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div className="bg-dark-card rounded-lg p-2">
              <p className="text-blue-400 text-xs">Protein</p>
              <p className="text-white font-bold">{calculatedCalories.suggestedMacros.protein}g</p>
            </div>
            <div className="bg-dark-card rounded-lg p-2">
              <p className="text-yellow-400 text-xs">Carbs</p>
              <p className="text-white font-bold">{calculatedCalories.suggestedMacros.carbs}g</p>
            </div>
            <div className="bg-dark-card rounded-lg p-2">
              <p className="text-red-400 text-xs">Fat</p>
              <p className="text-white font-bold">{calculatedCalories.suggestedMacros.fat}g</p>
            </div>
          </div>

          {!data.dailyCalorieGoal && (
            <button
              onClick={applyCalculatedGoals}
              className="w-full py-2 bg-accent text-white font-medium rounded-lg text-sm"
            >
              Apply These Goals
            </button>
          )}
          {data.dailyCalorieGoal && (
            <p className="text-center text-green-400 text-sm flex items-center justify-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Goals applied
            </p>
          )}
        </div>
      )}

      {calculating && (
        <div className="bg-dark-elevated rounded-xl p-4 text-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Calculating your targets...</p>
        </div>
      )}

      {/* Dietary Preferences Expansion */}
      {!showDietary ? (
        <button
          onClick={() => setShowDietary(true)}
          className="w-full p-4 rounded-xl bg-dark-elevated border border-dashed border-dark-border text-center hover:border-accent/50 transition-colors"
        >
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Want to set dietary preferences?</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">Allergies, diet type, and more</p>
        </button>
      ) : (
        <div className="bg-dark-elevated rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">Dietary Preferences</h3>
            <button
              onClick={() => setShowDietary(false)}
              className="text-gray-500 hover:text-white text-sm"
            >
              Collapse
            </button>
          </div>

          {/* Dietary Goal */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Goal</label>
            <div className="grid grid-cols-3 gap-2">
              {dietaryGoals.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => updateData({ dietaryGoal: goal.id })}
                  className={`p-2 rounded-lg text-sm transition-colors ${
                    data.dietaryGoal === goal.id
                      ? 'bg-accent text-white'
                      : 'bg-dark-card text-gray-400 hover:text-white'
                  }`}
                >
                  <p className="font-medium">{goal.label}</p>
                  <p className="text-xs opacity-70">{goal.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Diet Type */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Diet Type</label>
            <div className="grid grid-cols-4 gap-2">
              {dietaryPreferences.map((pref) => (
                <button
                  key={pref.id}
                  onClick={() => updateData({ dietaryPreference: pref.id })}
                  className={`p-2 rounded-lg text-sm transition-colors ${
                    data.dietaryPreference === pref.id
                      ? 'bg-accent text-white'
                      : 'bg-dark-card text-gray-400 hover:text-white'
                  }`}
                >
                  {pref.label}
                </button>
              ))}
            </div>
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Allergies</label>
            <div className="flex flex-wrap gap-2">
              {allergyOptions.map((allergy) => (
                <button
                  key={allergy}
                  onClick={() => toggleAllergy(allergy)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    (data.allergies || []).includes(allergy.toLowerCase())
                      ? 'bg-red-500 text-white'
                      : 'bg-dark-card text-gray-400 hover:text-white'
                  }`}
                >
                  {allergy}
                </button>
              ))}
            </div>
          </div>

          <p className="text-gray-500 text-xs text-center">
            You can adjust these later in Settings
          </p>
        </div>
      )}

      <p className="text-gray-500 text-xs text-center">
        You can always adjust your goals in Settings → Nutrition
      </p>
    </div>
  )
}

export default BodyStatsStep
