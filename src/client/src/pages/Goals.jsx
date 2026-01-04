import { useState, useEffect } from 'react'
import api from '../services/api'

const GOAL_TYPES = {
  WEIGHT_LOSS: { label: 'Weight Loss', icon: '⬇️', unit: 'lbs', color: 'blue', autoTracked: false },
  WEIGHT_GAIN: { label: 'Weight Gain', icon: '⬆️', unit: 'lbs', color: 'green', autoTracked: false },
  EXERCISE_STRENGTH: { label: 'Strength PR', icon: '💪', unit: 'lbs', color: 'orange', autoTracked: false },
  CARDIO_TIME: { label: 'Best Time', icon: '⏱️', unit: 'min', color: 'cyan', autoTracked: false, lowerIsBetter: true },
  CARDIO_DISTANCE: { label: 'Best Distance', icon: '📏', unit: 'miles', color: 'teal', autoTracked: false },
  MONTHLY_WORKOUTS: { label: 'Monthly Workouts', icon: '📅', unit: 'workouts', color: 'purple', autoTracked: true },
  YEARLY_WORKOUTS: { label: 'Yearly Workouts', icon: '🎯', unit: 'workouts', color: 'red', autoTracked: true }
}

function Goals() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [showProgressModal, setShowProgressModal] = useState(false)

  useEffect(() => {
    fetchGoals()
  }, [])

  const fetchGoals = async () => {
    try {
      const res = await api.get('/goals')
      setGoals(res.data.goals || [])
    } catch (error) {
      console.error('Error fetching goals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGoal = async (goalId) => {
    if (!confirm('Are you sure you want to delete this goal?')) return
    try {
      await api.delete(`/goals/${goalId}`)
      setGoals(goals.filter(g => g.id !== goalId))
    } catch (error) {
      console.error('Error deleting goal:', error)
      alert('Failed to delete goal')
    }
  }

  const handleGoalCreated = (newGoal) => {
    setGoals([newGoal, ...goals])
    setShowCreateModal(false)
  }

  const handleProgressLogged = (updatedGoal) => {
    setGoals(goals.map(g => g.id === updatedGoal.id ? updatedGoal : g))
    setShowProgressModal(false)
    setSelectedGoal(null)
  }

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const activeGoals = goals.filter(g => !g.isCompleted)
  const completedGoals = goals.filter(g => g.isCompleted)

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Goals</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-accent flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Goal
        </button>
      </div>

      {/* Active Goals */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🎯</span> Active Goals
        </h2>
        {activeGoals.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-400">No active goals yet</p>
            <p className="text-gray-500 text-sm mt-1">Create a goal to start tracking your progress</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onLogProgress={() => {
                  setSelectedGoal(goal)
                  setShowProgressModal(true)
                }}
                onDelete={() => handleDeleteGoal(goal.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>✅</span> Completed Goals
          </h2>
          <div className="space-y-3">
            {completedGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onDelete={() => handleDeleteGoal(goal.id)}
                isCompleted
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Goal Modal */}
      {showCreateModal && (
        <CreateGoalModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleGoalCreated}
        />
      )}

      {/* Log Progress Modal */}
      {showProgressModal && selectedGoal && (
        <LogProgressModal
          goal={selectedGoal}
          onClose={() => {
            setShowProgressModal(false)
            setSelectedGoal(null)
          }}
          onLogged={handleProgressLogged}
        />
      )}
    </div>
  )
}

// Goal Card Component
function GoalCard({ goal, onLogProgress, onDelete, isCompleted }) {
  const typeInfo = GOAL_TYPES[goal.type] || { label: goal.type, icon: '🎯', unit: '', color: 'gray', autoTracked: false }

  // Calculate progress based on goal type
  const calculateProgress = () => {
    if (goal.targetValue === 0) return 0

    // For "lower is better" goals (like time-based cardio)
    if (typeInfo.lowerIsBetter) {
      // Progress increases as current value decreases toward target
      const totalToImprove = goal.startValue - goal.targetValue
      const improved = goal.startValue - goal.currentValue
      if (totalToImprove <= 0) return 0
      return Math.min(100, Math.max(0, Math.round((improved / totalToImprove) * 100)))
    }

    // For workout goals (current value is count, start is always 0)
    if (goal.type === 'MONTHLY_WORKOUTS' || goal.type === 'YEARLY_WORKOUTS') {
      return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
    }

    // For weight and strength goals - check direction matters
    const totalChange = Math.abs(goal.targetValue - goal.startValue)
    if (totalChange === 0) return 0

    // Determine if this is an "increase" goal (target > start) or "decrease" goal (target < start)
    const isIncreaseGoal = goal.targetValue > goal.startValue

    if (isIncreaseGoal) {
      // For weight gain / strength goals: progress only if current >= start
      if (goal.currentValue < goal.startValue) return 0
      const currentChange = goal.currentValue - goal.startValue
      return Math.min(100, Math.round((currentChange / totalChange) * 100))
    } else {
      // For weight loss goals: progress only if current <= start
      if (goal.currentValue > goal.startValue) return 0
      const currentChange = goal.startValue - goal.currentValue
      return Math.min(100, Math.round((currentChange / totalChange) * 100))
    }
  }

  const progress = calculateProgress()

  const colorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    orange: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
    teal: 'bg-teal-500/10 border-teal-500/30 text-teal-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    gray: 'bg-gray-500/10 border-gray-500/30 text-gray-400'
  }

  const progressColorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    cyan: 'bg-cyan-500',
    teal: 'bg-teal-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500'
  }

  return (
    <div className={`card border ${isCompleted ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xl p-2 rounded-xl ${colorClasses[typeInfo.color]}`}>
            {typeInfo.icon}
          </span>
          <div>
            <p className="text-white font-medium">
              {goal.exerciseName || typeInfo.label}
            </p>
            <p className="text-gray-500 text-sm">{typeInfo.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {goal.isPublic && (
            <span className="text-gray-500 text-xs" title="Visible on profile">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </span>
          )}
          <button
            onClick={onDelete}
            className="text-gray-500 hover:text-red-400 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">
            {goal.currentValue} {typeInfo.unit}
          </span>
          <span className="text-white font-medium">
            {goal.targetValue} {typeInfo.unit}
          </span>
        </div>
        <div className="h-2 bg-dark-elevated rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColorClasses[typeInfo.color]} transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-gray-500 text-xs mt-1 text-right">{progress}% complete</p>
      </div>

      {/* Target Date */}
      {goal.targetDate && (
        <p className="text-gray-500 text-xs mb-3">
          Target: {new Date(goal.targetDate).toLocaleDateString()}
        </p>
      )}

      {/* Actions */}
      {!isCompleted && (
        typeInfo.autoTracked ? (
          <div className="text-center py-2">
            <span className="text-xs text-gray-500 bg-gray-500/10 px-3 py-1 rounded-full">
              Auto-tracked
            </span>
          </div>
        ) : onLogProgress && (
          <button
            onClick={onLogProgress}
            className="w-full btn-ghost text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Progress
          </button>
        )
      )}

      {isCompleted && goal.completedAt && (
        <p className="text-green-400 text-xs text-center">
          Completed on {new Date(goal.completedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}

// Distance presets for cardio time goals
const DISTANCE_PRESETS = [
  { label: 'Mile', value: 1, unit: 'mile' },
  { label: '5K', value: 3.1, unit: 'miles' },
  { label: '10K', value: 6.2, unit: 'miles' },
  { label: 'Half Marathon', value: 13.1, unit: 'miles' },
  { label: 'Marathon', value: 26.2, unit: 'miles' },
  { label: 'Custom', value: 'custom', unit: 'miles' }
]

// Create Goal Modal
function CreateGoalModal({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    type: 'WEIGHT_LOSS',
    targetValue: '',
    startValue: '',
    targetDate: '',
    exerciseName: '',
    isPublic: true,
    // Cardio-specific fields
    distancePreset: 'Mile',
    customDistance: '',
    timeDuration: '' // For cardio distance goals (time in minutes)
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    const isWorkoutGoalSubmit = ['MONTHLY_WORKOUTS', 'YEARLY_WORKOUTS'].includes(formData.type)

    // Validation
    if (!formData.targetValue) {
      alert('Please enter a target value')
      return
    }
    if (!isWorkoutGoalSubmit && !formData.startValue) {
      alert('Please enter a starting value')
      return
    }

    setSaving(true)
    try {
      // Build exercise name for cardio goals
      let exerciseName = formData.exerciseName || null
      if (formData.type === 'CARDIO_TIME') {
        const preset = DISTANCE_PRESETS.find(p => p.label === formData.distancePreset)
        if (formData.distancePreset === 'Custom' && formData.customDistance) {
          exerciseName = `${formData.customDistance} mile run`
        } else if (preset) {
          exerciseName = `${preset.label} run`
        }
      } else if (formData.type === 'CARDIO_DISTANCE') {
        exerciseName = `${formData.timeDuration} min run`
      }

      const payload = {
        type: formData.type,
        targetValue: parseFloat(formData.targetValue),
        startValue: isWorkoutGoalSubmit ? 0 : parseFloat(formData.startValue),
        currentValue: isWorkoutGoalSubmit ? 0 : parseFloat(formData.startValue),
        targetDate: formData.targetDate || null,
        exerciseName,
        isPublic: formData.isPublic
      }
      const res = await api.post('/goals', payload)
      onCreated(res.data.goal)
    } catch (error) {
      console.error('Error creating goal:', error)
      alert('Failed to create goal')
    } finally {
      setSaving(false)
    }
  }

  const selectedType = GOAL_TYPES[formData.type]
  const needsExerciseName = formData.type === 'EXERCISE_STRENGTH'
  const isCardioTime = formData.type === 'CARDIO_TIME'
  const isCardioDistance = formData.type === 'CARDIO_DISTANCE'
  const isWorkoutGoal = ['MONTHLY_WORKOUTS', 'YEARLY_WORKOUTS'].includes(formData.type)

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create Goal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Goal Type */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Goal Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value, startValue: '', targetValue: '' })}
              className="input w-full"
            >
              {Object.entries(GOAL_TYPES).map(([key, { label, icon }]) => (
                <option key={key} value={key}>{icon} {label}</option>
              ))}
            </select>
          </div>

          {/* Exercise Name (for strength goals) */}
          {needsExerciseName && (
            <div>
              <label className="block text-gray-400 text-sm mb-2">Exercise Name</label>
              <input
                type="text"
                value={formData.exerciseName}
                onChange={(e) => setFormData({ ...formData, exerciseName: e.target.value })}
                placeholder="e.g., Bench Press, Squat, Deadlift"
                className="input w-full"
              />
            </div>
          )}

          {/* Distance Selection (for cardio time goals) */}
          {isCardioTime && (
            <div>
              <label className="block text-gray-400 text-sm mb-2">Distance</label>
              <select
                value={formData.distancePreset}
                onChange={(e) => setFormData({ ...formData, distancePreset: e.target.value })}
                className="input w-full"
              >
                {DISTANCE_PRESETS.map(preset => (
                  <option key={preset.label} value={preset.label}>{preset.label}</option>
                ))}
              </select>
              {formData.distancePreset === 'Custom' && (
                <input
                  type="number"
                  step="0.1"
                  value={formData.customDistance}
                  onChange={(e) => setFormData({ ...formData, customDistance: e.target.value })}
                  placeholder="Distance in miles"
                  className="input w-full mt-2"
                />
              )}
            </div>
          )}

          {/* Time Duration (for cardio distance goals) */}
          {isCardioDistance && (
            <div>
              <label className="block text-gray-400 text-sm mb-2">Time Duration (minutes)</label>
              <input
                type="number"
                value={formData.timeDuration}
                onChange={(e) => setFormData({ ...formData, timeDuration: e.target.value })}
                placeholder="e.g., 30"
                className="input w-full"
              />
              <p className="text-gray-500 text-xs mt-1">How long you run, then track max distance</p>
            </div>
          )}

          {/* Info for workout goals */}
          {isWorkoutGoal && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
              <p className="text-purple-400 text-sm">
                {formData.type === 'MONTHLY_WORKOUTS'
                  ? 'This goal resets each month and auto-tracks your completed workouts.'
                  : 'This goal tracks your total workouts for the year.'}
              </p>
            </div>
          )}

          {/* Start Value (not for workout goals) */}
          {!isWorkoutGoal && (
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                {isCardioTime ? 'Current Best Time (minutes)' :
                 isCardioDistance ? 'Current Best Distance (miles)' :
                 `Current Value (${selectedType.unit || 'value'})`}
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.startValue}
                onChange={(e) => setFormData({ ...formData, startValue: e.target.value })}
                placeholder={isCardioTime ? 'e.g., 8.5 for 8:30' :
                             isCardioDistance ? 'e.g., 2.5' :
                             `Current ${selectedType.unit || 'value'}`}
                className="input w-full"
                required
              />
              {isCardioTime && (
                <p className="text-gray-500 text-xs mt-1">Enter time in decimal minutes (8:30 = 8.5)</p>
              )}
            </div>
          )}

          {/* Target Value */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              {isCardioTime ? 'Target Time (minutes)' :
               isCardioDistance ? 'Target Distance (miles)' :
               isWorkoutGoal ? `Target (${selectedType.unit})` :
               `Target Value (${selectedType.unit || 'value'})`}
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.targetValue}
              onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
              placeholder={isCardioTime ? 'e.g., 7.0 for 7:00' :
                           isCardioDistance ? 'e.g., 3.5' :
                           isWorkoutGoal ? 'e.g., 20' :
                           `Goal ${selectedType.unit || 'value'}`}
              className="input w-full"
              required
            />
            {isCardioTime && (
              <p className="text-gray-500 text-xs mt-1">Lower time = goal achieved</p>
            )}
          </div>

          {/* Target Date */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Target Date (Optional)</label>
            <input
              type="date"
              value={formData.targetDate}
              onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
              className="input w-full"
            />
          </div>

          {/* Public Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Show on Profile</p>
              <p className="text-gray-500 text-sm">Others can see this goal</p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isPublic: !formData.isPublic })}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                formData.isPublic ? 'bg-accent' : 'bg-dark-elevated'
              }`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                formData.isPublic ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full btn-accent flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Create Goal
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

// Log Progress Modal
function LogProgressModal({ goal, onClose, onLogged }) {
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const typeInfo = GOAL_TYPES[goal.type] || { unit: '' }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!value) {
      alert('Please enter a value')
      return
    }

    setSaving(true)
    try {
      const res = await api.post(`/goals/${goal.id}/progress`, {
        value: parseFloat(value),
        notes: notes || null
      })
      onLogged(res.data.goal)
    } catch (error) {
      console.error('Error logging progress:', error)
      alert('Failed to log progress')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-card rounded-2xl w-full max-w-md">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Log Progress</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="text-center py-2">
            <p className="text-gray-400 text-sm">Current Progress</p>
            <p className="text-2xl font-bold text-white">
              {goal.currentValue} <span className="text-gray-500 text-lg">{typeInfo.unit}</span>
            </p>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">
              New Value ({typeInfo.unit || 'value'})
            </label>
            <input
              type="number"
              step="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Enter current ${typeInfo.unit || 'value'}`}
              className="input w-full text-center text-xl"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this progress..."
              className="input w-full h-20 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full btn-accent flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Log Progress
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Goals
