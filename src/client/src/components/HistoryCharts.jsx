import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const COLORS = ['#0a84ff', '#30d158', '#ffd60a', '#ff453a', '#bf5af2', '#64d2ff']

function HistoryCharts({ workouts, loading, timeRange, formatDuration, formatVolume }) {
  const [enabledCharts, setEnabledCharts] = useState(() => {
    const saved = localStorage.getItem('historyChartsEnabled')
    return saved ? JSON.parse(saved) : {
      volume: true,
      frequency: true,
      duration: true,
      exercises: true,
      muscleGroups: false
    }
  })

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [customChart, setCustomChart] = useState({
    dataSource: 'volume',
    chartType: 'bar',
    groupBy: 'day'
  })

  useEffect(() => {
    localStorage.setItem('historyChartsEnabled', JSON.stringify(enabledCharts))
  }, [enabledCharts])

  const toggleChart = (chartId) => {
    setEnabledCharts(prev => ({
      ...prev,
      [chartId]: !prev[chartId]
    }))
  }

  // Process workout data for charts
  const chartData = useMemo(() => {
    if (!workouts || workouts.length === 0) return null

    // Sort workouts by date
    const sortedWorkouts = [...workouts].sort((a, b) => new Date(a.date) - new Date(b.date))

    // Volume over time
    const volumeData = sortedWorkouts.map(workout => {
      let volume = 0
      workout.exerciseLogs?.forEach(log => {
        log.sets?.forEach(set => {
          if (set.weight && set.reps) {
            volume += set.weight * set.reps
          }
        })
      })
      return {
        date: new Date(workout.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        volume,
        name: workout.name
      }
    })

    // Duration over time
    const durationData = sortedWorkouts.map(workout => ({
      date: new Date(workout.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      duration: Math.round((workout.duration || 0) / 60),
      name: workout.name
    }))

    // Workout frequency by day of week
    const frequencyByDay = [0, 0, 0, 0, 0, 0, 0]
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    sortedWorkouts.forEach(workout => {
      const day = new Date(workout.date).getDay()
      frequencyByDay[day]++
    })
    const frequencyData = dayNames.map((name, idx) => ({
      day: name,
      count: frequencyByDay[idx]
    }))

    // Exercise breakdown (pie chart)
    const exerciseCounts = {}
    sortedWorkouts.forEach(workout => {
      workout.exerciseLogs?.forEach(log => {
        const name = log.exerciseName || 'Unknown'
        exerciseCounts[name] = (exerciseCounts[name] || 0) + 1
      })
    })
    const exerciseData = Object.entries(exerciseCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    // Weekly summary
    const weeklyData = {}
    sortedWorkouts.forEach(workout => {
      const date = new Date(workout.date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { week: weekKey, workouts: 0, volume: 0, duration: 0 }
      }

      weeklyData[weekKey].workouts++
      weeklyData[weekKey].duration += Math.round((workout.duration || 0) / 60)

      workout.exerciseLogs?.forEach(log => {
        log.sets?.forEach(set => {
          if (set.weight && set.reps) {
            weeklyData[weekKey].volume += set.weight * set.reps
          }
        })
      })
    })
    const weeklyChartData = Object.values(weeklyData)

    return {
      volume: volumeData,
      duration: durationData,
      frequency: frequencyData,
      exercises: exerciseData,
      weekly: weeklyChartData
    }
  }, [workouts])

  // Custom chart data based on settings
  const customChartData = useMemo(() => {
    if (!chartData) return []

    switch (customChart.dataSource) {
      case 'volume':
        return chartData.volume
      case 'duration':
        return chartData.duration
      case 'frequency':
        return chartData.frequency
      case 'weekly':
        return chartData.weekly
      default:
        return chartData.volume
    }
  }, [chartData, customChart.dataSource])

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-card border border-dark-border p-3 rounded-lg shadow-lg">
          <p className="text-white font-medium">{label}</p>
          {payload.map((entry, idx) => (
            <p key={idx} className="text-gray-400 text-sm">
              <span style={{ color: entry.color }}>{entry.name}: </span>
              {entry.name === 'volume' ? formatVolume(entry.value) :
               entry.name === 'duration' ? `${entry.value}m` :
               entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!workouts || workouts.length === 0) {
    return (
      <div className="card text-center py-8">
        <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-gray-400">No workout data yet</p>
        <p className="text-gray-500 text-sm mt-1">Complete some workouts to see charts</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Chart Toggle */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium">Charts</h3>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-accent text-sm hover:underline"
          >
            {showAdvanced ? 'Hide Advanced' : 'Advanced'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'volume', label: 'Volume' },
            { id: 'frequency', label: 'Frequency' },
            { id: 'duration', label: 'Duration' },
            { id: 'exercises', label: 'Exercises' }
          ].map(chart => (
            <button
              key={chart.id}
              onClick={() => toggleChart(chart.id)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                enabledCharts[chart.id]
                  ? 'bg-accent text-white'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              {chart.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Mode */}
      {showAdvanced && (
        <div className="card">
          <h3 className="text-white font-medium mb-4">Custom Chart</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Data Source</label>
              <select
                value={customChart.dataSource}
                onChange={(e) => setCustomChart(prev => ({ ...prev, dataSource: e.target.value }))}
                className="input w-full"
              >
                <option value="volume">Volume</option>
                <option value="duration">Duration</option>
                <option value="frequency">Frequency by Day</option>
                <option value="weekly">Weekly Summary</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Chart Type</label>
              <select
                value={customChart.chartType}
                onChange={(e) => setCustomChart(prev => ({ ...prev, chartType: e.target.value }))}
                className="input w-full"
              >
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="area">Area Chart</option>
              </select>
            </div>
          </div>

          {/* Custom Chart Render */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {customChart.chartType === 'bar' ? (
                <BarChart data={customChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#38383a" />
                  <XAxis
                    dataKey={customChart.dataSource === 'frequency' ? 'day' : customChart.dataSource === 'weekly' ? 'week' : 'date'}
                    stroke="#8e8e93"
                    fontSize={12}
                  />
                  <YAxis stroke="#8e8e93" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey={customChart.dataSource === 'frequency' ? 'count' : customChart.dataSource === 'weekly' ? 'workouts' : customChart.dataSource}
                    fill="#0a84ff"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              ) : customChart.chartType === 'line' ? (
                <LineChart data={customChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#38383a" />
                  <XAxis
                    dataKey={customChart.dataSource === 'frequency' ? 'day' : customChart.dataSource === 'weekly' ? 'week' : 'date'}
                    stroke="#8e8e93"
                    fontSize={12}
                  />
                  <YAxis stroke="#8e8e93" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey={customChart.dataSource === 'frequency' ? 'count' : customChart.dataSource === 'weekly' ? 'workouts' : customChart.dataSource}
                    stroke="#0a84ff"
                    strokeWidth={2}
                    dot={{ fill: '#0a84ff', r: 4 }}
                  />
                </LineChart>
              ) : (
                <AreaChart data={customChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#38383a" />
                  <XAxis
                    dataKey={customChart.dataSource === 'frequency' ? 'day' : customChart.dataSource === 'weekly' ? 'week' : 'date'}
                    stroke="#8e8e93"
                    fontSize={12}
                  />
                  <YAxis stroke="#8e8e93" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={customChart.dataSource === 'frequency' ? 'count' : customChart.dataSource === 'weekly' ? 'workouts' : customChart.dataSource}
                    stroke="#0a84ff"
                    fill="#0a84ff"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Volume Chart */}
      {enabledCharts.volume && chartData?.volume && (
        <div className="card">
          <h3 className="text-white font-medium mb-4">Volume Over Time</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.volume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#38383a" />
                <XAxis dataKey="date" stroke="#8e8e93" fontSize={10} />
                <YAxis stroke="#8e8e93" fontSize={10} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="volume" fill="#0a84ff" radius={[4, 4, 0, 0]} name="volume" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Frequency Chart */}
      {enabledCharts.frequency && chartData?.frequency && (
        <div className="card">
          <h3 className="text-white font-medium mb-4">Workout Frequency</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.frequency}>
                <CartesianGrid strokeDasharray="3 3" stroke="#38383a" />
                <XAxis dataKey="day" stroke="#8e8e93" fontSize={12} />
                <YAxis stroke="#8e8e93" fontSize={12} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#30d158" radius={[4, 4, 0, 0]} name="workouts" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Duration Chart */}
      {enabledCharts.duration && chartData?.duration && (
        <div className="card">
          <h3 className="text-white font-medium mb-4">Duration Trends</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.duration}>
                <CartesianGrid strokeDasharray="3 3" stroke="#38383a" />
                <XAxis dataKey="date" stroke="#8e8e93" fontSize={10} />
                <YAxis stroke="#8e8e93" fontSize={10} unit="m" />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="duration"
                  stroke="#ffd60a"
                  strokeWidth={2}
                  dot={{ fill: '#ffd60a', r: 3 }}
                  name="duration"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Exercise Breakdown */}
      {enabledCharts.exercises && chartData?.exercises && chartData.exercises.length > 0 && (
        <div className="card">
          <h3 className="text-white font-medium mb-4">Top Exercises</h3>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.exercises}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name.substring(0, 10)}${name.length > 10 ? '...' : ''} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {chartData.exercises.map((entry, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {chartData.exercises.map((entry, idx) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-sm">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="text-gray-400">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Summary Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-dark-elevated rounded-lg">
            <p className="text-gray-400 text-sm">Total Workouts</p>
            <p className="text-2xl font-bold text-white">{workouts.length}</p>
          </div>
          <div className="text-center p-3 bg-dark-elevated rounded-lg">
            <p className="text-gray-400 text-sm">Total Volume</p>
            <p className="text-2xl font-bold text-white">
              {formatVolume(chartData?.volume?.reduce((sum, d) => sum + d.volume, 0) || 0)}
            </p>
          </div>
          <div className="text-center p-3 bg-dark-elevated rounded-lg">
            <p className="text-gray-400 text-sm">Avg Duration</p>
            <p className="text-2xl font-bold text-white">
              {Math.round((chartData?.duration?.reduce((sum, d) => sum + d.duration, 0) || 0) / workouts.length)}m
            </p>
          </div>
          <div className="text-center p-3 bg-dark-elevated rounded-lg">
            <p className="text-gray-400 text-sm">Most Active Day</p>
            <p className="text-2xl font-bold text-white">
              {chartData?.frequency?.reduce((max, d) => d.count > max.count ? d : max, { day: '-', count: 0 }).day}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HistoryCharts
