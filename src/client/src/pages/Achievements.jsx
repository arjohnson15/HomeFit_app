import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

const CATEGORIES = [
  { id: 'ALL', label: 'All', icon: '🎯' },
  { id: 'WORKOUT', label: 'Workout', icon: '💪' },
  { id: 'STREAK', label: 'Streak', icon: '🔥' },
  { id: 'PR', label: 'PRs', icon: '🏆' },
  { id: 'TIME', label: 'Time', icon: '⏱️' },
  { id: 'NUTRITION', label: 'Nutrition', icon: '🥗' },
  { id: 'SOCIAL', label: 'Social', icon: '🤝' }
]

const RARITY_STYLES = {
  COMMON: {
    border: 'border-gray-500',
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    glow: ''
  },
  UNCOMMON: {
    border: 'border-green-500',
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    glow: ''
  },
  RARE: {
    border: 'border-blue-500',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    glow: ''
  },
  EPIC: {
    border: 'border-purple-500',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/30 shadow-lg'
  },
  LEGENDARY: {
    border: 'border-yellow-500',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    glow: 'shadow-yellow-500/50 shadow-lg animate-pulse'
  }
}

function Achievements() {
  const [achievements, setAchievements] = useState([])
  const [summary, setSummary] = useState({ unlocked: 0, total: 0, totalPoints: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('ALL')

  useEffect(() => {
    fetchAchievements()
  }, [])

  const fetchAchievements = async () => {
    try {
      const response = await api.get('/achievements')
      setAchievements(response.data.allAchievements || [])
      setSummary(response.data.summary || { unlocked: 0, total: 0, totalPoints: 0 })
    } catch (error) {
      console.error('Error fetching achievements:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAchievements = selectedCategory === 'ALL'
    ? achievements
    : achievements.filter(a => a.category === selectedCategory)

  // Sort: unlocked first, then by progress percentage
  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    if (a.isUnlocked && !b.isUnlocked) return -1
    if (!a.isUnlocked && b.isUnlocked) return 1
    return b.progressPercent - a.progressPercent
  })

  const getRarityStyle = (rarity) => {
    return RARITY_STYLES[rarity] || RARITY_STYLES.COMMON
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/profile" className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">Achievements</h1>
      </div>

      {/* Summary Card */}
      <div className="card bg-gradient-to-r from-accent/20 to-purple-500/20 border border-accent/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Progress</p>
            <p className="text-3xl font-bold text-white">
              {summary.unlocked} <span className="text-gray-500 text-xl">/ {summary.total}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Total Points</p>
            <p className="text-3xl font-bold text-yellow-400">{summary.totalPoints}</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-3 bg-dark-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${summary.total > 0 ? (summary.unlocked / summary.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-gray-500 text-sm mt-2 text-center">
            {Math.round((summary.unlocked / summary.total) * 100) || 0}% Complete
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 transition-colors ${
              selectedCategory === cat.id
                ? 'bg-accent text-white'
                : 'bg-dark-card text-gray-400 hover:bg-dark-elevated'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Achievements Grid */}
      <div className="grid gap-4">
        {sortedAchievements.map(achievement => {
          const rarityStyle = getRarityStyle(achievement.rarity)
          const isUnlocked = achievement.isUnlocked

          return (
            <div
              key={achievement.id}
              className={`card relative overflow-hidden transition-all duration-300 ${
                isUnlocked
                  ? `border-2 ${rarityStyle.border} ${rarityStyle.glow}`
                  : 'border border-dark-border opacity-60'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`text-4xl p-3 rounded-xl ${
                  isUnlocked ? rarityStyle.bg : 'bg-dark-elevated grayscale'
                }`}>
                  {achievement.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className={`font-bold ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                        {achievement.name}
                      </h3>
                      <p className="text-gray-500 text-sm">{achievement.description}</p>
                    </div>
                    {/* Points Badge */}
                    <div className={`px-2 py-1 rounded-lg text-sm font-bold ${
                      isUnlocked ? 'bg-yellow-500/20 text-yellow-400' : 'bg-dark-elevated text-gray-500'
                    }`}>
                      +{achievement.points}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={rarityStyle.text}>{achievement.rarity}</span>
                      <span className="text-gray-500">
                        {achievement.currentProgress} / {achievement.threshold}
                      </span>
                    </div>
                    <div className="h-2 bg-dark-elevated rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isUnlocked
                            ? 'bg-gradient-to-r from-accent to-green-500'
                            : 'bg-gray-600'
                        }`}
                        style={{ width: `${achievement.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Unlock Date */}
                  {isUnlocked && achievement.unlockedAt && (
                    <p className="text-green-500 text-xs mt-2 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Unlocked {formatDate(achievement.unlockedAt)}
                    </p>
                  )}
                </div>
              </div>

              {/* Locked Overlay */}
              {!isUnlocked && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              )}
            </div>
          )
        })}

        {sortedAchievements.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-400 text-lg">No achievements in this category</p>
          </div>
        )}
      </div>

      {/* Rarity Legend */}
      <div className="card">
        <h3 className="text-white font-medium mb-3">Rarity Legend</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(RARITY_STYLES).map(([rarity, style]) => (
            <div key={rarity} className={`flex items-center gap-2 px-3 py-1 rounded-lg ${style.bg} border ${style.border}`}>
              <span className={`text-sm ${style.text}`}>{rarity}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Achievements
