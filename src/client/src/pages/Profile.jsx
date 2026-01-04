import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../services/authStore'
import api from '../services/api'

function Profile() {
  const { user, setUser } = useAuthStore()
  const fileInputRef = useRef(null)
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalTime: 0,
    currentStreak: 0,
    longestStreak: 0,
    prs: 0,
    favoriteExercise: null
  })
  const [achievements, setAchievements] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    username: '',
    email: '',
    phoneNumber: ''
  })
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordError, setPasswordError] = useState('')
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [privacyLevel, setPrivacyLevel] = useState('PUBLIC')
  const [savingPrivacy, setSavingPrivacy] = useState(false)

  useEffect(() => {
    fetchStats()
    loadUserSettings()
    loadPrivacySettings()
  }, [user])

  const loadPrivacySettings = async () => {
    try {
      const response = await api.get('/users/profile')
      const settings = response.data?.user?.settings
      if (settings?.profileVisibility) {
        setPrivacyLevel(settings.profileVisibility)
      }
    } catch (error) {
      console.error('Error loading privacy settings:', error)
    }
  }

  const updatePrivacyLevel = async (newLevel) => {
    setSavingPrivacy(true)
    try {
      await api.patch('/users/settings', { profileVisibility: newLevel })
      setPrivacyLevel(newLevel)
    } catch (error) {
      console.error('Error updating privacy:', error)
    } finally {
      setSavingPrivacy(false)
    }
  }

  const loadUserSettings = async () => {
    if (user) {
      setEditData({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        phoneNumber: ''
      })
      setAvatarPreview(user.avatarUrl || null)
      // Load phone number from settings
      try {
        const response = await api.get('/notifications/settings')
        setEditData(prev => ({
          ...prev,
          phoneNumber: response.data.phoneNumber || ''
        }))
      } catch (error) {
        console.error('Error loading settings:', error)
      }
    }
  }

  const fetchStats = async () => {
    setLoading(true)
    try {
      const [statsRes, achievementsRes, goalsRes] = await Promise.all([
        api.get('/users/stats').catch(() => ({ data: {} })),
        api.get('/achievements/recent?limit=10').catch(() => ({ data: { recent: [] } })),
        api.get('/goals').catch(() => ({ data: [] }))
      ])

      setStats({
        totalWorkouts: statsRes.data.totalWorkouts || 0,
        totalTime: statsRes.data.totalTime || 0,
        currentStreak: statsRes.data.currentStreak || 0,
        longestStreak: statsRes.data.longestStreak || 0,
        prs: statsRes.data.personalRecords || 0,
        favoriteExercise: statsRes.data.favoriteExercise || null
      })
      // Map recent achievements to the format used for display
      const recentAchievements = (achievementsRes.data.recent || []).map(a => ({
        id: a.id,
        icon: a.icon,
        name: a.name,
        earned: true
      }))
      setAchievements(recentAchievements)
      // Filter to show only public active goals
      const publicGoals = (goalsRes.data || []).filter(g => g.isPublic && !g.isCompleted)
      setGoals(publicGoals.slice(0, 3)) // Show up to 3 goals
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0h 0m'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview
    const reader = new FileReader()
    reader.onload = (e) => setAvatarPreview(e.target?.result)
    reader.readAsDataURL(file)

    // Upload
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const response = await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (response.data.avatarUrl) {
        setUser({ ...user, avatarUrl: response.data.avatarUrl })
      }
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Failed to upload image')
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      // Update profile
      await api.put('/users/profile', {
        name: editData.name,
        username: editData.username,
        email: editData.email
      })

      // Update phone number in notification settings
      if (editData.phoneNumber !== undefined) {
        await api.patch('/notifications/settings', {
          phoneNumber: editData.phoneNumber
        })
      }

      // Update local user state
      setUser({
        ...user,
        name: editData.name,
        username: editData.username,
        email: editData.email
      })

      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error saving profile:', error)
      alert(error.response?.data?.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    setPasswordError('')

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }

    setSaving(true)
    try {
      await api.put('/users/password', {
        newPassword: passwordData.newPassword
      })
      setChangingPassword(false)
      setPasswordData({ newPassword: '', confirmPassword: '' })
      alert('Password changed successfully')
    } catch (error) {
      setPasswordError(error.response?.data?.message || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length >= 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
    }
    return cleaned
  }

  const defaultAchievements = [
    { id: 1, icon: '💪', name: 'First Workout', earned: stats.totalWorkouts >= 1 },
    { id: 2, icon: '🔥', name: '7 Day Streak', earned: stats.longestStreak >= 7 },
    { id: 3, icon: '💯', name: '10 Workouts', earned: stats.totalWorkouts >= 10 },
    { id: 4, icon: '🏆', name: '30 Day Streak', earned: stats.longestStreak >= 30 },
    { id: 5, icon: '⚡', name: '50 Workouts', earned: stats.totalWorkouts >= 50 }
  ]

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link to="/settings" className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        {saved && (
          <span className="text-success text-sm ml-auto flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
      </div>

      {/* Profile Card */}
      <div className="card text-center">
        {/* Avatar */}
        <div className="relative w-24 h-24 mx-auto mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <button
            onClick={handleAvatarClick}
            className="w-full h-full rounded-full bg-accent/20 flex items-center justify-center overflow-hidden group"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl text-accent font-bold">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </button>
        </div>

        {editing ? (
          <div className="space-y-4 text-left">
            <div>
              <label className="text-gray-400 text-sm">Name</label>
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm">Username</label>
              <input
                type="text"
                value={editData.username}
                onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm">Email</label>
              <input
                type="email"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm">Phone Number (for SMS notifications)</label>
              <input
                type="tel"
                value={editData.phoneNumber}
                onChange={(e) => setEditData({ ...editData, phoneNumber: formatPhoneNumber(e.target.value) })}
                className="input w-full"
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={saveProfile} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : changingPassword ? (
          <div className="space-y-4 text-left">
            <h3 className="text-white font-medium text-center">Change Password</h3>
            {passwordError && (
              <div className="bg-error/20 border border-error/50 text-error px-3 py-2 rounded-lg text-sm">
                {passwordError}
              </div>
            )}
            <div>
              <label className="text-gray-400 text-sm">New Password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="input w-full"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm">Confirm New Password</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="input w-full"
                placeholder="Confirm your new password"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => {
                setChangingPassword(false)
                setPasswordError('')
                setPasswordData({ newPassword: '', confirmPassword: '' })
              }} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={changePassword} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving...' : 'Change Password'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-white">{user?.name || 'User'}</h2>
            <p className="text-gray-400">@{user?.username || 'username'}</p>
            <p className="text-gray-500 text-sm mt-1">{user?.email || 'email@example.com'}</p>
            <div className="flex gap-2 justify-center mt-4">
              <button onClick={() => setEditing(true)} className="btn-secondary">
                Edit Profile
              </button>
              <button onClick={() => setChangingPassword(true)} className="btn-secondary">
                Change Password
              </button>
            </div>
          </>
        )}
      </div>

      {/* Training Style */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Training Style</h3>
          <Link to="/settings/training" className="text-accent text-sm">Change</Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-medium">Strength Training</p>
            <p className="text-gray-400 text-sm">Focus on building strength</p>
          </div>
        </div>
      </div>

      {/* Profile Privacy */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Profile Privacy</h3>
          <Link to="/settings/privacy" className="text-accent text-sm">More Settings</Link>
        </div>
        <div className="space-y-2">
          {[
            { id: 'PUBLIC', label: 'Public', icon: '🌐', desc: 'Anyone can follow you' },
            { id: 'FRIENDS_ONLY', label: 'Approval Required', icon: '🔒', desc: 'Approve who follows you' },
            { id: 'PRIVATE', label: 'Private', icon: '🚫', desc: 'No one can find you' }
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => updatePrivacyLevel(option.id)}
              disabled={savingPrivacy}
              className={`w-full p-3 rounded-xl flex items-center gap-3 transition-colors ${
                privacyLevel === option.id
                  ? 'bg-accent text-white'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              <span className="text-xl">{option.icon}</span>
              <div className="flex-1 text-left">
                <p className="font-medium">{option.label}</p>
                <p className={`text-xs ${privacyLevel === option.id ? 'text-white/70' : 'text-gray-500'}`}>
                  {option.desc}
                </p>
              </div>
              {privacyLevel === option.id && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <div>
            <h3 className="text-white font-medium mb-3">Statistics</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="card">
                <div className="flex items-center gap-1">
                  <p className="text-gray-400 text-sm">Total Workouts</p>
                  <button className="text-gray-500 hover:text-accent transition-colors" title="Total number of completed workout sessions">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <p className="text-2xl font-bold text-white">{stats.totalWorkouts}</p>
              </div>
              <div className="card">
                <div className="flex items-center gap-1">
                  <p className="text-gray-400 text-sm">Total Time</p>
                  <button className="text-gray-500 hover:text-accent transition-colors" title="Cumulative time spent in active workouts">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <p className="text-2xl font-bold text-white">{formatDuration(stats.totalTime)}</p>
              </div>
              <div className="card">
                <div className="flex items-center gap-1">
                  <p className="text-gray-400 text-sm">Current Streak</p>
                  <button className="text-gray-500 hover:text-accent transition-colors" title="Consecutive workout days. Resets if you take more than 2 consecutive rest days or more than 2 rest days in a week.">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <p className="text-2xl font-bold text-accent">{stats.currentStreak} days</p>
              </div>
              <div className="card">
                <div className="flex items-center gap-1">
                  <p className="text-gray-400 text-sm">Longest Streak</p>
                  <button className="text-gray-500 hover:text-accent transition-colors" title="Your best streak ever achieved">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <p className="text-2xl font-bold text-white">{stats.longestStreak} days</p>
              </div>
              <div className="card">
                <div className="flex items-center gap-1">
                  <p className="text-gray-400 text-sm">Personal Records</p>
                  <button className="text-gray-500 hover:text-accent transition-colors" title="PRs are set when you lift heavier weight than your previous best for an exercise">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <p className="text-2xl font-bold text-green-400">{stats.prs}</p>
              </div>
              <div className="card">
                <div className="flex items-center gap-1">
                  <p className="text-gray-400 text-sm">Favorite Exercise</p>
                  <button className="text-gray-500 hover:text-accent transition-colors" title="Your most frequently logged exercise">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <p className="text-lg font-bold text-white truncate">{stats.favoriteExercise || '-'}</p>
              </div>
            </div>
          </div>

          {/* Achievements */}
          <div className="card">
            <h3 className="text-white font-medium mb-4">Achievements</h3>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
              {(achievements.length > 0 ? achievements : defaultAchievements).map((achievement) => (
                <div
                  key={achievement.id}
                  className={`w-16 h-16 flex-shrink-0 rounded-xl flex items-center justify-center ${
                    achievement.earned ? 'bg-accent/20' : 'bg-dark-elevated opacity-40'
                  }`}
                  title={achievement.name}
                >
                  <span className="text-2xl">{achievement.icon}</span>
                </div>
              ))}
            </div>
            <Link to="/achievements" className="text-accent text-sm mt-3 block text-center">
              View All Achievements
            </Link>
          </div>

          {/* Goals */}
          {goals.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <span>🎯</span> Active Goals
                </h3>
                <Link to="/goals" className="text-accent text-sm">View All</Link>
              </div>
              <div className="space-y-3">
                {goals.map((goal) => {
                  const goalTypes = {
                    WEIGHT_LOSS: { icon: '⬇️', color: 'blue', unit: 'lbs' },
                    WEIGHT_GAIN: { icon: '⬆️', color: 'green', unit: 'lbs' },
                    EXERCISE_STRENGTH: { icon: '💪', color: 'orange', unit: 'lbs' },
                    EXERCISE_CARDIO: { icon: '🏃', color: 'cyan', unit: '' },
                    WORKOUT_COUNT: { icon: '📊', color: 'purple', unit: 'workouts' },
                    STREAK: { icon: '🔥', color: 'red', unit: 'days' }
                  }
                  const typeInfo = goalTypes[goal.type] || { icon: '🎯', color: 'gray', unit: '' }
                  const denominator = Math.abs(goal.targetValue - goal.startValue)
                  const progress = denominator > 0
                    ? Math.min(100, Math.round((Math.abs(goal.currentValue - goal.startValue) / denominator) * 100))
                    : 0
                  const colorClasses = {
                    blue: 'bg-blue-500',
                    green: 'bg-green-500',
                    orange: 'bg-orange-500',
                    cyan: 'bg-cyan-500',
                    purple: 'bg-purple-500',
                    red: 'bg-red-500',
                    gray: 'bg-gray-500'
                  }

                  return (
                    <div key={goal.id} className="p-3 rounded-xl bg-dark-elevated">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{typeInfo.icon}</span>
                        <span className="text-white text-sm font-medium truncate">
                          {goal.exerciseName || goal.type.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{goal.currentValue} {typeInfo.unit}</span>
                        <span>{goal.targetValue} {typeInfo.unit}</span>
                      </div>
                      <div className="h-1.5 bg-dark-card rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colorClasses[typeInfo.color]} transition-all duration-500`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Profile
