import { useState, useEffect } from 'react'
import api from '../services/api'

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CopyWorkoutModal({ onClose, onCopyExercises, showOwnSchedule = false }) {
  const [tab, setTab] = useState(showOwnSchedule ? 'schedule' : 'friends')
  const [friends, setFriends] = useState([])
  const [mySchedule, setMySchedule] = useState([])
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [friendSchedule, setFriendSchedule] = useState(null)
  const [friendScheduleMessage, setFriendScheduleMessage] = useState('')
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedExercises, setSelectedExercises] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tab === 'friends' && friends.length === 0) {
      fetchFriends()
    }
    if (tab === 'schedule' && mySchedule.length === 0) {
      fetchMySchedule()
    }
  }, [tab])

  const fetchFriends = async () => {
    setLoading(true)
    try {
      const res = await api.get('/social/friends')
      setFriends(res.data.friends || [])
    } catch (err) {
      console.error('Error fetching friends:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMySchedule = async () => {
    setLoading(true)
    try {
      const res = await api.get('/schedules/weekly')
      setMySchedule(res.data.schedules || [])
    } catch (err) {
      console.error('Error fetching schedule:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchFriendSchedule = async (friendId) => {
    setLoading(true)
    setFriendScheduleMessage('')
    try {
      const res = await api.get(`/social/friend/${friendId}/schedule`)
      if (res.data.canView === false) {
        setFriendSchedule([])
        setFriendScheduleMessage(res.data.message || 'This user keeps their schedule private')
      } else {
        setFriendSchedule(res.data.schedule || [])
      }
    } catch (err) {
      console.error('Error fetching friend schedule:', err)
      setFriendScheduleMessage('Could not load schedule')
    } finally {
      setLoading(false)
    }
  }

  const selectFriend = (friend) => {
    setSelectedFriend(friend)
    setFriendSchedule(null)
    setSelectedDay(null)
    setSelectedExercises([])
    fetchFriendSchedule(friend.id)
  }

  const getScheduleForDay = (dayOfWeek, schedule) => {
    return schedule.find(s => (s.dayOfWeek ?? s.day) === dayOfWeek)
  }

  const selectDay = (daySchedule) => {
    if (!daySchedule || daySchedule.isRestDay) return
    setSelectedDay(daySchedule)
    // Select all exercises by default
    const exercises = daySchedule.exercises || []
    setSelectedExercises(exercises.map((_, i) => i))
  }

  const toggleExercise = (idx) => {
    setSelectedExercises(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    )
  }

  const selectAll = () => {
    if (!selectedDay) return
    setSelectedExercises(selectedDay.exercises.map((_, i) => i))
  }

  const deselectAll = () => {
    setSelectedExercises([])
  }

  const handleCopy = () => {
    if (!selectedDay || selectedExercises.length === 0) return
    const exercises = selectedDay.exercises
      .filter((_, i) => selectedExercises.includes(i))
      .map(ex => ({
        exerciseId: ex.exerciseId || ex.id,
        exerciseName: ex.exerciseName || ex.name,
        sets: ex.sets || 3,
        reps: ex.reps || '8-12'
      }))
    onCopyExercises(exercises)
    onClose()
  }

  const goBack = () => {
    if (selectedDay) {
      setSelectedDay(null)
      setSelectedExercises([])
    } else if (selectedFriend) {
      setSelectedFriend(null)
      setFriendSchedule(null)
    }
  }

  // Determine current view title
  const getTitle = () => {
    if (selectedDay) {
      const dayName = dayNames[selectedDay.dayOfWeek ?? selectedDay.day] || 'Workout'
      if (selectedFriend) return `${selectedFriend.name}'s ${dayName}`
      return dayName
    }
    if (selectedFriend) return `${selectedFriend.name}'s Schedule`
    if (tab === 'schedule') return 'Copy from My Schedule'
    return 'Copy from Friend'
  }

  const showBackButton = selectedDay || selectedFriend

  // Render schedule days list
  const renderDaysList = (schedule, isFriend = false) => {
    const days = [1, 2, 3, 4, 5, 6, 0] // Mon-Sun
    return (
      <div className="space-y-2">
        {days.map(dayOfWeek => {
          const daySchedule = getScheduleForDay(dayOfWeek, schedule)
          const isRest = !daySchedule || daySchedule.isRestDay
          const exerciseCount = daySchedule?.exercises?.length || 0
          return (
            <button
              key={dayOfWeek}
              disabled={isRest || exerciseCount === 0}
              onClick={() => selectDay(daySchedule)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-colors ${
                isRest || exerciseCount === 0
                  ? 'opacity-40 cursor-not-allowed bg-dark-elevated'
                  : 'bg-dark-elevated hover:bg-dark-border cursor-pointer'
              }`}
            >
              <div className="w-10 text-center">
                <p className="text-gray-400 text-xs">{dayShorts[dayOfWeek]}</p>
              </div>
              <div className="flex-1 text-left">
                <p className={`font-medium ${isRest ? 'text-gray-500' : 'text-white'}`}>
                  {daySchedule?.name || (isRest ? 'Rest Day' : 'Not Set')}
                </p>
                {!isRest && exerciseCount > 0 && (
                  <p className="text-gray-400 text-sm">{exerciseCount} exercises</p>
                )}
              </div>
              {!isRest && exerciseCount > 0 && (
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // Render exercise selection for a day
  const renderExerciseSelection = () => {
    if (!selectedDay) return null
    const exercises = selectedDay.exercises || []
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-sm">{exercises.length} exercises</p>
          <button
            onClick={selectedExercises.length === exercises.length ? deselectAll : selectAll}
            className="text-accent text-sm hover:text-accent-hover"
          >
            {selectedExercises.length === exercises.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="space-y-2">
          {exercises.map((ex, idx) => {
            const isSelected = selectedExercises.includes(idx)
            return (
              <button
                key={idx}
                onClick={() => toggleExercise(idx)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  isSelected ? 'bg-accent/20 border border-accent/40' : 'bg-dark-elevated hover:bg-dark-border'
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-accent border-accent' : 'border-gray-500'
                }`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium">{ex.exerciseName || ex.name}</p>
                  <p className="text-gray-400 text-sm">{ex.sets} sets × {ex.reps} reps</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[70] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-dark-card w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border rounded-t-3xl sm:rounded-t-3xl z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {showBackButton && (
                <button onClick={goBack} className="text-gray-400 hover:text-white p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <h2 className="text-lg font-bold text-white">{getTitle()}</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs - only show at top level */}
          {!selectedFriend && !selectedDay && (
            <div className="flex gap-2 mt-3">
              {showOwnSchedule && (
                <button
                  onClick={() => setTab('schedule')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    tab === 'schedule' ? 'bg-accent text-white' : 'bg-dark-elevated text-gray-400 hover:text-white'
                  }`}
                >
                  My Schedule
                </button>
              )}
              <button
                onClick={() => setTab('friends')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'friends' ? 'bg-accent text-white' : 'bg-dark-elevated text-gray-400 hover:text-white'
                }`}
              >
                Friends
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            </div>
          ) : selectedDay ? (
            renderExerciseSelection()
          ) : selectedFriend ? (
            // Friend's schedule days
            friendScheduleMessage ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-gray-400">{friendScheduleMessage}</p>
              </div>
            ) : friendSchedule && friendSchedule.length > 0 ? (
              renderDaysList(friendSchedule, true)
            ) : (
              <p className="text-gray-500 text-center py-12">No schedule found</p>
            )
          ) : tab === 'schedule' ? (
            // My schedule days
            mySchedule.length > 0 ? (
              renderDaysList(mySchedule)
            ) : (
              <p className="text-gray-500 text-center py-12">No weekly schedule set up yet</p>
            )
          ) : (
            // Friends list
            friends.length > 0 ? (
              <div className="space-y-2">
                {friends.map(friend => (
                  <button
                    key={friend.id}
                    onClick={() => selectFriend(friend)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-dark-elevated hover:bg-dark-border transition-colors"
                  >
                    {friend.avatarUrl ? (
                      <img src={friend.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                        <span className="text-accent font-bold text-sm">
                          {(friend.name || friend.username || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium">{friend.name || friend.username}</p>
                      {friend.username && friend.name && (
                        <p className="text-gray-400 text-sm">@{friend.username}</p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-gray-400">No friends yet</p>
                <p className="text-gray-500 text-sm mt-1">Add friends from the Social page</p>
              </div>
            )
          )}
        </div>

        {/* Copy Button */}
        {selectedDay && selectedExercises.length > 0 && (
          <div className="sticky bottom-0 bg-dark-card p-4 border-t border-dark-border">
            <button
              onClick={handleCopy}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy {selectedExercises.length} Exercise{selectedExercises.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CopyWorkoutModal
