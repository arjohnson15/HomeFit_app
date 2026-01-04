import { useState, useEffect } from 'react'
import api from '../services/api'

// Rarity styles for achievements
const RARITY_STYLES = {
  COMMON: { border: 'border-gray-500', bg: 'bg-gray-500/10', text: 'text-gray-400' },
  UNCOMMON: { border: 'border-green-500', bg: 'bg-green-500/10', text: 'text-green-400' },
  RARE: { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  EPIC: { border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400' },
  LEGENDARY: { border: 'border-yellow-500', bg: 'bg-yellow-500/10', text: 'text-yellow-400' }
}

// Format duration helper
const formatDuration = (seconds) => {
  if (!seconds) return '0h 0m'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

export default function FriendProfileModal({ friendId, onClose }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (friendId) {
      fetchFriendProfile()
    }
  }, [friendId])

  const fetchFriendProfile = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get(`/users/${friendId}/profile`)
      setProfile(response.data)
    } catch (err) {
      console.error('Error fetching friend profile:', err)
      setError(err.response?.data?.message || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  if (!friendId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-dark-card rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-xl border border-gray-800">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-dark-elevated hover:bg-gray-700 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-gray-400">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-dark-elevated text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        ) : profile ? (
          <div className="overflow-y-auto max-h-[85vh]">
            {/* Header with avatar */}
            <div className="p-6 pb-4 text-center border-b border-gray-800">
              {/* Avatar */}
              <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden">
                {profile.user.avatarUrl ? (
                  <img
                    src={profile.user.avatarUrl}
                    alt={profile.user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-accent">
                    {profile.user.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-white">{profile.user.name}</h2>
              <p className="text-gray-400">@{profile.user.username}</p>
            </div>

            {/* Stats Grid */}
            <div className="p-4">
              <h3 className="text-white font-medium mb-3 text-sm">Statistics</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-dark-elevated rounded-xl p-3">
                  <p className="text-gray-400 text-xs">Total Workouts</p>
                  <p className="text-xl font-bold text-white">{profile.stats.totalWorkouts}</p>
                </div>
                <div className="bg-dark-elevated rounded-xl p-3">
                  <p className="text-gray-400 text-xs">Total Time</p>
                  <p className="text-xl font-bold text-white">{formatDuration(profile.stats.totalTime)}</p>
                </div>
                <div className="bg-dark-elevated rounded-xl p-3">
                  <p className="text-gray-400 text-xs">Current Streak</p>
                  <p className="text-xl font-bold text-accent">{profile.stats.currentStreak} days</p>
                </div>
                <div className="bg-dark-elevated rounded-xl p-3">
                  <p className="text-gray-400 text-xs">Longest Streak</p>
                  <p className="text-xl font-bold text-white">{profile.stats.longestStreak} days</p>
                </div>
                <div className="bg-dark-elevated rounded-xl p-3 col-span-2">
                  <p className="text-gray-400 text-xs">Personal Records</p>
                  <p className="text-xl font-bold text-green-400">{profile.stats.totalPRs}</p>
                </div>
              </div>
            </div>

            {/* Achievements */}
            {profile.achievements && profile.achievements.length > 0 && (
              <div className="p-4 pt-0">
                <h3 className="text-white font-medium mb-3 text-sm">Recent Achievements</h3>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                  {profile.achievements.map((achievement) => {
                    const style = RARITY_STYLES[achievement.rarity] || RARITY_STYLES.COMMON
                    return (
                      <div
                        key={achievement.id}
                        className={`flex-shrink-0 w-14 h-14 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center`}
                        title={`${achievement.name} (${achievement.rarity})`}
                      >
                        <span className="text-2xl">{achievement.icon}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="p-4 pt-2">
              <button
                onClick={onClose}
                className="w-full py-3 bg-dark-elevated text-white font-medium rounded-xl hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
