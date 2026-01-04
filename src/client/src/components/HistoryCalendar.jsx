import { useState, useEffect } from 'react'
import api from '../services/api'

function HistoryCalendar({ onSelectWorkout, formatDuration, formatVolume }) {
  const [workouts, setWorkouts] = useState([])
  const [workoutDates, setWorkoutDates] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedDayWorkouts, setSelectedDayWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [monthsToShow, setMonthsToShow] = useState(3)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => {
    fetchWorkouts()
  }, [monthsToShow])

  const fetchWorkouts = async () => {
    setLoading(true)
    try {
      // Fetch workouts for the past N months
      const endDate = new Date()
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - monthsToShow + 1)
      startDate.setDate(1)

      const response = await api.get(`/workouts?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&limit=500`)
      const workoutData = response.data.workouts || []
      setWorkouts(workoutData)

      // Group workouts by date
      const dateMap = {}
      workoutData.forEach(workout => {
        const date = new Date(workout.date)
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        if (!dateMap[dateKey]) {
          dateMap[dateKey] = []
        }
        dateMap[dateKey].push(workout)
      })
      setWorkoutDates(dateMap)
    } catch (error) {
      console.error('Error fetching workouts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDateClick = (date) => {
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const dayWorkouts = workoutDates[dateKey] || []

    if (selectedDate && date.toDateString() === selectedDate.toDateString()) {
      // Clicking same date again - deselect
      setSelectedDate(null)
      setSelectedDayWorkouts([])
    } else {
      setSelectedDate(date)
      setSelectedDayWorkouts(dayWorkouts)
    }
  }

  const getMonthsArray = () => {
    const months = []
    const current = new Date()

    for (let i = 0; i < monthsToShow; i++) {
      const date = new Date(current.getFullYear(), current.getMonth() - i, 1)
      months.push(date)
    }

    return months.reverse()
  }

  const getDaysInMonth = (year, month) => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay()

    const days = []

    // Previous month overflow
    for (let i = startOffset - 1; i >= 0; i--) {
      const date = new Date(year, month, -i)
      days.push({ date, isCurrentMonth: false })
    }

    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i)
      days.push({ date, isCurrentMonth: true })
    }

    // Fill to complete the grid (up to 35 or 42 days)
    const totalCells = days.length <= 35 ? 35 : 42
    const remaining = totalCells - days.length
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i)
      days.push({ date, isCurrentMonth: false })
    }

    return days
  }

  const isToday = (date) => {
    return date.toDateString() === today.toDateString()
  }

  const isSelected = (date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString()
  }

  const getWorkoutsForDate = (date) => {
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    return workoutDates[dateKey] || []
  }

  const formatFullDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const months = getMonthsArray()

  return (
    <div className="space-y-4">
      {/* Month Range Selector */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {[3, 6, 12].map((num) => (
          <button
            key={num}
            onClick={() => setMonthsToShow(num)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              monthsToShow === num
                ? 'bg-accent text-white'
                : 'bg-dark-elevated text-gray-400 hover:text-white'
            }`}
          >
            {num} Months
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Multi-Month Calendar Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {months.map((monthDate) => {
              const year = monthDate.getFullYear()
              const month = monthDate.getMonth()
              const days = getDaysInMonth(year, month)
              const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

              return (
                <div key={monthName} className="card p-3">
                  <h3 className="text-white font-medium text-center mb-2 text-sm">{monthName}</h3>

                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <div key={i} className="text-center text-[10px] text-gray-500 font-medium py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-0.5">
                    {days.map(({ date, isCurrentMonth }, idx) => {
                      const dateWorkouts = getWorkoutsForDate(date)
                      const hasWorkouts = dateWorkouts.length > 0
                      const isDateToday = isToday(date)
                      const isDateSelected = isSelected(date)

                      return (
                        <button
                          key={idx}
                          onClick={() => handleDateClick(date)}
                          className={`
                            relative aspect-square flex items-center justify-center rounded
                            transition-all text-xs
                            ${!isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}
                            ${isDateToday ? 'ring-1 ring-accent' : ''}
                            ${isDateSelected ? 'bg-accent text-white' : hasWorkouts ? 'bg-accent/20 text-white' : 'hover:bg-dark-elevated'}
                          `}
                        >
                          <span className={isDateToday && !isDateSelected ? 'text-accent font-bold' : ''}>
                            {date.getDate()}
                          </span>
                          {hasWorkouts && !isDateSelected && (
                            <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-accent" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Selected Day Workouts */}
          {selectedDate && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium">
                  {formatFullDate(selectedDate)}
                </h3>
                <button
                  onClick={() => { setSelectedDate(null); setSelectedDayWorkouts([]) }}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {selectedDayWorkouts.length === 0 ? (
                <div className="card text-center py-4">
                  <p className="text-gray-400 text-sm">No workouts on this day</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDayWorkouts.map((workout) => {
                    let volume = 0
                    let exerciseCount = workout.exerciseLogs?.length || 0
                    workout.exerciseLogs?.forEach(log => {
                      log.sets?.forEach(set => {
                        if (set.weight && set.reps) {
                          volume += set.weight * set.reps
                        }
                      })
                    })

                    return (
                      <div
                        key={workout.id}
                        className="card cursor-pointer hover:bg-dark-elevated transition-colors"
                        onClick={() => onSelectWorkout(workout)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-white font-medium">{workout.name}</h4>
                          <span className="text-accent text-sm">
                            {new Date(workout.startTime).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="flex gap-3 text-sm">
                          <span className="text-gray-400">
                            <span className="text-white">{formatDuration(workout.duration)}</span>
                          </span>
                          <span className="text-gray-400">
                            <span className="text-white">{exerciseCount}</span> exercises
                          </span>
                          {volume > 0 && (
                            <span className="text-gray-400">
                              <span className="text-white">{formatVolume(volume)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Summary stats */}
          {!selectedDate && (
            <div className="card">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-gray-400 text-xs">Total Workouts</p>
                  <p className="text-xl font-bold text-white">{workouts.length}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Active Days</p>
                  <p className="text-xl font-bold text-white">{Object.keys(workoutDates).length}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Avg/Week</p>
                  <p className="text-xl font-bold text-white">
                    {(workouts.length / (monthsToShow * 4.33)).toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default HistoryCalendar
