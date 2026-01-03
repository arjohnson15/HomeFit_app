import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import * as nutritionApi from '../services/nutritionApi'

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']

function Nutrition() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [foodLog, setFoodLog] = useState({ entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } })
  const [goals, setGoals] = useState(null)
  const [preferences, setPreferences] = useState({
    nutritionTrackingMode: 'full',
    showDetailedMacros: true,
    showDailyGoals: true,
    enableFoodLogging: true
  })
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedMealType, setSelectedMealType] = useState('BREAKFAST')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showGoalsModal, setShowGoalsModal] = useState(false)
  // Weight tracking
  const [bodyStats, setBodyStats] = useState({ weightKg: null, goalWeightKg: null })
  const [weightInput, setWeightInput] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)
  const [weightSaved, setWeightSaved] = useState(false)

  useEffect(() => {
    fetchPreferences()
    fetchBodyStats()
  }, [])

  useEffect(() => {
    fetchData()
  }, [selectedDate])

  const fetchBodyStats = async () => {
    try {
      const res = await api.get('/nutrition/body-stats')
      setBodyStats(res.data)
      if (res.data.weightKg) {
        setWeightInput(Math.round(res.data.weightKg * 2.205).toString()) // Show in lbs
      }
    } catch (error) {
      console.error('Error fetching body stats:', error)
    }
  }

  const handleLogWeight = async () => {
    if (!weightInput || isNaN(parseFloat(weightInput))) return

    setSavingWeight(true)
    setWeightSaved(false)
    try {
      const weightKg = parseFloat(weightInput) / 2.205 // Convert lbs to kg
      await nutritionApi.logWeight(weightKg, selectedDate)
      setBodyStats(prev => ({ ...prev, weightKg }))
      setWeightSaved(true)
      setTimeout(() => setWeightSaved(false), 2000)
    } catch (error) {
      console.error('Error logging weight:', error)
    } finally {
      setSavingWeight(false)
    }
  }

  const fetchPreferences = async () => {
    try {
      const res = await api.get('/nutrition/preferences')
      setPreferences(res.data)
    } catch (error) {
      console.error('Error fetching preferences:', error)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [logRes, goalsRes] = await Promise.all([
        nutritionApi.getFoodLog({ date: selectedDate }),
        nutritionApi.getNutritionGoals()
      ])
      setFoodLog(logRes)
      setGoals(goalsRes)
    } catch (error) {
      console.error('Error fetching nutrition data:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchFoods = useCallback(async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const results = await nutritionApi.searchFoods(query)
      setSearchResults(results.foods || [])
    } catch (error) {
      console.error('Error searching foods:', error)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) searchFoods(searchQuery)
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, searchFoods])

  const handleQuickAdd = async (food) => {
    try {
      await nutritionApi.quickLogFood({
        fatSecretFoodId: food.id,
        mealType: selectedMealType,
        date: selectedDate,
        servings: 1
      })
      setShowAddModal(false)
      setSearchQuery('')
      setSearchResults([])
      fetchData()
    } catch (error) {
      console.error('Error logging food:', error)
    }
  }

  const handleManualAdd = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    try {
      await nutritionApi.logFood({
        name: formData.get('name'),
        mealType: selectedMealType,
        date: selectedDate,
        calories: parseFloat(formData.get('calories')) || 0,
        protein: parseFloat(formData.get('protein')) || 0,
        carbs: parseFloat(formData.get('carbs')) || 0,
        fat: parseFloat(formData.get('fat')) || 0
      })
      setShowAddModal(false)
      fetchData()
    } catch (error) {
      console.error('Error logging food:', error)
    }
  }

  const handleDeleteEntry = async (id) => {
    try {
      await nutritionApi.deleteFoodLogEntry(id)
      fetchData()
    } catch (error) {
      console.error('Error deleting entry:', error)
    }
  }

  const handleSaveGoals = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    try {
      await nutritionApi.updateNutritionGoals({
        dailyCalorieGoal: parseInt(formData.get('calories')) || null,
        dailyProteinGoal: parseInt(formData.get('protein')) || null,
        dailyCarbsGoal: parseInt(formData.get('carbs')) || null,
        dailyFatGoal: parseInt(formData.get('fat')) || null
      })
      setShowGoalsModal(false)
      fetchData()
    } catch (error) {
      console.error('Error saving goals:', error)
    }
  }

  const getProgressPercentage = (current, goal) => {
    if (!goal) return 0
    return Math.min(100, Math.round((current / goal) * 100))
  }

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'bg-accent'
    if (percentage >= 75) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (dateStr === today.toISOString().split('T')[0]) return 'Today'
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday'
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const groupedEntries = MEAL_TYPES.reduce((acc, type) => {
    acc[type] = foodLog.entries.filter(e => e.mealType === type)
    return acc
  }, {})

  // Meal Plan Only mode - show simplified view
  if (preferences.nutritionTrackingMode === 'mealPlanOnly') {
    return (
      <div className="p-4 space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Nutrition</h1>
            <p className="text-gray-400">Plan your meals</p>
          </div>
          <div className="flex gap-2">
            <Link to="/recipes" className="btn-secondary text-sm">
              Recipes
            </Link>
            <Link to="/meal-plans" className="btn-primary text-sm">
              Meal Plans
            </Link>
          </div>
        </div>

        {/* Meal Plan CTA */}
        <div className="card text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Meal Planning Mode</h2>
          <p className="text-gray-400 mb-6 max-w-sm mx-auto">
            You're using meal planning mode. Create and follow meal plans without daily food logging.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/meal-plans" className="btn-primary">
              View Meal Plans
            </Link>
            <Link to="/recipes" className="btn-secondary">
              Browse Recipes
            </Link>
          </div>
        </div>

        {/* Quick link to change settings */}
        <div className="text-center">
          <Link to="/settings/nutrition" className="text-sm text-gray-500 hover:text-accent">
            Change tracking mode in settings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Nutrition</h1>
          <p className="text-gray-400">Track your daily intake</p>
        </div>
        <div className="flex gap-2">
          <Link to="/recipes" className="btn-secondary text-sm">
            Recipes
          </Link>
          <Link to="/meal-plans" className="btn-secondary text-sm">
            Meal Plans
          </Link>
        </div>
      </div>

      {/* Date Selector */}
      <div className="flex items-center justify-between bg-dark-card rounded-xl p-3">
        <button
          onClick={() => {
            const prev = new Date(selectedDate)
            prev.setDate(prev.getDate() - 1)
            setSelectedDate(prev.toISOString().split('T')[0])
          }}
          className="p-2 rounded-lg hover:bg-dark-elevated"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-white font-medium">{formatDate(selectedDate)}</p>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm text-gray-400 bg-transparent border-none cursor-pointer"
          />
        </div>
        <button
          onClick={() => {
            const next = new Date(selectedDate)
            next.setDate(next.getDate() + 1)
            setSelectedDate(next.toISOString().split('T')[0])
          }}
          className="p-2 rounded-lg hover:bg-dark-elevated"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weight Tracker */}
      {bodyStats.goalWeightKg && (
        <div className="card bg-gradient-to-r from-dark-card to-dark-elevated">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Today's Weight</p>
                <div className="flex items-baseline gap-2">
                  <input
                    type="number"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    onBlur={handleLogWeight}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogWeight()}
                    className="bg-transparent text-white text-xl font-bold w-20 focus:outline-none focus:ring-1 focus:ring-accent rounded px-1"
                    placeholder="---"
                  />
                  <span className="text-gray-500 text-sm">lbs</span>
                  {savingWeight && (
                    <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  )}
                  {weightSaved && (
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs">Goal</p>
              <p className="text-white font-medium">{Math.round(bodyStats.goalWeightKg * 2.205)} lbs</p>
              {bodyStats.weightKg && bodyStats.goalWeightKg && (
                <p className={`text-xs ${bodyStats.weightKg > bodyStats.goalWeightKg ? 'text-orange-400' : 'text-green-400'}`}>
                  {Math.abs(Math.round((bodyStats.weightKg - bodyStats.goalWeightKg) * 2.205))} lbs to {bodyStats.weightKg > bodyStats.goalWeightKg ? 'lose' : 'goal'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Daily Summary */}
      {preferences.showDailyGoals && <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Daily Summary</h2>
          <button
            onClick={() => setShowGoalsModal(true)}
            className="text-sm text-accent"
          >
            {goals?.dailyCalorieGoal ? 'Edit Goals' : 'Set Goals'}
          </button>
        </div>

        {/* Calories */}
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <span className="text-gray-400">Calories</span>
            <span className="text-white">
              {Math.round(foodLog.totals.calories)}
              {goals?.dailyCalorieGoal && <span className="text-gray-500"> / {goals.dailyCalorieGoal}</span>}
            </span>
          </div>
          <div className="h-3 bg-dark-elevated rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${getProgressColor(getProgressPercentage(foodLog.totals.calories, goals?.dailyCalorieGoal))}`}
              style={{ width: `${getProgressPercentage(foodLog.totals.calories, goals?.dailyCalorieGoal)}%` }}
            />
          </div>
        </div>

        {/* Macros */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto relative">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" className="text-dark-elevated" />
                <circle
                  cx="32" cy="32" r="28"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={176}
                  strokeDashoffset={176 - (176 * getProgressPercentage(foodLog.totals.protein, goals?.dailyProteinGoal)) / 100}
                  className="text-blue-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-white font-medium">{Math.round(foodLog.totals.protein)}g</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-1">Protein</p>
            {goals?.dailyProteinGoal && (
              <p className="text-gray-500 text-xs">/ {goals.dailyProteinGoal}g</p>
            )}
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto relative">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" className="text-dark-elevated" />
                <circle
                  cx="32" cy="32" r="28"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={176}
                  strokeDashoffset={176 - (176 * getProgressPercentage(foodLog.totals.carbs, goals?.dailyCarbsGoal)) / 100}
                  className="text-yellow-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-white font-medium">{Math.round(foodLog.totals.carbs)}g</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-1">Carbs</p>
            {goals?.dailyCarbsGoal && (
              <p className="text-gray-500 text-xs">/ {goals.dailyCarbsGoal}g</p>
            )}
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto relative">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" className="text-dark-elevated" />
                <circle
                  cx="32" cy="32" r="28"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={176}
                  strokeDashoffset={176 - (176 * getProgressPercentage(foodLog.totals.fat, goals?.dailyFatGoal)) / 100}
                  className="text-red-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-white font-medium">{Math.round(foodLog.totals.fat)}g</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-1">Fat</p>
            {goals?.dailyFatGoal && (
              <p className="text-gray-500 text-xs">/ {goals.dailyFatGoal}g</p>
            )}
          </div>
        </div>
      </div>}

      {/* Meals */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {MEAL_TYPES.map((mealType) => (
            <div key={mealType} className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    mealType === 'BREAKFAST' ? 'bg-orange-500/20 text-orange-500' :
                    mealType === 'LUNCH' ? 'bg-green-500/20 text-green-500' :
                    mealType === 'DINNER' ? 'bg-blue-500/20 text-blue-500' :
                    'bg-purple-500/20 text-purple-500'
                  }`}>
                    {mealType === 'BREAKFAST' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                      </svg>
                    )}
                    {mealType === 'LUNCH' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {mealType === 'DINNER' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    )}
                    {mealType === 'SNACK' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-medium capitalize">{mealType.toLowerCase()}</h3>
                    <p className="text-gray-500 text-sm">
                      {groupedEntries[mealType].reduce((sum, e) => sum + (e.calories || 0), 0)} cal
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedMealType(mealType)
                    setShowAddModal(true)
                  }}
                  className="p-2 rounded-lg bg-dark-elevated hover:bg-dark-border"
                >
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {groupedEntries[mealType].length > 0 ? (
                <div className="space-y-2">
                  {groupedEntries[mealType].map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between bg-dark-elevated p-3 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-white truncate">{entry.name}</p>
                        <p className="text-gray-500 text-sm">
                          {entry.servings > 1 && `${entry.servings}x `}
                          {entry.servingSize || 'serving'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-white">{Math.round(entry.calories)} cal</p>
                          <p className="text-gray-500 text-xs">
                            P:{Math.round(entry.protein || 0)}g C:{Math.round(entry.carbs || 0)}g F:{Math.round(entry.fat || 0)}g
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-1.5 rounded-lg hover:bg-dark-card text-gray-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-3">No foods logged</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Food Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowAddModal(false)}>
          <div
            className="bg-dark-card w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Add to {selectedMealType.toLowerCase()}</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-dark-elevated rounded-lg">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                type="text"
                placeholder="Search foods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input w-full"
                autoFocus
              />
            </div>

            <div className="p-4">
              {/* Search Results */}
              {searching ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2 mb-6">
                  <p className="text-gray-400 text-sm mb-2">Search Results</p>
                  {searchResults.map((food) => (
                    <button
                      key={food.id}
                      onClick={() => handleQuickAdd(food)}
                      className="w-full text-left flex items-center justify-between bg-dark-elevated p-3 rounded-xl hover:bg-dark-border transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white truncate">{food.name}</p>
                        {food.brand && <p className="text-gray-500 text-sm">{food.brand}</p>}
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-white">{food.calories} cal</p>
                        <p className="text-gray-500 text-xs">{food.servingSize}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="text-center py-4 mb-6">
                  <p className="text-gray-400">No foods found</p>
                </div>
              ) : null}

              {/* Manual Entry */}
              <div className="border-t border-dark-border pt-4">
                <p className="text-gray-400 text-sm mb-3">Or add manually</p>
                <form onSubmit={handleManualAdd} className="space-y-3">
                  <input
                    type="text"
                    name="name"
                    placeholder="Food name"
                    required
                    className="input w-full"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      name="calories"
                      placeholder="Calories"
                      className="input"
                    />
                    <input
                      type="number"
                      name="protein"
                      placeholder="Protein (g)"
                      className="input"
                    />
                    <input
                      type="number"
                      name="carbs"
                      placeholder="Carbs (g)"
                      className="input"
                    />
                    <input
                      type="number"
                      name="fat"
                      placeholder="Fat (g)"
                      className="input"
                    />
                  </div>
                  <button type="submit" className="btn-primary w-full">
                    Add Food
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goals Modal */}
      {showGoalsModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowGoalsModal(false)}>
          <div
            className="bg-dark-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Daily Goals</h2>
              <button onClick={() => setShowGoalsModal(false)} className="p-2 hover:bg-dark-elevated rounded-lg">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveGoals} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Daily Calories</label>
                <input
                  type="number"
                  name="calories"
                  defaultValue={goals?.dailyCalorieGoal || ''}
                  placeholder="e.g., 2000"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Protein (g)</label>
                <input
                  type="number"
                  name="protein"
                  defaultValue={goals?.dailyProteinGoal || ''}
                  placeholder="e.g., 150"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Carbs (g)</label>
                <input
                  type="number"
                  name="carbs"
                  defaultValue={goals?.dailyCarbsGoal || ''}
                  placeholder="e.g., 200"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Fat (g)</label>
                <input
                  type="number"
                  name="fat"
                  defaultValue={goals?.dailyFatGoal || ''}
                  placeholder="e.g., 65"
                  className="input w-full"
                />
              </div>
              <button type="submit" className="btn-primary w-full mt-6">
                Save Goals
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Nutrition
