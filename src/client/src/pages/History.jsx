import { useState, useEffect } from 'react'
import api from '../services/api'

function History() {
  const [timeRange, setTimeRange] = useState('week')
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalTime: 0,
    totalVolume: 0,
    avgDuration: 0
  })
  const [selectedWorkout, setSelectedWorkout] = useState(null)

  useEffect(() => {
    fetchWorkouts()
  }, [timeRange])

  const getDateRange = () => {
    const now = new Date()
    let startDate = new Date()

    switch (timeRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(now.getMonth() - 1)
        break
      case '3months':
        startDate.setMonth(now.getMonth() - 3)
        break
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      case 'all':
        startDate = new Date('2020-01-01')
        break
    }

    return { startDate: startDate.toISOString(), endDate: now.toISOString() }
  }

  const fetchWorkouts = async () => {
    setLoading(true)
    try {
      const { startDate, endDate } = getDateRange()
      const response = await api.get(`/workouts?startDate=${startDate}&endDate=${endDate}&limit=100`)
      const workoutData = response.data.workouts || []
      setWorkouts(workoutData)

      // Calculate stats
      let totalTime = 0
      let totalVolume = 0

      workoutData.forEach(workout => {
        totalTime += workout.duration || 0
        workout.exerciseLogs?.forEach(log => {
          log.sets?.forEach(set => {
            if (set.weight && set.reps) {
              totalVolume += set.weight * set.reps
            }
          })
        })
      })

      setStats({
        totalWorkouts: workoutData.length,
        totalTime,
        totalVolume,
        avgDuration: workoutData.length > 0 ? Math.round(totalTime / workoutData.length) : 0
      })
    } catch (error) {
      console.error('Error fetching workouts:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0m'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatVolume = (lbs) => {
    if (lbs >= 1000000) {
      return `${(lbs / 1000000).toFixed(1)}M lbs`
    }
    if (lbs >= 1000) {
      return `${(lbs / 1000).toFixed(1)}k lbs`
    }
    return `${lbs.toLocaleString()} lbs`
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">History</h1>
        <p className="text-gray-400">Track your progress</p>
      </div>

      {/* Time Range Filter */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {['week', 'month', '3months', 'year', 'all'].map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              timeRange === range
                ? 'bg-accent text-white'
                : 'bg-dark-elevated text-gray-400 hover:text-white'
            }`}
          >
            {range === 'week' ? 'This Week' :
             range === 'month' ? 'This Month' :
             range === '3months' ? '3 Months' :
             range === 'year' ? 'This Year' : 'All Time'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <p className="text-gray-400 text-sm">Workouts</p>
              <p className="text-2xl font-bold text-white">{stats.totalWorkouts}</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Total Time</p>
              <p className="text-2xl font-bold text-white">{formatDuration(stats.totalTime)}</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Total Volume</p>
              <p className="text-2xl font-bold text-white">{formatVolume(stats.totalVolume)}</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Avg Duration</p>
              <p className="text-2xl font-bold text-white">{formatDuration(stats.avgDuration)}</p>
            </div>
          </div>

          {/* Volume Chart Placeholder */}
          <div className="card">
            <h3 className="text-white font-medium mb-4">Volume Over Time</h3>
            <div className="h-32 flex items-end justify-between gap-1">
              {workouts.slice(-14).map((workout, idx) => {
                let volume = 0
                workout.exerciseLogs?.forEach(log => {
                  log.sets?.forEach(set => {
                    if (set.weight && set.reps) {
                      volume += set.weight * set.reps
                    }
                  })
                })
                const maxVolume = Math.max(...workouts.map(w => {
                  let v = 0
                  w.exerciseLogs?.forEach(log => {
                    log.sets?.forEach(set => {
                      if (set.weight && set.reps) v += set.weight * set.reps
                    })
                  })
                  return v
                }), 1)
                const height = (volume / maxVolume) * 100

                return (
                  <div
                    key={workout.id || idx}
                    className="flex-1 bg-accent/30 rounded-t-sm transition-all hover:bg-accent/50"
                    style={{ height: `${Math.max(height, 5)}%` }}
                    title={`${formatDate(workout.date)}: ${formatVolume(volume)}`}
                  />
                )
              })}
              {workouts.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  No data yet
                </div>
              )}
            </div>
          </div>

          {/* Workout History List */}
          <div>
            <h3 className="text-white font-medium mb-3">Recent Workouts</h3>
            {workouts.length === 0 ? (
              <div className="card text-center py-8">
                <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-gray-400">No workouts yet</p>
                <p className="text-gray-500 text-sm mt-1">Complete your first workout to see it here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workouts.map((workout) => {
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
                      onClick={() => setSelectedWorkout(workout)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium">{workout.name}</h4>
                        <span className="text-gray-400 text-sm">{formatDate(workout.date)}</span>
                      </div>
                      <div className="flex gap-4 text-sm">
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
        </>
      )}

      {/* Workout Detail Modal */}
      {selectedWorkout && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={() => setSelectedWorkout(null)}>
          <div
            className="bg-dark-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedWorkout.name}</h2>
                <p className="text-gray-400 text-sm">{formatDate(selectedWorkout.date)}</p>
              </div>
              <button onClick={() => setSelectedWorkout(null)} className="btn-ghost p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="card text-center">
                  <p className="text-gray-400 text-xs">Duration</p>
                  <p className="text-lg font-bold text-white">{formatDuration(selectedWorkout.duration)}</p>
                </div>
                <div className="card text-center">
                  <p className="text-gray-400 text-xs">Exercises</p>
                  <p className="text-lg font-bold text-white">{selectedWorkout.exerciseLogs?.length || 0}</p>
                </div>
                <div className="card text-center">
                  <p className="text-gray-400 text-xs">Rating</p>
                  <p className="text-lg font-bold text-white">{selectedWorkout.rating || '-'}/5</p>
                </div>
              </div>

              {/* Exercise Details */}
              <div>
                <h3 className="text-white font-medium mb-3">Exercises</h3>
                <div className="space-y-3">
                  {selectedWorkout.exerciseLogs?.map((log, idx) => (
                    <div key={log.id || idx} className="card">
                      <h4 className="text-white font-medium mb-2">{log.exerciseName}</h4>
                      {log.sets?.length > 0 ? (
                        <div className="space-y-1">
                          {log.sets.map((set, setIdx) => (
                            <div key={set.id || setIdx} className="flex justify-between text-sm">
                              <span className="text-gray-400">Set {setIdx + 1}</span>
                              <span className="text-white">
                                {set.weight ? `${set.weight} lbs × ` : ''}{set.reps || '-'} reps
                                {set.rpe && <span className="text-gray-400 ml-2">RPE {set.rpe}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No sets logged</p>
                      )}
                    </div>
                  ))}

                  {(!selectedWorkout.exerciseLogs || selectedWorkout.exerciseLogs.length === 0) && (
                    <p className="text-gray-500 text-center py-4">No exercises logged</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedWorkout.notes && (
                <div>
                  <h3 className="text-white font-medium mb-2">Notes</h3>
                  <p className="text-gray-400">{selectedWorkout.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default History
