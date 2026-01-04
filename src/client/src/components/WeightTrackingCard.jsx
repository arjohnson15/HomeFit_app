import { useState, useEffect } from 'react'
import api from '../services/api'

export default function WeightTrackingCard({ weightUnit = 'LBS', onWeightLogged }) {
  const [weight, setWeight] = useState('')
  const [todayWeight, setTodayWeight] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchTodayWeight()
  }, [])

  const fetchTodayWeight = async () => {
    try {
      const response = await api.get('/nutrition/weight-log/today')
      setTodayWeight(response.data.entry)
    } catch (error) {
      console.error('Error fetching today weight:', error)
    } finally {
      setLoading(false)
    }
  }

  const convertToKg = (value) => {
    if (weightUnit === 'KG') return parseFloat(value)
    return parseFloat(value) / 2.205
  }

  const logWeight = async () => {
    if (!weight) return
    setSaving(true)
    try {
      const weightKg = convertToKg(weight)
      await api.post('/nutrition/weight-log', { weightKg })
      setTodayWeight({ weightKg })
      setWeight('')
      onWeightLogged?.()
    } catch (error) {
      console.error('Error logging weight:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      logWeight()
    }
  }

  // Don't show anything while loading
  if (loading) {
    return null
  }

  // Don't show if weight is already logged today
  if (todayWeight) {
    return null
  }

  return (
    <div className="card p-4 bg-gradient-to-r from-blue-500/10 to-blue-600/5 border border-blue-500/20">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">Log Today's Weight</h3>
            <p className="text-gray-500 text-xs">Track your progress daily</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="0.0"
              className="bg-dark-elevated text-white text-center font-medium rounded-xl px-3 py-2 w-20 border border-blue-500/30 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              step="0.1"
            />
          </div>
          <span className="text-gray-400 text-sm font-medium">{weightUnit.toLowerCase()}</span>
          <button
            onClick={logWeight}
            disabled={saving || !weight}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/30 disabled:text-blue-300/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Log'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
