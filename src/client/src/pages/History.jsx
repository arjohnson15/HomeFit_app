import { useState, useEffect } from 'react'
import api from '../services/api'
import HistoryCalendar from '../components/HistoryCalendar'
import HistoryCharts from '../components/HistoryCharts'
import EditWorkoutModal from '../components/EditWorkoutModal'

function History() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('historyTab') || 'charts'
  })
  const [timeRange, setTimeRange] = useState('month')
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
    localStorage.setItem('historyTab', activeTab)
  }, [activeTab])

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

  const handleWorkoutUpdate = (updatedWorkout) => {
    setWorkouts(prev => prev.map(w => w.id === updatedWorkout.id ? updatedWorkout : w))
    setSelectedWorkout(updatedWorkout)
  }

  const handleWorkoutDelete = (workoutId) => {
    setWorkouts(prev => prev.filter(w => w.id !== workoutId))
    setSelectedWorkout(null)
  }

  const tabs = [
    { id: 'calendar', label: 'Calendar', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )},
    { id: 'list', label: 'List', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    )},
    { id: 'charts', label: 'Charts', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )}
  ]

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">History</h1>
        <p className="text-gray-400">Track your progress</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-dark-elevated p-1 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-accent text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-dark-card'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Time Range Filter - shown for List and Charts */}
      {activeTab !== 'calendar' && (
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
      )}

      {/* Calendar View */}
      {activeTab === 'calendar' && (
        <HistoryCalendar
          onSelectWorkout={setSelectedWorkout}
          formatDuration={formatDuration}
          formatVolume={formatVolume}
        />
      )}

      {/* List View */}
      {activeTab === 'list' && (
        <>
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
        </>
      )}

      {/* Charts View */}
      {activeTab === 'charts' && (
        <HistoryCharts
          workouts={workouts}
          loading={loading}
          timeRange={timeRange}
          formatDuration={formatDuration}
          formatVolume={formatVolume}
        />
      )}

      {/* Editable Workout Modal */}
      {selectedWorkout && (
        <EditWorkoutModal
          workout={selectedWorkout}
          onClose={() => setSelectedWorkout(null)}
          onUpdate={handleWorkoutUpdate}
          onDelete={handleWorkoutDelete}
          formatDuration={formatDuration}
          formatVolume={formatVolume}
          formatDate={formatDate}
        />
      )}
    </div>
  )
}

export default History
