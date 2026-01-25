import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../services/authStore'
import { LeaderboardCard } from '../components/SocialCards'
import FollowButton from '../components/FollowButton'

function Social() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('friends')
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [discoverableUsers, setDiscoverableUsers] = useState([])
  const [loadingDiscoverable, setLoadingDiscoverable] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [friendsRes, requestsRes, leaderboardRes] = await Promise.all([
        api.get('/social/friends').catch(() => ({ data: { friends: [] } })),
        api.get('/social/requests').catch(() => ({ data: { requests: [] } })),
        api.get('/social/leaderboard').catch(() => ({ data: { leaderboard: [] } }))
      ])

      setFriends(friendsRes.data.friends || [])
      setRequests(requestsRes.data.requests || [])
      setLeaderboard(leaderboardRes.data.leaderboard || [])
    } catch (error) {
      console.error('Error fetching social data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDiscoverableUsers = async () => {
    setLoadingDiscoverable(true)
    try {
      const response = await api.get('/social/discoverable')
      setDiscoverableUsers(response.data.users || [])
    } catch (error) {
      console.error('Error fetching discoverable users:', error)
      setDiscoverableUsers([])
    } finally {
      setLoadingDiscoverable(false)
    }
  }

  const openAddModal = () => {
    setShowAddModal(true)
    setSearchQuery('')
    setSearchResults([])
    fetchDiscoverableUsers()
  }

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const response = await api.get(`/social/search?q=${encodeURIComponent(query)}`)
      setSearchResults(response.data.users || [])
    } catch (error) {
      console.error('Error searching users:', error)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const [requestFeedback, setRequestFeedback] = useState(null)

  const sendFriendRequest = async (userId) => {
    try {
      const response = await api.post('/social/request', { userId })
      setSearchResults(prev => prev.filter(u => u.id !== userId))
      setDiscoverableUsers(prev => prev.filter(u => u.id !== userId))

      // Show feedback based on whether it was auto-accepted
      setRequestFeedback({
        type: response.data.autoAccepted ? 'success' : 'pending',
        message: response.data.message
      })
      setTimeout(() => setRequestFeedback(null), 3000)

      // If auto-accepted, refresh friends list
      if (response.data.autoAccepted) {
        fetchData()
      }
    } catch (error) {
      console.error('Error sending friend request:', error)
      setRequestFeedback({
        type: 'error',
        message: error.response?.data?.message || 'Failed to send request'
      })
      setTimeout(() => setRequestFeedback(null), 3000)
    }
  }

  const handleRequest = async (requestId, action) => {
    try {
      const status = action === 'accept' ? 'ACCEPTED' : 'REJECTED'
      await api.patch(`/social/request/${requestId}`, { status })
      setRequests(prev => prev.filter(r => r.id !== requestId))
      if (action === 'accept') {
        fetchData() // Refresh friends list
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error)
    }
  }

  const [confirmUnfriend, setConfirmUnfriend] = useState(null)

  const unfriendUser = async (friendId) => {
    try {
      await api.delete(`/social/friend/${friendId}`)
      setFriends(prev => prev.filter(f => f.id !== friendId))
      setConfirmUnfriend(null)
    } catch (error) {
      console.error('Error unfriending user:', error)
      alert('Failed to remove friend')
    }
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getRankStyle = (rank) => {
    switch (rank) {
      case 1: return 'bg-yellow-500/20 text-yellow-500'
      case 2: return 'bg-gray-400/20 text-gray-400'
      case 3: return 'bg-orange-500/20 text-orange-500'
      default: return 'bg-dark-elevated text-gray-500'
    }
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Social</h1>
          <p className="text-gray-400">Connect with friends</p>
        </div>
        <button onClick={openAddModal} className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Add Friend
        </button>
      </div>

      {/* Friend Requests Alert */}
      {requests.length > 0 && (
        <div className="card bg-accent/10 border border-accent/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium">Friend Requests</h3>
            <span className="bg-accent px-2 py-0.5 rounded-full text-xs">{requests.length}</span>
          </div>
          <div className="space-y-2">
            {requests.map((request) => (
              <div key={request.id} className="flex items-center gap-3 bg-dark-elevated p-3 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium">
                  {getInitials(request.user?.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">
                    {request.user?.name || 'Unknown'}
                  </p>
                  <p className="text-gray-400 text-sm">
                    @{request.user?.username || 'user'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRequest(request.id, 'accept')}
                    className="p-2 rounded-lg bg-accent text-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRequest(request.id, 'reject')}
                    className="p-2 rounded-lg bg-dark-card text-gray-400"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-dark-elevated rounded-xl p-1">
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
            activeTab === 'friends' ? 'bg-accent text-white' : 'text-gray-400'
          }`}
        >
          Friends ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
            activeTab === 'leaderboard' ? 'bg-accent text-white' : 'text-gray-400'
          }`}
        >
          Leaderboard
        </button>
        <button
          onClick={() => setActiveTab('community')}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
            activeTab === 'community' ? 'bg-accent text-white' : 'text-gray-400'
          }`}
        >
          Community
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {activeTab === 'friends' && (
            <div className="space-y-3">
              {friends.length === 0 ? (
                <div className="card text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-400">No friends yet</p>
                  <p className="text-gray-500 text-sm mt-1">Add friends to compete and stay motivated</p>
                  <button
                    onClick={openAddModal}
                    className="btn-primary mt-4"
                  >
                    Add Your First Friend
                  </button>
                </div>
              ) : (
                friends.map((friend) => (
                  <div key={friend.id} className="card relative">
                    {confirmUnfriend === friend.id ? (
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-white text-sm">Remove {friend.name} as friend?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmUnfriend(null)}
                            className="px-3 py-1.5 bg-dark-elevated text-gray-300 text-sm rounded-lg hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => unfriendUser(friend.id)}
                            className="px-3 py-1.5 bg-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/30"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => navigate(`/friend/${friend.id}`)}
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium text-sm sm:text-base flex-shrink-0">
                          {getInitials(friend.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium text-sm sm:text-base truncate">{friend.name}</h3>
                          <p className="text-gray-400 text-xs sm:text-sm truncate">@{friend.username || 'user'}</p>
                          <p className="text-gray-500 text-xs sm:hidden">{friend.workoutCount || 0} workouts • {friend.streak || 0} day streak</p>
                        </div>
                        <div className="hidden sm:block text-right text-sm flex-shrink-0">
                          <p className="text-white">{friend.workoutCount || 0} workouts</p>
                          <p className="text-gray-500">{friend.streak || 0} day streak</p>
                        </div>
                        <FollowButton
                          friendId={friend.id}
                          initialFollowing={friend.isFollowing}
                          size="small"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmUnfriend(friend.id)
                          }}
                          className="p-1.5 sm:p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                          title="Remove friend"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="card">
              <LeaderboardCard />
            </div>
          )}

          {activeTab === 'community' && (
            <div className="space-y-4">
              {/* Top Row - 2 cards side by side */}
              <div className="grid grid-cols-2 gap-3">
                {/* Friends Working Out */}
                <div className="card bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">💪</span>
                    <h3 className="text-white font-medium text-sm">Working Out</h3>
                  </div>
                  {friends.filter(f => f.isActive).length > 0 ? (
                    <div className="flex -space-x-2">
                      {friends.filter(f => f.isActive).slice(0, 4).map((friend) => (
                        <div key={friend.id} className="w-8 h-8 rounded-full bg-accent/30 border-2 border-dark-card flex items-center justify-center text-accent text-xs font-medium">
                          {getInitials(friend.name)}
                        </div>
                      ))}
                      {friends.filter(f => f.isActive).length > 4 && (
                        <div className="w-8 h-8 rounded-full bg-dark-elevated border-2 border-dark-card flex items-center justify-center text-gray-400 text-xs">
                          +{friends.filter(f => f.isActive).length - 4}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs">No one active now</p>
                  )}
                </div>

                {/* PRs Today */}
                <div className="card bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🏆</span>
                    <h3 className="text-white font-medium text-sm">PRs Today</h3>
                  </div>
                  {friends.filter(f => f.recentPR).length > 0 ? (
                    <div className="space-y-1">
                      {friends.filter(f => f.recentPR).slice(0, 2).map((friend) => (
                        <div key={friend.id} className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-yellow-500/30 flex items-center justify-center text-yellow-400 text-[10px] font-bold">
                            {getInitials(friend.name).charAt(0)}
                          </div>
                          <span className="text-gray-300 text-xs truncate">{friend.name.split(' ')[0]}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs">No PRs yet today</p>
                  )}
                </div>
              </div>

              {/* Streaks Card */}
              <div className="card bg-gradient-to-r from-purple-500/20 via-pink-500/10 to-orange-500/10 border border-purple-500/20 p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔥</span>
                    <h3 className="text-white font-medium text-sm">Top Streaks</h3>
                  </div>
                </div>
                {friends.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {[...friends].sort((a, b) => (b.streak || 0) - (a.streak || 0)).slice(0, 5).map((friend, i) => (
                      <div key={friend.id} className="flex-shrink-0 flex flex-col items-center gap-1 bg-dark-elevated/50 rounded-xl p-2 min-w-[60px]">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-medium">
                            {getInitials(friend.name)}
                          </div>
                          {i < 3 && (
                            <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : 'bg-orange-600 text-white'
                            }`}>
                              {i + 1}
                            </div>
                          )}
                        </div>
                        <span className="text-white text-xs font-medium">{friend.streak || 0}d</span>
                        <span className="text-gray-500 text-[10px] truncate max-w-[50px]">{friend.name.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs text-center">Add friends to see streaks</p>
                )}
              </div>

              {/* Recent Achievements */}
              <div className="card bg-gradient-to-br from-green-500/20 to-teal-500/10 border border-green-500/20 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">✨</span>
                  <h3 className="text-white font-medium text-sm">Friend Achievements</h3>
                </div>
                {friends.filter(f => f.recentAchievement).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {friends.filter(f => f.recentAchievement).slice(0, 4).map((friend) => (
                      <div key={friend.id} className="flex items-center gap-2 bg-dark-elevated/50 rounded-full px-3 py-1.5">
                        <span className="text-sm">{friend.recentAchievement?.icon || '🏅'}</span>
                        <span className="text-gray-300 text-xs">{friend.name.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs">No recent achievements</p>
                )}
              </div>

              {/* Mini Leaderboard */}
              <div className="card bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/20 p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🥇</span>
                    <h3 className="text-white font-medium text-sm">Weekly Leaderboard</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('leaderboard')}
                    className="text-accent text-xs hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-2">
                  {leaderboard.slice(0, 3).map((entry, index) => {
                    const isUser = entry.userId === user?.id || entry.id === user?.id
                    return (
                      <div key={entry.id || index} className="flex items-center gap-2 bg-dark-elevated/50 rounded-lg p-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500 text-black' :
                          index === 1 ? 'bg-gray-400 text-black' :
                          'bg-orange-600 text-white'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-medium">
                          {getInitials(entry.name)}
                        </div>
                        <span className={`flex-1 text-sm truncate ${isUser ? 'text-accent font-medium' : 'text-white'}`}>
                          {isUser ? 'You' : entry.name.split(' ')[0]}
                        </span>
                        <span className="text-gray-400 text-xs">{entry.workoutCount || entry.workouts || 0}</span>
                      </div>
                    )
                  })}
                  {leaderboard.length === 0 && (
                    <p className="text-gray-500 text-xs text-center py-2">No data yet</p>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="card bg-dark-elevated text-center p-3">
                  <p className="text-2xl font-bold text-white">{friends.length}</p>
                  <p className="text-gray-500 text-xs">Friends</p>
                </div>
                <div className="card bg-dark-elevated text-center p-3">
                  <p className="text-2xl font-bold text-accent">
                    {leaderboard.findIndex(e => e.userId === user?.id || e.id === user?.id) + 1 || '-'}
                  </p>
                  <p className="text-gray-500 text-xs">Your Rank</p>
                </div>
                <div className="card bg-dark-elevated text-center p-3">
                  <p className="text-2xl font-bold text-orange-400">
                    {leaderboard.find(e => e.userId === user?.id || e.id === user?.id)?.streak || 0}
                  </p>
                  <p className="text-gray-500 text-xs">Your Streak</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Friend Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowAddModal(false)}>
          <div
            className="bg-dark-card w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Add Friend</h2>
                <button onClick={() => setShowAddModal(false)} className="btn-ghost p-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                type="text"
                placeholder="Search by username or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  searchUsers(e.target.value)
                }}
                className="input w-full"
                autoFocus
              />
            </div>

            <div className="p-4">
              {/* Feedback Toast */}
              {requestFeedback && (
                <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 ${
                  requestFeedback.type === 'success' ? 'bg-success/20 text-success' :
                  requestFeedback.type === 'pending' ? 'bg-accent/20 text-accent' :
                  'bg-error/20 text-error'
                }`}>
                  {requestFeedback.type === 'success' && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {requestFeedback.type === 'pending' && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {requestFeedback.type === 'error' && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span className="text-sm">{requestFeedback.message}</span>
                </div>
              )}

              {searching ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div key={result.id} className="flex items-center gap-3 p-3 bg-dark-elevated rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium">
                        {getInitials(result.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{result.name}</p>
                        <p className="text-gray-400 text-sm">@{result.username}</p>
                        {result.requiresApproval && (
                          <p className="text-yellow-500 text-xs mt-0.5 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Requires approval
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => sendFriendRequest(result.id)}
                        className="btn-primary text-sm py-1.5 px-3"
                      >
                        {result.requiresApproval ? 'Request' : 'Follow'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">No users found</p>
                  <p className="text-gray-500 text-sm mt-1">Try a different search term</p>
                </div>
              ) : loadingDiscoverable ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : discoverableUsers.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-gray-400 text-sm mb-3">People you can add</p>
                  {discoverableUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 p-3 bg-dark-elevated rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium">
                        {getInitials(user.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{user.name}</p>
                        <p className="text-gray-400 text-sm">@{user.username}</p>
                      </div>
                      <button
                        onClick={() => sendFriendRequest(user.id)}
                        className="btn-primary text-sm py-1.5 px-3"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-400">No public users available</p>
                  <p className="text-gray-500 text-sm mt-1">Search by username or email to find more people</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Social
