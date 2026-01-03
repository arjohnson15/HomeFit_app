import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../services/authStore'

// Expandable card wrapper
function ExpandableCard({ title, icon, children, defaultExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-dark-elevated/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <span className="text-white font-semibold">{title}</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[600px]' : 'max-h-0'}`}>
        <div className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// Personal stats card
function PersonalStatsCard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState({ thisWeek: 0, streak: 0, totalPRs: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/social/my-stats')
        setStats(response.data)
      } catch (error) {
        console.error('Error fetching personal stats:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-between bg-dark-card rounded-xl px-4 py-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-2 animate-pulse">
            <div className="w-8 h-8 bg-dark-elevated rounded-full" />
            <div className="h-4 w-12 bg-dark-elevated rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between bg-dark-card rounded-xl px-4 py-3 border border-dark-border">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
          <span className="text-sm">💪</span>
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-none">{stats.thisWeek || 0}</p>
          <p className="text-gray-500 text-[10px]">this week</p>
        </div>
      </div>
      <div className="w-px h-8 bg-dark-border" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
          <span className="text-sm">🔥</span>
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-none">{stats.streak || 0}</p>
          <p className="text-gray-500 text-[10px]">day streak</p>
        </div>
      </div>
      <div className="w-px h-8 bg-dark-border" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <span className="text-sm">🏆</span>
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-none">{stats.totalPRs || 0}</p>
          <p className="text-gray-500 text-[10px]">total PRs</p>
        </div>
      </div>
    </div>
  )
}

// Friends Current Streaks card
function FriendsStreaksCard() {
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const response = await api.get('/social/friends/streaks')
        setFriends(response.data.streaks || [])
      } catch (error) {
        console.error('Error fetching friend streaks:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchFriends()
  }, [])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-dark-elevated rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (friends.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">No friends with active streaks</p>
  }

  return (
    <div className="space-y-2">
      {friends.map((friend) => (
        <div
          key={friend.id}
          className="flex items-center gap-3 p-3 rounded-xl bg-dark-elevated"
        >
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-white font-bold text-sm">
            {friend.name?.charAt(0).toUpperCase()}
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate text-sm">{friend.name}</p>
            <p className="text-gray-500 text-xs">@{friend.username}</p>
          </div>

          {/* Streak */}
          <div className="flex items-center gap-1 bg-orange-500/20 px-2 py-1 rounded-lg">
            <span className="text-orange-400 font-bold">{friend.streak}</span>
            <span className="text-sm">🔥</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Leaderboard expandable card with filters
function LeaderboardCard() {
  const { user } = useAuthStore()
  const [leaderboard, setLeaderboard] = useState([])
  const [userRank, setUserRank] = useState(0)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('week')
  const [category, setCategory] = useState('workouts')
  const [metric, setMetric] = useState('count') // For subcategory selection
  const [scope, setScope] = useState('community') // 'friends' or 'community'

  const periods = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
    { id: 'all', label: 'All Time' }
  ]

  const categories = [
    { id: 'workouts', label: 'Workouts', icon: '💪', metrics: [
      { id: 'count', label: 'Count' },
      { id: 'time', label: 'Time' }
    ]},
    { id: 'streak', label: 'Streak', icon: '🔥', metrics: [] },
    { id: 'running', label: 'Running', icon: '🏃', metrics: [
      { id: 'miles', label: 'Miles' },
      { id: 'pace', label: 'Avg Pace' }
    ]},
    { id: 'cycling', label: 'Cycling', icon: '🚴', metrics: [
      { id: 'miles', label: 'Miles' },
      { id: 'pace', label: 'Avg Pace' }
    ]}
  ]

  // Reset metric when category changes
  useEffect(() => {
    const cat = categories.find(c => c.id === category)
    if (cat?.metrics?.length > 0) {
      setMetric(cat.metrics[0].id)
    } else {
      setMetric('')
    }
  }, [category])

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      try {
        const endpoint = scope === 'friends' ? '/social/leaderboard/friends' : '/social/leaderboard/global'
        const response = await api.get(`${endpoint}?category=${category}&metric=${metric}&period=${period}&limit=10`)
        setLeaderboard(response.data.leaderboard || [])
        setUserRank(response.data.userRank || 0)
      } catch (error) {
        console.error('Error fetching leaderboard:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchLeaderboard()
  }, [period, category, metric, scope])

  const getStatLabel = () => {
    if (category === 'workouts') {
      return metric === 'time' ? 'hours' : 'workouts'
    }
    if (category === 'streak') return 'days'
    if (category === 'running' || category === 'cycling') {
      return metric === 'pace' ? 'min/mi' : 'miles'
    }
    return ''
  }

  const getStatValue = (entry) => {
    if (category === 'workouts') {
      if (metric === 'time') {
        const hours = (entry.totalSeconds || 0) / 3600
        return hours.toFixed(1)
      }
      return entry.workoutCount || entry.count || 0
    }
    if (category === 'streak') return entry.streak || 0
    if (category === 'running') {
      if (metric === 'pace') return entry.avgPace || entry.pace || '—'
      return (entry.runningMiles || entry.miles || 0).toFixed(1)
    }
    if (category === 'cycling') {
      if (metric === 'pace') return entry.avgPace || entry.pace || '—'
      return (entry.cyclingMiles || entry.miles || 0).toFixed(1)
    }
    return 0
  }

  const currentCategory = categories.find(c => c.id === category)

  return (
    <div className="space-y-4">
      {/* Scope toggle - Friends vs Community */}
      <div className="flex bg-dark-elevated rounded-xl p-1">
        <button
          onClick={() => setScope('friends')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
            scope === 'friends'
              ? 'bg-accent text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>👥</span> Friends
        </button>
        <button
          onClick={() => setScope('community')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
            scope === 'community'
              ? 'bg-accent text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>🌍</span> Community
        </button>
      </div>

      {/* Category selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              category === cat.id
                ? 'bg-accent text-white'
                : 'bg-dark-elevated text-gray-400 hover:text-white'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Metric selector (if category has metrics) */}
      {currentCategory?.metrics?.length > 0 && (
        <div className="flex gap-2">
          {currentCategory.metrics.map(m => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                metric === m.id
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                  : 'bg-dark-elevated text-gray-400 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Period selector */}
      <div className="flex bg-dark-elevated rounded-xl p-1">
        {periods.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p.id
                ? 'bg-accent text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Leaderboard list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 bg-dark-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No data for this category yet</p>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, idx) => {
            const isCurrentUser = entry.isCurrentUser || entry.id === user?.id
            const isTop3 = idx < 3

            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  isCurrentUser
                    ? 'bg-accent/20 border border-accent/40'
                    : 'bg-dark-elevated hover:bg-dark-elevated/80'
                }`}
              >
                {/* Rank */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                  idx === 0 ? 'bg-yellow-500 text-black' :
                  idx === 1 ? 'bg-gray-300 text-gray-800' :
                  idx === 2 ? 'bg-orange-500 text-white' :
                  'bg-dark-card text-gray-400'
                }`}>
                  {idx + 1}
                </div>

                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                  isTop3
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                    : 'bg-gradient-to-br from-accent to-blue-500'
                }`}>
                  {entry.name?.charAt(0).toUpperCase()}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isCurrentUser ? 'text-accent' : 'text-white'}`}>
                    {isCurrentUser ? 'You' : entry.name}
                  </p>
                  <p className="text-gray-500 text-xs">@{entry.username}</p>
                </div>

                {/* Stat */}
                <div className="text-right">
                  <p className="text-white font-black text-lg">{getStatValue(entry).toLocaleString()}</p>
                  <p className="text-gray-500 text-[10px]">{getStatLabel()}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* User rank if not in top 10 */}
      {userRank > 10 && (
        <div className="pt-2 border-t border-dark-border">
          <div className="flex items-center gap-3 p-3 bg-accent/10 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center text-gray-400 font-black text-sm">
              {userRank}
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-accent font-medium">You</p>
              <p className="text-gray-500 text-xs">@{user?.username}</p>
            </div>
            <p className="text-gray-400 text-sm">Your rank</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Main Social Section component
export function SocialSection({ settings }) {
  const showSection = settings?.showSocialSection ?? true

  if (!showSection) {
    return null
  }

  return (
    <div id="social-section" className="pt-4 space-y-4">
      {/* Community Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎮</span>
          <h2 className="text-lg font-bold text-white">Community</h2>
        </div>
        <Link to="/social" className="text-accent text-sm hover:underline">
          Friends
        </Link>
      </div>

      {/* Expandable Cards */}
      <div className="space-y-3">
        <ExpandableCard title="Leaderboards" icon="🏆" defaultExpanded={false}>
          <LeaderboardCard />
        </ExpandableCard>
      </div>
    </div>
  )
}

// Legacy exports for compatibility
export function FriendsWorkoutsCard() { return null }
export function FriendsPRsCard() { return null }
export function FriendsAchievementsCard() { return null }
export function GlobalLeaderboardCard() { return null }
export { FriendsStreaksCard }
