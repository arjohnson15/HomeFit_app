import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function PrivacySettings() {
  const [settings, setSettings] = useState({
    profileVisibility: 'PUBLIC',
    shareWorkouts: true,
    showOnLeaderboard: true,
    shareProgress: false,
    // Social cards on Today page
    showSocialSection: true,
    showFriendsWorkoutsToday: true,
    showFriendsPRsToday: true,
    showFriendsStreaks: true,
    showFriendsAchievements: true,
    showGlobalLeaderboard: true
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.get('/users/profile')
        const userSettings = response.data?.user?.settings
        if (userSettings) {
          setSettings({
            profileVisibility: userSettings.profileVisibility || 'PUBLIC',
            shareWorkouts: userSettings.shareWorkouts ?? true,
            showOnLeaderboard: userSettings.showOnLeaderboard ?? true,
            shareProgress: userSettings.shareProgress ?? false,
            showSocialSection: userSettings.showSocialSection ?? true,
            showFriendsWorkoutsToday: userSettings.showFriendsWorkoutsToday ?? true,
            showFriendsPRsToday: userSettings.showFriendsPRsToday ?? true,
            showFriendsStreaks: userSettings.showFriendsStreaks ?? true,
            showFriendsAchievements: userSettings.showFriendsAchievements ?? true,
            showGlobalLeaderboard: userSettings.showGlobalLeaderboard ?? true
          })
        }
      } catch (error) {
        console.error('Error loading settings:', error)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await api.patch('/users/settings', {
        profileVisibility: settings.profileVisibility,
        shareWorkouts: settings.shareWorkouts,
        showOnLeaderboard: settings.showOnLeaderboard,
        shareProgress: settings.shareProgress,
        showSocialSection: settings.showSocialSection,
        showFriendsWorkoutsToday: settings.showFriendsWorkoutsToday,
        showFriendsPRsToday: settings.showFriendsPRsToday,
        showFriendsStreaks: settings.showFriendsStreaks,
        showFriendsAchievements: settings.showFriendsAchievements,
        showGlobalLeaderboard: settings.showGlobalLeaderboard
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/settings" className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">Privacy</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Profile Visibility */}
          <div className="card">
            <h3 className="text-white font-medium mb-2">Profile Visibility</h3>
            <p className="text-gray-500 text-sm mb-4">Control who can find and follow you</p>
            <div className="space-y-2">
              {[
                { id: 'PUBLIC', label: 'Public', desc: 'Anyone can follow you without approval' },
                { id: 'FRIENDS_ONLY', label: 'Approval Required', desc: 'People must request to follow you' },
                { id: 'PRIVATE', label: 'Private', desc: 'You cannot be found or followed' }
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSettings({ ...settings, profileVisibility: option.id })}
                  className={`w-full p-4 rounded-xl text-left transition-colors ${
                    settings.profileVisibility === option.id
                      ? 'bg-accent text-white'
                      : 'bg-dark-elevated text-gray-400 hover:text-white'
                  }`}
                >
                  <p className="font-medium">{option.label}</p>
                  <p className={`text-sm ${settings.profileVisibility === option.id ? 'text-white/70' : 'text-gray-500'}`}>
                    {option.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Activity Sharing */}
          <div className="card space-y-4">
            <h3 className="text-white font-medium">Activity Sharing</h3>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-white">Share Workouts</p>
                <p className="text-gray-500 text-sm">Let friends see your workout activity</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, shareWorkouts: !settings.shareWorkouts })}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  settings.shareWorkouts ? 'bg-accent' : 'bg-dark-elevated'
                }`}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.shareWorkouts ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-white">Show on Leaderboard</p>
                <p className="text-gray-500 text-sm">Appear in friend leaderboards</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, showOnLeaderboard: !settings.showOnLeaderboard })}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  settings.showOnLeaderboard ? 'bg-accent' : 'bg-dark-elevated'
                }`}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.showOnLeaderboard ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-white">Share Progress</p>
                <p className="text-gray-500 text-sm">Share your fitness progress with friends</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, shareProgress: !settings.shareProgress })}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  settings.shareProgress ? 'bg-accent' : 'bg-dark-elevated'
                }`}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.shareProgress ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Social Cards on Today Page */}
          <div className="card space-y-4">
            <div>
              <h3 className="text-white font-medium">Today Page Social Cards</h3>
              <p className="text-gray-500 text-sm">Choose which community cards appear on your Today page</p>
            </div>

            {/* Master Toggle */}
            <div className="flex items-center justify-between pb-3 border-b border-dark-border">
              <div>
                <p className="text-white font-medium">Show Social Section</p>
                <p className="text-gray-500 text-sm">Master toggle for all social cards</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, showSocialSection: !settings.showSocialSection })}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  settings.showSocialSection ? 'bg-accent' : 'bg-dark-elevated'
                }`}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.showSocialSection ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Individual Card Toggles */}
            <div className={`space-y-4 transition-opacity ${settings.showSocialSection ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Friends Working Out Today</p>
                  <p className="text-gray-500 text-sm">See which friends completed a workout</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, showFriendsWorkoutsToday: !settings.showFriendsWorkoutsToday })}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    settings.showFriendsWorkoutsToday ? 'bg-accent' : 'bg-dark-elevated'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.showFriendsWorkoutsToday ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Friends PRs Today</p>
                  <p className="text-gray-500 text-sm">See friends who hit personal records</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, showFriendsPRsToday: !settings.showFriendsPRsToday })}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    settings.showFriendsPRsToday ? 'bg-accent' : 'bg-dark-elevated'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.showFriendsPRsToday ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Friend Streaks</p>
                  <p className="text-gray-500 text-sm">See your friends' workout streaks</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, showFriendsStreaks: !settings.showFriendsStreaks })}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    settings.showFriendsStreaks ? 'bg-accent' : 'bg-dark-elevated'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.showFriendsStreaks ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Friend Achievements</p>
                  <p className="text-gray-500 text-sm">See friends' milestone achievements</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, showFriendsAchievements: !settings.showFriendsAchievements })}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    settings.showFriendsAchievements ? 'bg-accent' : 'bg-dark-elevated'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.showFriendsAchievements ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Global Leaderboard</p>
                  <p className="text-gray-500 text-sm">See app-wide streak and workout rankings</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, showGlobalLeaderboard: !settings.showGlobalLeaderboard })}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    settings.showGlobalLeaderboard ? 'bg-accent' : 'bg-dark-elevated'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.showGlobalLeaderboard ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={saveSettings}
            disabled={saving}
            className={`w-full py-3 rounded-xl font-medium transition-all ${
              saved ? 'bg-success text-white' : 'btn-primary'
            }`}
          >
            {saving ? 'Saving...' : saved ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved!
              </span>
            ) : 'Save Settings'}
          </button>
        </>
      )}
    </div>
  )
}

export default PrivacySettings
