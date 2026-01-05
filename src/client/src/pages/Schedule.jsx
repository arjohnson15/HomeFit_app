import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import ChatWidget from '../components/ChatWidget'

function Schedule() {
  const [view, setView] = useState('week')
  const [schedules, setSchedules] = useState([])
  const [calendarWorkouts, setCalendarWorkouts] = useState([])
  const [recurringWorkouts, setRecurringWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingDay, setEditingDay] = useState(null)
  const [editingCalendarDate, setEditingCalendarDate] = useState(null)
  const [editingRecurring, setEditingRecurring] = useState(null)
  const [showCatalogModal, setShowCatalogModal] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [draggedExerciseIndex, setDraggedExerciseIndex] = useState(null)

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  useEffect(() => {
    fetchSchedules()
    fetchRecurringWorkouts()
  }, [])

  useEffect(() => {
    if (view === 'calendar') {
      fetchCalendarWorkouts()
    }
  }, [view, currentMonth])

  const fetchSchedules = async () => {
    try {
      const response = await api.get('/schedules/weekly')
      setSchedules(response.data.schedules || [])
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCalendarWorkouts = async () => {
    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      const response = await api.get(`/schedules/calendar?start=${startOfMonth.toISOString()}&end=${endOfMonth.toISOString()}`)
      setCalendarWorkouts(response.data.events || [])
    } catch (error) {
      console.error('Error fetching calendar workouts:', error)
    }
  }

  const fetchRecurringWorkouts = async () => {
    try {
      const response = await api.get('/schedules/recurring')
      setRecurringWorkouts(response.data.recurringWorkouts || [])
    } catch (error) {
      console.error('Error fetching recurring workouts:', error)
    }
  }

  const getScheduleForDay = (dayOfWeek) => {
    return schedules.find(s => s.dayOfWeek === dayOfWeek)
  }

  const getCalendarWorkoutForDate = (date) => {
    // Format local date as YYYY-MM-DD
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return calendarWorkouts.find(w => {
      if (!w.date) return false
      // Extract date portion directly from ISO string to avoid timezone conversion
      const wDateStr = w.date.split('T')[0]
      return wDateStr === dateStr
    })
  }

  const startEditingWeekly = (dayOfWeek) => {
    const schedule = getScheduleForDay(dayOfWeek)
    setEditingDay({
      dayOfWeek,
      name: schedule?.name || dayNames[dayOfWeek],
      isRestDay: schedule?.isRestDay || false,
      exercises: schedule?.exercises || []
    })
    setEditingCalendarDate(null)
  }

  const startEditingCalendar = (date) => {
    const existing = getCalendarWorkoutForDate(date)
    const dayOfWeek = date.getDay()
    const weeklySchedule = getScheduleForDay(dayOfWeek)

    setEditingCalendarDate({
      date: date,
      id: existing?.id || null,
      name: existing?.name || weeklySchedule?.name || `Workout - ${date.toLocaleDateString()}`,
      exercises: existing?.exercises || weeklySchedule?.exercises || [],
      isOverride: !!existing
    })
    setEditingDay(null)
  }

  const addExercisesToDay = (exercises) => {
    const newExercises = exercises.map(ex => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      exerciseId: ex.id,
      exerciseName: ex.name,
      sets: 3,
      reps: '8-12'
    }))

    if (editingDay) {
      setEditingDay(prev => ({
        ...prev,
        exercises: [...prev.exercises, ...newExercises]
      }))
    } else if (editingCalendarDate) {
      setEditingCalendarDate(prev => ({
        ...prev,
        exercises: [...prev.exercises, ...newExercises]
      }))
    } else if (editingRecurring) {
      setEditingRecurring(prev => ({
        ...prev,
        exercises: [...prev.exercises, ...newExercises]
      }))
    }
    setShowCatalogModal(false)
  }

  const removeExercise = (index) => {
    if (editingDay) {
      setEditingDay(prev => ({
        ...prev,
        exercises: prev.exercises.filter((_, i) => i !== index)
      }))
    } else if (editingCalendarDate) {
      setEditingCalendarDate(prev => ({
        ...prev,
        exercises: prev.exercises.filter((_, i) => i !== index)
      }))
    } else if (editingRecurring) {
      setEditingRecurring(prev => ({
        ...prev,
        exercises: prev.exercises.filter((_, i) => i !== index)
      }))
    }
  }

  const moveExercise = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return

    const reorder = (exercises) => {
      const result = [...exercises]
      const [moved] = result.splice(fromIndex, 1)
      result.splice(toIndex, 0, moved)
      return result
    }

    if (editingDay) {
      setEditingDay(prev => ({
        ...prev,
        exercises: reorder(prev.exercises)
      }))
    } else if (editingCalendarDate) {
      setEditingCalendarDate(prev => ({
        ...prev,
        exercises: reorder(prev.exercises)
      }))
    } else if (editingRecurring) {
      setEditingRecurring(prev => ({
        ...prev,
        exercises: reorder(prev.exercises)
      }))
    }
  }

  const saveWeeklySchedule = async () => {
    try {
      await api.put(`/schedules/weekly/${editingDay.dayOfWeek}`, {
        name: editingDay.name,
        isRestDay: editingDay.isRestDay,
        exercises: editingDay.exercises.map(ex => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          sets: parseInt(ex.sets) || 3,
          reps: ex.reps || '8-12'
        }))
      })
      await fetchSchedules()
      setEditingDay(null)
    } catch (error) {
      console.error('Error saving schedule:', error)
    }
  }

  const saveCalendarWorkout = async () => {
    try {
      if (editingCalendarDate.id) {
        // Update existing
        await api.put(`/schedules/calendar/${editingCalendarDate.id}`, {
          name: editingCalendarDate.name,
          exercises: editingCalendarDate.exercises.map(ex => ({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            sets: parseInt(ex.sets) || 3,
            reps: ex.reps || '8-12'
          }))
        })
      } else {
        // Create new
        await api.post('/schedules/calendar', {
          date: editingCalendarDate.date.toISOString(),
          name: editingCalendarDate.name,
          exercises: editingCalendarDate.exercises.map(ex => ({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            sets: parseInt(ex.sets) || 3,
            reps: ex.reps || '8-12'
          }))
        })
      }
      await fetchCalendarWorkouts()
      setEditingCalendarDate(null)
    } catch (error) {
      console.error('Error saving calendar workout:', error)
    }
  }

  const deleteCalendarWorkout = async () => {
    if (!editingCalendarDate?.id) return
    try {
      await api.delete(`/schedules/calendar/${editingCalendarDate.id}`)
      await fetchCalendarWorkouts()
      setEditingCalendarDate(null)
    } catch (error) {
      console.error('Error deleting calendar workout:', error)
    }
  }

  // Recurring workout functions
  const startEditingRecurring = (recurring = null) => {
    if (recurring) {
      setEditingRecurring({
        id: recurring.id,
        name: recurring.name,
        type: recurring.type,
        intervalDays: recurring.intervalDays || 2,
        daysOfWeek: recurring.daysOfWeek || [],
        skipRestDays: recurring.skipRestDays,
        isActive: recurring.isActive,
        exercises: recurring.exercises || []
      })
    } else {
      // New recurring workout
      setEditingRecurring({
        id: null,
        name: '',
        type: 'DAILY',
        intervalDays: 2,
        daysOfWeek: [],
        skipRestDays: true,
        isActive: true,
        exercises: []
      })
    }
    setEditingDay(null)
    setEditingCalendarDate(null)
  }

  const saveRecurringWorkout = async () => {
    try {
      const data = {
        name: editingRecurring.name,
        type: editingRecurring.type,
        intervalDays: editingRecurring.type === 'EVERY_X_DAYS' ? editingRecurring.intervalDays : null,
        daysOfWeek: editingRecurring.type === 'SPECIFIC_DAYS' ? editingRecurring.daysOfWeek : [],
        skipRestDays: editingRecurring.skipRestDays,
        isActive: editingRecurring.isActive,
        exercises: editingRecurring.exercises.map(ex => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          sets: parseInt(ex.sets) || 3,
          reps: ex.reps || '8-12',
          duration: ex.duration || null,
          distance: ex.distance || null
        }))
      }

      if (editingRecurring.id) {
        await api.put(`/schedules/recurring/${editingRecurring.id}`, data)
      } else {
        await api.post('/schedules/recurring', data)
      }

      await fetchRecurringWorkouts()
      setEditingRecurring(null)
    } catch (error) {
      console.error('Error saving recurring workout:', error)
    }
  }

  const deleteRecurringWorkout = async () => {
    if (!editingRecurring?.id) return
    try {
      await api.delete(`/schedules/recurring/${editingRecurring.id}`)
      await fetchRecurringWorkouts()
      setEditingRecurring(null)
    } catch (error) {
      console.error('Error deleting recurring workout:', error)
    }
  }

  const toggleRecurringActive = async (recurring) => {
    try {
      await api.put(`/schedules/recurring/${recurring.id}`, {
        isActive: !recurring.isActive
      })
      await fetchRecurringWorkouts()
    } catch (error) {
      console.error('Error toggling recurring workout:', error)
    }
  }

  const getRecurringTypeLabel = (recurring) => {
    switch (recurring.type) {
      case 'DAILY':
        return 'Every day'
      case 'EVERY_X_DAYS':
        return `Every ${recurring.intervalDays} days`
      case 'SPECIFIC_DAYS':
        return recurring.daysOfWeek.map(d => dayShorts[d]).join(', ')
      default:
        return recurring.type
    }
  }

  // Calendar rendering helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days = []

    // Add padding for days before the first of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }

    return days
  }

  const isToday = (date) => {
    if (!date) return false
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const currentEditData = editingDay || editingCalendarDate

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Schedule</h1>
          <p className="text-gray-400">Plan your training week</p>
        </div>
        <div className="flex bg-dark-elevated rounded-xl p-1">
          <button
            onClick={() => setView('week')}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              view === 'week' ? 'bg-accent text-white' : 'text-gray-400'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              view === 'calendar' ? 'bg-accent text-white' : 'text-gray-400'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setView('recurring')}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              view === 'recurring' ? 'bg-accent text-white' : 'text-gray-400'
            }`}
          >
            Recurring
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : view === 'week' ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
            const schedule = getScheduleForDay(dayOfWeek)
            const isRest = schedule?.isRestDay || !schedule
            return (
              <div
                key={dayOfWeek}
                className="card flex items-center gap-4 cursor-pointer hover:bg-dark-elevated transition-colors"
                onClick={() => startEditingWeekly(dayOfWeek)}
              >
                <div className="w-12 text-center">
                  <p className="text-gray-400 text-xs">{dayShorts[dayOfWeek]}</p>
                </div>
                <div className="flex-1">
                  <h3 className={`font-medium ${isRest ? 'text-gray-500' : 'text-white'}`}>
                    {schedule?.name || (isRest ? 'Rest Day' : 'Not Set')}
                  </h3>
                  {!isRest && schedule?.exercises?.length > 0 && (
                    <p className="text-gray-400 text-sm">{schedule.exercises.length} exercises</p>
                  )}
                </div>
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
            )
          })}
        </div>
      ) : view === 'calendar' ? (
        /* Calendar View */
        <div className="space-y-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="btn-ghost p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-medium text-white">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="btn-ghost p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {dayShorts.map(day => (
              <div key={day} className="text-gray-500 text-xs py-2">{day}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {getDaysInMonth(currentMonth).map((date, idx) => {
              if (!date) {
                return <div key={`empty-${idx}`} className="aspect-square" />
              }

              const calendarWorkout = getCalendarWorkoutForDate(date)
              const weeklySchedule = getScheduleForDay(date.getDay())
              const hasWorkout = calendarWorkout || (weeklySchedule && !weeklySchedule.isRestDay)
              const isOverride = !!calendarWorkout

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => startEditingCalendar(date)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm transition-colors relative ${
                    isToday(date)
                      ? 'bg-accent text-white'
                      : hasWorkout
                        ? 'bg-dark-elevated text-white hover:bg-dark-card'
                        : 'text-gray-500 hover:bg-dark-elevated'
                  }`}
                >
                  <span className={isToday(date) ? 'font-bold' : ''}>{date.getDate()}</span>
                  {hasWorkout && (
                    <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                      isOverride ? 'bg-warning' : (isToday(date) ? 'bg-white' : 'bg-accent')
                    }`} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <span>Weekly</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-warning" />
              <span>Custom</span>
            </div>
          </div>
        </div>
      ) : view === 'recurring' ? (
        /* Recurring Workouts View */
        <div className="space-y-4">
          {/* Add New Button */}
          <button
            onClick={() => startEditingRecurring()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Recurring Workout
          </button>

          {/* Info Card */}
          <div className="card bg-accent/10 border border-accent/30">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400 text-sm">
                Recurring workouts automatically appear on the Today page based on your schedule.
                Great for daily cardio, stretching routines, or exercises you do regularly.
              </p>
            </div>
          </div>

          {/* Recurring Workouts List */}
          {recurringWorkouts.length === 0 ? (
            <div className="card text-center py-8">
              <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-gray-400">No recurring workouts yet</p>
              <p className="text-gray-500 text-sm mt-1">Add daily cardio, stretching, or other regular activities</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recurringWorkouts.map((recurring) => (
                <div
                  key={recurring.id}
                  className={`card flex items-center gap-4 cursor-pointer hover:bg-dark-elevated transition-colors ${
                    !recurring.isActive ? 'opacity-50' : ''
                  }`}
                  onClick={() => startEditingRecurring(recurring)}
                >
                  {/* Active Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleRecurringActive(recurring)
                    }}
                    className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                      recurring.isActive ? 'bg-accent' : 'bg-dark-elevated'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      recurring.isActive ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate">{recurring.name || 'Unnamed'}</h3>
                    <p className="text-gray-400 text-sm">
                      {getRecurringTypeLabel(recurring)}
                      {recurring.skipRestDays && ' (skips rest days)'}
                    </p>
                    {recurring.exercises?.length > 0 && (
                      <p className="text-gray-500 text-xs mt-0.5">
                        {recurring.exercises.length} exercise{recurring.exercises.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Edit Icon */}
                  <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Edit Day Modal (for both weekly and calendar) */}
      {currentEditData && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={() => { setEditingDay(null); setEditingCalendarDate(null); }}>
          <div
            className="bg-dark-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {editingDay ? dayNames[editingDay.dayOfWeek] : editingCalendarDate.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </h2>
                {editingCalendarDate?.isOverride && (
                  <span className="text-warning text-xs">Custom workout (overrides weekly)</span>
                )}
              </div>
              <button onClick={() => { setEditingDay(null); setEditingCalendarDate(null); }} className="btn-ghost p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
              {/* Workout Name */}
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Workout Name</label>
                <input
                  type="text"
                  value={currentEditData.name}
                  onChange={(e) => {
                    if (editingDay) {
                      setEditingDay(prev => ({ ...prev, name: e.target.value }))
                    } else {
                      setEditingCalendarDate(prev => ({ ...prev, name: e.target.value }))
                    }
                  }}
                  className="input"
                  placeholder="e.g., Push Day, Leg Day..."
                />
              </div>

              {/* Rest Day Toggle (only for weekly) */}
              {editingDay && (
                <div className="flex items-center justify-between">
                  <span className="text-white">Rest Day</span>
                  <button
                    onClick={() => setEditingDay(prev => ({ ...prev, isRestDay: !prev.isRestDay }))}
                    className={`w-12 h-6 rounded-full transition-colors ${editingDay.isRestDay ? 'bg-accent' : 'bg-dark-elevated'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${editingDay.isRestDay ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )}

              {(!editingDay?.isRestDay) && (
                <>
                  {/* Add Exercises Button */}
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Exercises</label>
                    <button
                      onClick={() => setShowCatalogModal(true)}
                      className="btn-secondary w-full flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Exercises
                    </button>
                  </div>

                  {/* Exercise List */}
                  <div className="space-y-2">
                    {currentEditData.exercises.map((exercise, idx) => (
                      <div
                        key={exercise.id || idx}
                        draggable
                        onDragStart={() => setDraggedExerciseIndex(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedExerciseIndex !== null) {
                            moveExercise(draggedExerciseIndex, idx)
                            setDraggedExerciseIndex(null)
                          }
                        }}
                        onDragEnd={() => setDraggedExerciseIndex(null)}
                        className={`card p-3 flex items-center gap-3 cursor-grab active:cursor-grabbing transition-all ${
                          draggedExerciseIndex === idx ? 'opacity-50 scale-95' : ''
                        }`}
                      >
                        {/* Drag Handle */}
                        <div className="text-gray-500 flex-shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                        </div>
                        <span className="text-white font-medium flex-1">{exercise.exerciseName}</span>
                        <button onClick={() => removeExercise(idx)} className="text-error p-1 flex-shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    {currentEditData.exercises.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No exercises added yet</p>
                    )}
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={editingDay ? saveWeeklySchedule : saveCalendarWorkout}
                  className="btn-primary w-full"
                >
                  Save Changes
                </button>

                {editingCalendarDate?.id && (
                  <button
                    onClick={deleteCalendarWorkout}
                    className="btn-secondary w-full text-error border-error/30 hover:bg-error/10"
                  >
                    Remove Custom Workout
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recurring Workout Modal */}
      {editingRecurring && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={() => setEditingRecurring(null)}>
          <div
            className="bg-dark-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-white">
                {editingRecurring.id ? 'Edit Recurring Workout' : 'New Recurring Workout'}
              </h2>
              <button onClick={() => setEditingRecurring(null)} className="btn-ghost p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
              {/* Workout Name */}
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Workout Name</label>
                <input
                  type="text"
                  value={editingRecurring.name}
                  onChange={(e) => setEditingRecurring(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                  placeholder="e.g., Morning Cardio, Daily Stretching..."
                />
              </div>

              {/* Frequency Type */}
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'DAILY', label: 'Daily' },
                    { value: 'SPECIFIC_DAYS', label: 'Specific Days' },
                    { value: 'EVERY_X_DAYS', label: 'Every X Days' }
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setEditingRecurring(prev => ({ ...prev, type: type.value }))}
                      className={`py-2 px-3 rounded-xl text-sm transition-colors ${
                        editingRecurring.type === type.value
                          ? 'bg-accent text-white'
                          : 'bg-dark-elevated text-gray-400 hover:text-white'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Days Selection */}
              {editingRecurring.type === 'SPECIFIC_DAYS' && (
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Select Days</label>
                  <div className="flex gap-2 flex-wrap">
                    {dayShorts.map((day, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          const days = editingRecurring.daysOfWeek.includes(index)
                            ? editingRecurring.daysOfWeek.filter(d => d !== index)
                            : [...editingRecurring.daysOfWeek, index]
                          setEditingRecurring(prev => ({ ...prev, daysOfWeek: days }))
                        }}
                        className={`w-10 h-10 rounded-xl text-sm transition-colors ${
                          editingRecurring.daysOfWeek.includes(index)
                            ? 'bg-accent text-white'
                            : 'bg-dark-elevated text-gray-400 hover:text-white'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Interval Days */}
              {editingRecurring.type === 'EVERY_X_DAYS' && (
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Every X Days</label>
                  <div className="flex items-center gap-3">
                    <span className="text-white">Every</span>
                    <input
                      type="number"
                      min="2"
                      max="30"
                      value={editingRecurring.intervalDays}
                      onChange={(e) => setEditingRecurring(prev => ({ ...prev, intervalDays: parseInt(e.target.value) || 2 }))}
                      className="input w-20 text-center"
                    />
                    <span className="text-white">days</span>
                  </div>
                </div>
              )}

              {/* Skip Rest Days */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Skip Rest Days</p>
                  <p className="text-gray-500 text-sm">Don't show on scheduled rest days</p>
                </div>
                <button
                  onClick={() => setEditingRecurring(prev => ({ ...prev, skipRestDays: !prev.skipRestDays }))}
                  className={`w-12 h-6 rounded-full transition-colors ${editingRecurring.skipRestDays ? 'bg-accent' : 'bg-dark-elevated'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${editingRecurring.skipRestDays ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Exercises */}
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Exercises</label>
                <button
                  onClick={() => setShowCatalogModal(true)}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Exercises
                </button>
              </div>

              {/* Exercise List */}
              <div className="space-y-2">
                {editingRecurring.exercises.map((exercise, idx) => (
                  <div
                    key={exercise.id || idx}
                    draggable
                    onDragStart={() => setDraggedExerciseIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedExerciseIndex !== null) {
                        moveExercise(draggedExerciseIndex, idx)
                        setDraggedExerciseIndex(null)
                      }
                    }}
                    onDragEnd={() => setDraggedExerciseIndex(null)}
                    className={`card p-3 flex items-center gap-3 cursor-grab active:cursor-grabbing transition-all ${
                      draggedExerciseIndex === idx ? 'opacity-50 scale-95' : ''
                    }`}
                  >
                    {/* Drag Handle */}
                    <div className="text-gray-500 flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>
                    <span className="text-white font-medium flex-1">{exercise.exerciseName}</span>
                    <button onClick={() => removeExercise(idx)} className="text-error p-1 flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}

                {editingRecurring.exercises.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No exercises added yet</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={saveRecurringWorkout}
                  disabled={!editingRecurring.name}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {editingRecurring.id ? 'Save Changes' : 'Create Recurring Workout'}
                </button>

                {editingRecurring.id && (
                  <button
                    onClick={deleteRecurringWorkout}
                    className="btn-secondary w-full text-error border-error/30 hover:bg-error/10"
                  >
                    Delete Recurring Workout
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Catalog Modal */}
      {showCatalogModal && (
        <ExerciseCatalogModal
          onClose={() => setShowCatalogModal(false)}
          onAddExercises={addExercisesToDay}
        />
      )}

      {/* AI Chat Widget */}
      <ChatWidget
        context="schedule"
        onWorkoutCreated={(result) => {
          // Refresh the appropriate data when AI creates a workout
          if (result.type === 'weekly') {
            fetchSchedules()
          } else if (result.type === 'calendar') {
            fetchCalendarWorkouts()
          }
        }}
      />
    </div>
  )
}

// Exercise Catalog Modal Component
function ExerciseCatalogModal({ onClose, onAddExercises }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState('')
  const [selectedEquipment, setSelectedEquipment] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')
  const [filterOptions, setFilterOptions] = useState({ muscles: [], equipment: [], levels: [] })
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [selectedExercises, setSelectedExercises] = useState([])
  const [viewingExercise, setViewingExercise] = useState(null)
  const limit = 20

  const muscleGroups = [
    { id: '', label: 'All' },
    { id: 'chest', label: 'Chest' },
    { id: 'back', label: 'Back' },
    { id: 'shoulders', label: 'Shoulders' },
    { id: 'biceps', label: 'Biceps' },
    { id: 'triceps', label: 'Triceps' },
    { id: 'quadriceps', label: 'Quads' },
    { id: 'hamstrings', label: 'Hamstrings' },
    { id: 'glutes', label: 'Glutes' },
    { id: 'calves', label: 'Calves' },
    { id: 'abdominals', label: 'Abs' },
  ]

  const levelColors = {
    beginner: 'bg-success/20 text-success',
    intermediate: 'bg-warning/20 text-warning',
    expert: 'bg-error/20 text-error'
  }

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const response = await api.get('/exercises/filters/options')
        setFilterOptions(response.data)
      } catch (error) {
        console.error('Error fetching filters:', error)
      }
    }
    fetchFilters()
  }, [])

  const fetchExercises = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      })
      if (searchQuery) params.append('search', searchQuery)
      if (selectedMuscle) params.append('muscle', selectedMuscle)
      if (selectedEquipment) params.append('equipment', selectedEquipment)
      if (selectedLevel) params.append('level', selectedLevel)

      const response = await api.get(`/exercises?${params}`)
      setExercises(response.data.exercises)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error fetching exercises:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedMuscle, selectedEquipment, selectedLevel, offset])

  useEffect(() => {
    const debounce = setTimeout(() => {
      setOffset(0)
      fetchExercises()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, selectedMuscle, selectedEquipment, selectedLevel])

  useEffect(() => {
    fetchExercises()
  }, [offset])

  const toggleExerciseSelection = (exercise) => {
    setSelectedExercises(prev => {
      const isSelected = prev.some(e => e.id === exercise.id)
      if (isSelected) {
        return prev.filter(e => e.id !== exercise.id)
      } else {
        return [...prev, exercise]
      }
    })
  }

  const isSelected = (exerciseId) => selectedExercises.some(e => e.id === exerciseId)

  const handleAddSelected = () => {
    if (selectedExercises.length > 0) {
      onAddExercises(selectedExercises)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col" onClick={onClose}>
      <div
        className="bg-dark-card w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-dark-border flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Add Exercises</h2>
            <p className="text-gray-400 text-sm">{total.toLocaleString()} exercises available</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-4 space-y-3 border-b border-dark-border flex-shrink-0">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exercises..."
              className="input pl-12 w-full"
              autoFocus
            />
          </div>

          {/* Muscle Group Pills */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {muscleGroups.map((muscle) => (
              <button
                key={muscle.id}
                onClick={() => setSelectedMuscle(muscle.id)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                  selectedMuscle === muscle.id
                    ? 'bg-accent text-white'
                    : 'bg-dark-elevated text-gray-400 hover:text-white'
                }`}
              >
                {muscle.label}
              </button>
            ))}
          </div>

          {/* Additional Filters */}
          <div className="flex gap-2">
            <select
              value={selectedEquipment}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="input flex-1 text-sm"
            >
              <option value="">All Equipment</option>
              {filterOptions.equipment?.map(eq => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="input flex-1 text-sm"
            >
              <option value="">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
          </div>
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {exercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className={`card flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected(exercise.id) ? 'ring-2 ring-accent bg-accent/10' : 'hover:bg-dark-elevated'
                  }`}
                  onClick={() => toggleExerciseSelection(exercise)}
                >
                  {/* Checkbox */}
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected(exercise.id) ? 'bg-accent border-accent' : 'border-gray-500'
                  }`}>
                    {isSelected(exercise.id) && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {/* Exercise Image */}
                  <div className="w-14 h-14 rounded-xl bg-dark-elevated flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {exercise.images?.[0] ? (
                      <img
                        src={`/api/exercise-images/${exercise.images[0]}`}
                        alt={exercise.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    ) : (
                      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate">{exercise.name}</h3>
                    <p className="text-gray-400 text-sm capitalize truncate">
                      {exercise.primaryMuscles?.join(', ')} {exercise.equipment && `• ${exercise.equipment}`}
                    </p>
                  </div>

                  {/* Level Badge - hidden on mobile */}
                  {exercise.level && (
                    <span className={`hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${levelColors[exercise.level] || 'bg-gray-500/20 text-gray-400'}`}>
                      {exercise.level}
                    </span>
                  )}

                  {/* View Details */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setViewingExercise(exercise)
                    }}
                    className="btn-ghost p-2 text-gray-400 hover:text-white flex-shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              ))}

              {exercises.length === 0 && !loading && (
                <p className="text-gray-500 text-center py-8">No exercises found</p>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && total > limit && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="btn-secondary px-4 py-2 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="flex items-center text-gray-400 px-4">
                {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="btn-secondary px-4 py-2 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Selected Count and Add Button */}
        <div className="p-4 border-t border-dark-border flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <p className="text-gray-400">
              {selectedExercises.length > 0
                ? `${selectedExercises.length} exercise${selectedExercises.length > 1 ? 's' : ''} selected`
                : 'Select exercises to add'
              }
            </p>
            <button
              onClick={handleAddSelected}
              disabled={selectedExercises.length === 0}
              className="btn-primary px-6 disabled:opacity-50"
            >
              Add Selected
            </button>
          </div>
        </div>
      </div>

      {/* Exercise Detail View */}
      {viewingExercise && (
        <ExerciseQuickView
          exercise={viewingExercise}
          onClose={() => setViewingExercise(null)}
          isSelected={isSelected(viewingExercise.id)}
          onToggleSelect={() => toggleExerciseSelection(viewingExercise)}
        />
      )}
    </div>
  )
}

// Quick View for exercise details
function ExerciseQuickView({ exercise, onClose, isSelected, onToggleSelect }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[70] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-dark-card w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white truncate pr-4">{exercise.name}</h2>
          <button onClick={onClose} className="btn-ghost p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Image */}
          <div className="aspect-video bg-dark-elevated rounded-xl overflow-hidden flex items-center justify-center relative">
            {exercise.images?.length > 0 ? (
              <>
                <img
                  src={`/api/exercise-images/${exercise.images[currentImageIndex]}`}
                  alt={exercise.name}
                  className="w-full h-full object-contain bg-dark-elevated"
                />
                {exercise.images.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImageIndex(prev => prev === 0 ? exercise.images.length - 1 : prev - 1)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentImageIndex(prev => prev === exercise.images.length - 1 ? 0 : prev + 1)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
              </>
            ) : (
              <svg className="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>

          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-2">
            <div className="card p-2">
              <p className="text-gray-400 text-xs">Muscles</p>
              <p className="text-white text-sm capitalize">{exercise.primaryMuscles?.join(', ')}</p>
            </div>
            <div className="card p-2">
              <p className="text-gray-400 text-xs">Equipment</p>
              <p className="text-white text-sm capitalize">{exercise.equipment || 'Body Only'}</p>
            </div>
            <div className="card p-2">
              <p className="text-gray-400 text-xs">Level</p>
              <p className="text-white text-sm capitalize">{exercise.level}</p>
            </div>
            <div className="card p-2">
              <p className="text-gray-400 text-xs">Category</p>
              <p className="text-white text-sm capitalize">{exercise.category}</p>
            </div>
          </div>

          {/* Instructions */}
          {exercise.instructions?.length > 0 && (
            <div>
              <h3 className="text-white font-medium mb-2">Instructions</h3>
              <ol className="space-y-2">
                {exercise.instructions.slice(0, 4).map((step, idx) => (
                  <li key={idx} className="flex gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs flex-shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-gray-300">{step}</p>
                  </li>
                ))}
                {exercise.instructions.length > 4 && (
                  <p className="text-gray-500 text-sm pl-7">+{exercise.instructions.length - 4} more steps</p>
                )}
              </ol>
            </div>
          )}

          {/* Add/Remove Button */}
          <button
            onClick={onToggleSelect}
            className={`w-full py-3 rounded-xl font-medium transition-colors ${
              isSelected
                ? 'bg-error/20 text-error border border-error/30'
                : 'bg-accent text-white'
            }`}
          >
            {isSelected ? 'Remove from Selection' : 'Add to Selection'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Schedule
