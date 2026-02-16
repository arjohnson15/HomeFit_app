import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import FollowButton from '../components/FollowButton'

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function FriendProfile() {
  const { friendId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [workouts, setWorkouts] = useState({ workouts: [], canView: false })
  const [schedule, setSchedule] = useState({ schedule: [], canView: false })
  const [goals, setGoals] = useState({ goals: [], canView: false })
  const [error, setError] = useState(null)
  const [removingFriend, setRemovingFriend] = useState(false)
  const [expandedWorkout, setExpandedWorkout] = useState(null)
  const [expandedDay, setExpandedDay] = useState(null)
  const [marathonData, setMarathonData] = useState({ activeRace: null, completedRaces: [], canView: false })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all data in parallel
        const [profileRes, workoutsRes, scheduleRes, goalsRes, marathonRes] = await Promise.all([
          api.get(`/users/${friendId}/profile`),
          api.get(`/social/friend/${friendId}/workouts?limit=10`).catch(() => ({ data: { workouts: [], canView: false } })),
          api.get(`/social/friend/${friendId}/schedule`).catch(() => ({ data: { schedule: [], canView: false } })),
          api.get(`/social/friend/${friendId}/goals`).catch(() => ({ data: { goals: [], canView: false } })),
          api.get(`/social/friend/${friendId}/marathons`).catch(() => ({ data: { activeRace: null, completedRaces: [], canView: false } }))
        ])

        setProfile(profileRes.data)
        setWorkouts(workoutsRes.data)
        setSchedule(scheduleRes.data)
        setGoals(goalsRes.data)
        setMarathonData(marathonRes.data)
      } catch (err) {
        console.error('Error fetching friend profile:', err)
        setError(err.response?.data?.message || 'Unable to load profile')
      } finally {
        setLoading(false)
      }
    }

    if (friendId) {
      fetchData()
    }
  }, [friendId])

  const handleRemoveFriend = async () => {
    if (!confirm('Are you sure you want to remove this friend?')) return

    try {
      setRemovingFriend(true)
      await api.delete(`/social/friend/${friendId}`)
      navigate('/social')
    } catch (err) {
      console.error('Error removing friend:', err)
      alert('Failed to remove friend')
    } finally {
      setRemovingFriend(false)
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0m'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24))

    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    if (diff < 7) return `${diff} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'LEGENDARY': return 'text-yellow-400 bg-yellow-400/20'
      case 'EPIC': return 'text-purple-400 bg-purple-400/20'
      case 'RARE': return 'text-blue-400 bg-blue-400/20'
      case 'UNCOMMON': return 'text-green-400 bg-green-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark p-4">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="card text-center py-8">
          <p className="text-error mb-4">{error}</p>
          <button onClick={() => navigate('/social')} className="btn-secondary">
            Back to Social
          </button>
        </div>
      </div>
    )
  }

  const { user, stats, achievements } = profile || {}

  return (
    <div className="min-h-screen bg-dark pb-24">
      {/* Header */}
      <div className="bg-dark-card border-b border-dark-border">
        <div className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => navigate(-1)} className="btn-ghost p-2 -ml-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-white">Profile</h1>
          </div>

          {/* Profile Info */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{user?.name}</h2>
              <p className="text-gray-400">@{user?.username}</p>
            </div>
            <FollowButton
              friendId={friendId}
              initialFollowing={profile?.isFollowing}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 border-t border-dark-border">
          <div className="p-3 text-center border-r border-dark-border">
            <p className="text-xl font-bold text-white">{stats?.totalWorkouts || 0}</p>
            <p className="text-xs text-gray-500">Workouts</p>
          </div>
          <div className="p-3 text-center border-r border-dark-border">
            <p className="text-xl font-bold text-white">{formatDuration(stats?.totalTime)}</p>
            <p className="text-xs text-gray-500">Total Time</p>
          </div>
          <div className="p-3 text-center border-r border-dark-border">
            <p className="text-xl font-bold text-accent">{stats?.currentStreak || 0}</p>
            <p className="text-xs text-gray-500">Streak</p>
          </div>
          <div className="p-3 text-center">
            <p className="text-xl font-bold text-yellow-400">{stats?.totalPRs || 0}</p>
            <p className="text-xs text-gray-500">PRs</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Recent Workouts Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span>💪</span> Recent Workouts
            </h3>
          </div>

          {!workouts.canView ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-dark-elevated flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">Workout details are private</p>
            </div>
          ) : workouts.workouts.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No recent workouts</p>
          ) : (
            <div className="space-y-3">
              {workouts.workouts.map((workout) => (
                <div key={workout.id} className="bg-dark-elevated rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedWorkout(expandedWorkout === workout.id ? null : workout.id)}
                    className="w-full p-3 flex items-center justify-between"
                  >
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium">{workout.name}</p>
                      <p className="text-gray-500 text-sm">
                        {formatDate(workout.date)} • {formatDuration(workout.duration)} • {workout.exercises.length} exercises
                      </p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${expandedWorkout === workout.id ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {expandedWorkout === workout.id && (
                    <div className="px-3 pb-3 space-y-2">
                      {workout.exercises.map((ex, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 border-t border-dark-border">
                          <span className="text-gray-300 text-sm">{ex.name}</span>
                          <span className="text-white text-sm font-medium">
                            {ex.bestSet ? (
                              <>
                                {ex.bestSet.weight && `${ex.bestSet.weight}lb`}
                                {ex.bestSet.weight && ex.bestSet.reps && ' x '}
                                {ex.bestSet.reps && `${ex.bestSet.reps}`}
                                {ex.bestSet.isPR && <span className="ml-1 text-yellow-400">🏆</span>}
                              </>
                            ) : (
                              `${ex.setCount} sets`
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly Schedule Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span>📅</span> Weekly Schedule
            </h3>
          </div>

          {!schedule.canView ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-dark-elevated flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">Schedule is private</p>
            </div>
          ) : schedule.schedule.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No schedule set up</p>
          ) : (
            <div className="space-y-2">
              {schedule.schedule.map((day) => (
                <div key={day.day} className="bg-dark-elevated rounded-xl overflow-hidden">
                  <button
                    onClick={() => !day.isRestDay && setExpandedDay(expandedDay === day.day ? null : day.day)}
                    className={`w-full p-3 flex items-center justify-between ${day.isRestDay ? 'opacity-60' : ''}`}
                    disabled={day.isRestDay}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-sm w-8">{shortDayNames[day.day]}</span>
                      <span className={`font-medium ${day.isRestDay ? 'text-gray-500' : 'text-white'}`}>
                        {day.isRestDay ? 'Rest Day' : day.name}
                      </span>
                    </div>
                    {!day.isRestDay && (
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedDay === day.day ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>

                  {expandedDay === day.day && day.exercises.length > 0 && (
                    <div className="px-3 pb-3 space-y-2">
                      {day.exercises.map((ex, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 border-t border-dark-border">
                          <span className="text-gray-300 text-sm">{ex.name}</span>
                          <span className="text-gray-500 text-sm">
                            {ex.sets} x {ex.reps}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Goals Section */}
        {goals.canView && goals.goals.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span>🎯</span> Active Goals
              </h3>
            </div>

            <div className="space-y-3">
              {goals.goals.map((goal) => (
                <div key={goal.id} className="bg-dark-elevated rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{goal.title}</span>
                    <span className="text-accent text-sm font-medium">{goal.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-dark-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                    {goal.deadline && <span>Due {new Date(goal.deadline).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Race */}
        {marathonData.canView && marathonData.activeRace && (
          <div className="card">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
              <span>{marathonData.activeRace.type === 'bike' ? '🚴' : marathonData.activeRace.type === 'swim' ? '🏊' : '🏃'}</span> Current Race
            </h3>
            <div className="bg-dark-elevated rounded-xl p-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <span className="text-xl">{marathonData.activeRace.type === 'bike' ? '🚴' : marathonData.activeRace.type === 'swim' ? '🏊' : '🏃'}</span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{marathonData.activeRace.marathonName}</p>
                  <p className="text-gray-400 text-xs">{marathonData.activeRace.city}</p>
                </div>
                <span className="text-accent text-sm font-semibold">{marathonData.activeRace.progress}%</span>
              </div>
              <div className="w-full bg-dark-border rounded-full h-2 mb-1">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${marathonData.activeRace.progress}%` }} />
              </div>
              <p className="text-gray-500 text-xs">
                {marathonData.activeRace.currentDistance.toFixed(1)} / {marathonData.activeRace.distance} mi
              </p>
            </div>
          </div>
        )}

        {/* Race Medals */}
        {marathonData.canView && marathonData.completedRaces.length > 0 && (
          <div className="card">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
              <span>🏅</span> Race Medals
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {marathonData.completedRaces.map(race => (
                <div key={race.id} className="text-center p-2 bg-dark-elevated rounded-xl">
                  {race.awardImageUrl ? (
                    <img src={race.awardImageUrl} alt={race.marathonName} className="w-12 h-12 mx-auto mb-1 object-contain" />
                  ) : (
                    <div className="w-12 h-12 mx-auto mb-1 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <span className="text-xl">🏅</span>
                    </div>
                  )}
                  <p className="text-white text-[10px] font-medium line-clamp-1">{race.marathonName}</p>
                  <p className="text-gray-500 text-[10px]">{race.distance} mi</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements Section */}
        {achievements && achievements.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span>🏅</span> Achievements
              </h3>
              <span className="text-gray-500 text-sm">{achievements.length} earned</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {achievements.slice(0, 12).map((achievement) => (
                <div
                  key={achievement.id}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center p-2 ${getRarityColor(achievement.rarity)}`}
                  title={achievement.name}
                >
                  <span className="text-2xl">{achievement.icon}</span>
                  <span className="text-[10px] text-center mt-1 line-clamp-1">{achievement.name}</span>
                </div>
              ))}
            </div>

            {achievements.length > 12 && (
              <p className="text-center text-gray-500 text-sm mt-3">
                +{achievements.length - 12} more
              </p>
            )}
          </div>
        )}

        {/* Remove Friend Button */}
        <button
          onClick={handleRemoveFriend}
          disabled={removingFriend}
          className="w-full py-3 rounded-xl font-medium text-error bg-error/10 border border-error/30 hover:bg-error/20 transition-colors"
        >
          {removingFriend ? 'Removing...' : 'Remove Friend'}
        </button>
      </div>
    </div>
  )
}

export default FriendProfile
