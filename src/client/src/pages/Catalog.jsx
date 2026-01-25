import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import api from '../services/api'
import { useAuthStore } from '../services/authStore'
import ChatWidget from '../components/ChatWidget'

// Display labels for equipment
const equipmentLabels = {
  'barbell': 'Barbell',
  'dumbbell': 'Dumbbells',
  'kettlebells': 'Kettlebells',
  'cable': 'Cable Machine',
  'machine': 'Machines (General)',
  'bands': 'Resistance Bands',
  'medicine ball': 'Medicine Ball',
  'exercise ball': 'Exercise/Stability Ball',
  'foam roll': 'Foam Roller',
  'e-z curl bar': 'EZ Curl Bar',
  'body only': 'Bodyweight Only',
  'other': 'Other Equipment',
  'flat bench': 'Flat Bench',
  'incline bench': 'Incline Bench',
  'decline bench': 'Decline Bench',
  'pull-up bar': 'Pull-Up Bar',
  'dip bars': 'Dip Bars/Station',
  // Specific Machines - Legs
  'leg extension machine': 'Leg Extension Machine',
  'leg curl machine': 'Leg Curl Machine',
  'leg press': 'Leg Press',
  'hack squat machine': 'Hack Squat Machine',
  'hip abductor/adductor': 'Hip Abductor/Adductor',
  'seated calf raise machine': 'Seated Calf Raise',
  'standing calf raise machine': 'Standing Calf Raise',
  'glute ham raise': 'Glute Ham Raise (GHD)',
  // Specific Machines - Upper Body
  'smith machine': 'Smith Machine',
  'chest press machine': 'Chest Press Machine',
  'shoulder press machine': 'Shoulder Press Machine',
  'pec deck machine': 'Pec Deck / Rear Delt Fly',
  'lat pulldown': 'Lat Pulldown',
  'row machine': 'Seated Row Machine',
  't-bar row': 'T-Bar Row',
  'bicep curl machine': 'Bicep Curl Machine',
  'preacher curl machine': 'Preacher Curl Machine',
  'tricep extension machine': 'Tricep Extension Machine',
  'assisted dip machine': 'Assisted Dip/Pull-Up',
  'ab crunch machine': 'Ab Crunch Machine',
  'reverse hyper machine': 'Reverse Hyper',
  // Cardio
  'treadmill': 'Treadmill',
  'stationary bike': 'Stationary Bike',
  'elliptical': 'Elliptical',
  'rowing machine': 'Rowing Machine',
  'stair climber': 'Stair Climber'
}

function Catalog() {
  const user = useAuthStore((state) => state.user)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState('')
  const [selectedEquipment, setSelectedEquipment] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')
  const [filterOptions, setFilterOptions] = useState({ muscles: [], equipment: [], levels: [] })
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [myEquipmentOnly, setMyEquipmentOnly] = useState(false)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [userEquipment, setUserEquipment] = useState([])
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState(false)
  const [exerciseNicknames, setExerciseNicknames] = useState({}) // Map of exerciseId -> nickname
  const limit = 30

  // Load user equipment from localStorage and fetch filter options on mount
  useEffect(() => {
    // Load user's equipment settings
    const savedTraining = localStorage.getItem('trainingSettings')
    if (savedTraining) {
      const parsed = JSON.parse(savedTraining)
      if (parsed.equipmentAccess) {
        setUserEquipment(parsed.equipmentAccess)
      }
    }

    const fetchFilters = async () => {
      try {
        const response = await api.get('/exercises/filters/options')
        setFilterOptions(response.data)
      } catch (error) {
        console.error('Error fetching filters:', error)
      }
    }
    fetchFilters()

    // Load user's favorite exercise IDs
    const loadFavorites = async () => {
      try {
        const response = await api.get('/exercises/favorites')
        const ids = new Set(response.data.exercises?.map(e => e.id) || [])
        setFavoriteIds(ids)
      } catch (error) {
        console.log('Could not load favorites')
      }
    }
    loadFavorites()
  }, [])

  // Get equipment filter from user's selected equipment
  // Equipment values now match the catalog directly (e.g., 'barbell', 'dumbbell', 'cable')
  const getMyEquipmentFilter = useCallback(() => {
    if (!myEquipmentOnly || userEquipment.length === 0) return null
    return userEquipment.join(',')
  }, [myEquipmentOnly, userEquipment])

  // Fetch exercises
  const fetchExercises = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      })
      if (searchQuery) params.append('search', searchQuery)
      if (selectedMuscle) params.append('muscle', selectedMuscle)

      // Use my equipment filter if enabled, otherwise use selected equipment dropdown
      const myEquipmentFilter = getMyEquipmentFilter()
      if (myEquipmentFilter) {
        params.append('equipment', myEquipmentFilter)
      } else if (selectedEquipment) {
        params.append('equipment', selectedEquipment)
      }

      if (selectedLevel) params.append('level', selectedLevel)

      const response = await api.get(`/exercises?${params}`)
      let fetchedExercises = response.data.exercises
      let fetchedTotal = response.data.total

      // Load nicknames and favorites for these exercises
      const exerciseIds = fetchedExercises.map(e => e.id)
      if (exerciseIds.length > 0) {
        try {
          const prefsResponse = await api.post('/exercises/preferences/batch', { ids: exerciseIds })
          const nicknames = {}
          const favIds = new Set(favoriteIds) // Start with existing favorites
          prefsResponse.data.preferences?.forEach(pref => {
            if (pref.nickname) {
              nicknames[pref.exerciseId] = pref.nickname
            }
            if (pref.isFavorite) {
              favIds.add(pref.exerciseId)
            }
          })
          setExerciseNicknames(prev => ({ ...prev, ...nicknames }))
          setFavoriteIds(favIds)
        } catch (err) {
          // Preferences endpoint might fail if db not migrated, continue without nicknames
          console.log('Could not load exercise preferences')
        }
      }

      // Filter to favorites only if enabled
      if (favoritesOnly) {
        fetchedExercises = fetchedExercises.filter(e => favoriteIds.has(e.id))
        fetchedTotal = fetchedExercises.length
      }

      setExercises(fetchedExercises)
      setTotal(fetchedTotal)
    } catch (error) {
      console.error('Error fetching exercises:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedMuscle, selectedEquipment, selectedLevel, offset, getMyEquipmentFilter, favoritesOnly, favoriteIds])

  useEffect(() => {
    const debounce = setTimeout(() => {
      setOffset(0)
      fetchExercises()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, selectedMuscle, selectedEquipment, selectedLevel, myEquipmentOnly, favoritesOnly])

  useEffect(() => {
    fetchExercises()
  }, [offset])

  const muscleGroups = [
    { id: '', label: 'All Muscles' },
    { id: 'chest', label: 'Chest' },
    { id: 'back', label: 'Back' },
    { id: 'shoulders', label: 'Shoulders' },
    { id: 'biceps', label: 'Biceps' },
    { id: 'triceps', label: 'Triceps' },
    { id: 'forearms', label: 'Forearms' },
    { id: 'quadriceps', label: 'Quads' },
    { id: 'hamstrings', label: 'Hamstrings' },
    { id: 'glutes', label: 'Glutes' },
    { id: 'calves', label: 'Calves' },
    { id: 'abdominals', label: 'Abs' },
  ]

  const levelColors = {
    beginner: 'bg-success/20 text-success',
    intermediate: 'bg-warning/20 text-warning',
    expert: 'bg-error/20 text-error'
  }

  // Filter equipment options based on search
  const filteredEquipmentOptions = useMemo(() => {
    const search = equipmentSearch.toLowerCase()
    return (filterOptions.equipment || []).filter(equip => {
      const label = equipmentLabels[equip] || equip
      return label.toLowerCase().includes(search) || equip.toLowerCase().includes(search)
    })
  }, [filterOptions.equipment, equipmentSearch])

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Exercise Catalog</h1>
        <p className="text-gray-400">{total.toLocaleString()} exercises available</p>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search exercises..."
          className="input pl-12"
        />
      </div>

      {/* Muscle Group Pills */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
        {muscleGroups.map((muscle) => (
          <button
            key={muscle.id}
            onClick={() => setSelectedMuscle(muscle.id)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              selectedMuscle === muscle.id
                ? 'bg-accent text-white'
                : 'bg-dark-elevated text-gray-400 hover:text-white'
            }`}
          >
            {muscle.label}
          </button>
        ))}
      </div>

      {/* My Equipment Toggle */}
      {userEquipment.length > 0 && (
        <div className="flex items-center justify-between bg-dark-card rounded-xl p-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <div>
              <p className="text-white text-sm font-medium">My Equipment Only</p>
              <p className="text-gray-500 text-xs">Hide exercises requiring equipment I don't have</p>
            </div>
          </div>
          <button
            onClick={() => setMyEquipmentOnly(!myEquipmentOnly)}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              myEquipmentOnly ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              myEquipmentOnly ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      )}

      {/* Favorites Only Toggle */}
      {favoriteIds.size > 0 && (
        <div className="flex items-center justify-between bg-dark-card rounded-xl p-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <div>
              <p className="text-white text-sm font-medium">My Favorites Only</p>
              <p className="text-gray-500 text-xs">Show only exercises I've starred ({favoriteIds.size})</p>
            </div>
          </div>
          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              favoritesOnly ? 'bg-yellow-400' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              favoritesOnly ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      )}

      {/* Additional Filters */}
      <div className="flex gap-2">
        {/* Equipment Searchable Dropdown */}
        <div className="relative flex-1">
          <div
            className={`input text-sm cursor-pointer flex items-center justify-between ${myEquipmentOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !myEquipmentOnly && setShowEquipmentDropdown(!showEquipmentDropdown)}
          >
            <span className={selectedEquipment ? 'text-white' : 'text-gray-400'}>
              {selectedEquipment ? (equipmentLabels[selectedEquipment] || selectedEquipment) : 'All Equipment'}
            </span>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {showEquipmentDropdown && !myEquipmentOnly && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowEquipmentDropdown(false)} />
              <div className="absolute z-20 w-full mt-1 bg-dark-card border border-dark-border rounded-xl shadow-lg max-h-64 overflow-hidden">
                {/* Search Input */}
                <div className="p-2 border-b border-dark-border">
                  <input
                    type="text"
                    value={equipmentSearch}
                    onChange={(e) => setEquipmentSearch(e.target.value)}
                    placeholder="Search equipment..."
                    className="input w-full text-sm py-2"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Options List */}
                <div className="max-h-48 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedEquipment('')
                      setShowEquipmentDropdown(false)
                      setEquipmentSearch('')
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-dark-elevated transition-colors ${
                      !selectedEquipment ? 'text-accent' : 'text-gray-300'
                    }`}
                  >
                    All Equipment
                  </button>
                  {filteredEquipmentOptions.map(eq => (
                    <button
                      key={eq}
                      onClick={() => {
                        setSelectedEquipment(eq)
                        setShowEquipmentDropdown(false)
                        setEquipmentSearch('')
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-dark-elevated transition-colors ${
                        selectedEquipment === eq ? 'text-accent' : 'text-gray-300'
                      }`}
                    >
                      {equipmentLabels[eq] || eq}
                    </button>
                  ))}
                  {filteredEquipmentOptions.length === 0 && equipmentSearch && (
                    <div className="px-4 py-3 text-gray-500 text-sm text-center">
                      No equipment found
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="input flex-1 text-sm"
        >
          <option value="">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="expert">Expert</option>
        </select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Exercise List */}
      {!loading && (
        <div className="space-y-3">
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              onClick={() => setSelectedExercise(exercise)}
              className="card flex items-center gap-4 cursor-pointer hover:bg-dark-elevated transition-colors"
            >
              {/* Exercise Image */}
              <div className="w-16 h-16 rounded-xl bg-dark-elevated flex-shrink-0 overflow-hidden flex items-center justify-center">
                {exercise.images?.[0] ? (
                  <img
                    src={`/api/exercise-images/${exercise.images[0]}`}
                    alt={exercise.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className={`w-full h-full items-center justify-center ${exercise.images?.[0] ? 'hidden' : 'flex'}`}>
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate">
                  {exerciseNicknames[exercise.id] || exercise.name}
                </h3>
                {exerciseNicknames[exercise.id] && (
                  <p className="text-gray-500 text-xs truncate">{exercise.name}</p>
                )}
                <p className="text-gray-400 text-sm capitalize">
                  {exercise.primaryMuscles?.join(', ')} • {exercise.equipment}
                </p>
                {exercise.level && (
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${levelColors[exercise.level] || 'bg-gray-500/20 text-gray-400'}`}>
                    {exercise.level}
                  </span>
                )}
              </div>

              {/* Chevron */}
              <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && total > limit && (
        <div className="flex justify-center gap-2 pt-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="btn-secondary px-4 py-2 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="flex items-center text-gray-400 px-4">
            {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="btn-secondary px-4 py-2 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Exercise Detail Modal */}
      {selectedExercise && (
        <ExerciseDetailModal
          exercise={selectedExercise}
          onClose={() => setSelectedExercise(null)}
          isAdmin={user?.role?.toLowerCase() === 'admin'}
          onExerciseUpdated={fetchExercises}
          onNicknameChange={(exerciseId, newNickname) => {
            setExerciseNicknames(prev => ({
              ...prev,
              [exerciseId]: newNickname || undefined
            }))
          }}
          onFavoriteChange={(exerciseId, isFavorite) => {
            setFavoriteIds(prev => {
              const newSet = new Set(prev)
              if (isFavorite) {
                newSet.add(exerciseId)
              } else {
                newSet.delete(exerciseId)
              }
              return newSet
            })
          }}
        />
      )}

      {/* AI Coach Chat */}
      <ChatWidget context="catalog" />
    </div>
  )
}

// Exercise Detail Modal Component
function ExerciseDetailModal({ exercise, onClose, isAdmin, onExerciseUpdated, onNicknameChange, onFavoriteChange }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [notes, setNotes] = useState('')
  const [nickname, setNickname] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [nicknameSaved, setNicknameSaved] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const nicknameTimeoutRef = useRef(null)

  // Load existing preferences for this exercise
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const response = await api.get(`/exercises/${exercise.id}/notes`)
        setNotes(response.data.notes || '')
        setNickname(response.data.nickname || '')
        setIsFavorite(response.data.isFavorite || false)
        setPrefsLoaded(true)
      } catch (error) {
        // Preferences might not exist yet, that's ok
        console.log('No preferences found for exercise')
        setPrefsLoaded(true)
      }
    }
    loadPrefs()
  }, [exercise.id])

  // Save notes
  const saveNotes = async () => {
    setNotesSaving(true)
    try {
      await api.put(`/exercises/${exercise.id}/notes`, { notes })
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } catch (error) {
      console.error('Error saving notes:', error)
    } finally {
      setNotesSaving(false)
    }
  }

  // Save nickname with debounce
  const saveNickname = async (value) => {
    try {
      await api.put(`/exercises/${exercise.id}/nickname`, { nickname: value })
      setNicknameSaved(true)
      setTimeout(() => setNicknameSaved(false), 2000)
      // Notify parent to update the list
      if (onNicknameChange) {
        onNicknameChange(exercise.id, value)
      }
    } catch (error) {
      console.error('Error saving nickname:', error)
    }
  }

  // Handle nickname change with debounced auto-save
  const handleNicknameChange = (value) => {
    setNickname(value)
    // Clear existing timeout
    if (nicknameTimeoutRef.current) {
      clearTimeout(nicknameTimeoutRef.current)
    }
    // Set new timeout to save after 800ms of no typing
    nicknameTimeoutRef.current = setTimeout(() => {
      saveNickname(value)
    }, 800)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (nicknameTimeoutRef.current) {
        clearTimeout(nicknameTimeoutRef.current)
      }
    }
  }, [])

  // Toggle favorite status
  const toggleFavorite = async () => {
    const newValue = !isFavorite
    setIsFavorite(newValue)
    try {
      await api.put(`/exercises/${exercise.id}/favorite`, { isFavorite: newValue })
      // Notify parent to update favoriteIds
      if (onFavoriteChange) {
        onFavoriteChange(exercise.id, newValue)
      }
    } catch (error) {
      setIsFavorite(!newValue) // Revert on error
      console.error('Error toggling favorite:', error)
    }
  }

  const goToPreviousImage = () => {
    setCurrentImageIndex(prev =>
      prev === 0 ? exercise.images.length - 1 : prev - 1
    )
  }

  const goToNextImage = () => {
    setCurrentImageIndex(prev =>
      prev === exercise.images.length - 1 ? 0 : prev + 1
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-dark-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border z-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-white truncate pr-4">{exercise.name}</h2>
            <div className="flex items-center gap-2">
              {/* Favorite Toggle */}
              <button
                onClick={toggleFavorite}
                className={`btn-ghost p-2 transition-colors ${
                  isFavorite ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'
                }`}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <svg className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="btn-ghost p-2 text-accent hover:bg-accent/10"
                  title="Edit Exercise"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              <button onClick={onClose} className="btn-ghost p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          {/* Nickname Input - Right below exercise name */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={nickname}
                onChange={(e) => handleNicknameChange(e.target.value)}
                placeholder="Add a nickname..."
                className="input w-full text-sm py-2 pr-16"
              />
              {nicknameSaved && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success text-xs flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Exercise Images */}
          <div className="aspect-video bg-dark-elevated rounded-xl overflow-hidden flex items-center justify-center relative">
            {exercise.images?.length > 0 ? (
              <>
                <img
                  src={`/api/exercise-images/${exercise.images[currentImageIndex]}`}
                  alt={exercise.name}
                  className="w-full h-full object-contain bg-dark-elevated"
                  onError={(e) => {
                    e.target.src = ''
                    e.target.style.display = 'none'
                  }}
                />

                {/* Left/Right Navigation Arrows */}
                {exercise.images.length > 1 && (
                  <>
                    <button
                      onClick={goToPreviousImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={goToNextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}

                {/* Pagination Dots */}
                {exercise.images.length > 1 && (
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
                    {exercise.images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          idx === currentImageIndex ? 'bg-accent' : 'bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center">
                <svg className="w-16 h-16 text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-500 text-sm">Exercise demonstration</p>
              </div>
            )}
          </div>

          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <p className="text-gray-400 text-xs">Primary Muscles</p>
              <p className="text-white font-medium capitalize">{exercise.primaryMuscles?.join(', ') || 'N/A'}</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-xs">Equipment</p>
              <p className="text-white font-medium capitalize">{exercise.equipment || 'N/A'}</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-xs">Level</p>
              <p className="text-white font-medium capitalize">{exercise.level || 'N/A'}</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-xs">Category</p>
              <p className="text-white font-medium capitalize">{exercise.category || 'N/A'}</p>
            </div>
          </div>

          {/* Secondary Muscles */}
          {exercise.secondaryMuscles?.length > 0 && (
            <div>
              <h3 className="text-gray-400 text-sm mb-2">Secondary Muscles</h3>
              <div className="flex flex-wrap gap-2">
                {exercise.secondaryMuscles.map((muscle) => (
                  <span key={muscle} className="px-3 py-1 bg-dark-elevated rounded-full text-sm text-white capitalize">
                    {muscle}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          {exercise.instructions?.length > 0 && (
            <div>
              <h3 className="text-white font-medium mb-3">Instructions</h3>
              <ol className="space-y-3">
                {exercise.instructions.map((step, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm flex-shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-gray-300 text-sm leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Personal Notes Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-medium">My Notes</h3>
              {notesSaved && (
                <span className="text-success text-xs flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder="Add personal notes about this exercise (form tips, weight used, variations, etc.)"
              className="input w-full h-24 resize-none text-sm"
            />
            <p className="text-gray-500 text-xs mt-1">Notes save automatically when you click away</p>
          </div>

          {/* Add to Workout Button */}
          <button className="btn-primary w-full">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add to Today's Workout
          </button>
        </div>
      </div>

      {/* Admin Edit Modal */}
      {showEditModal && isAdmin && (
        <ExerciseEditModal
          exercise={exercise}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            setShowEditModal(false)
            onClose() // Close the detail modal too
            if (onExerciseUpdated) onExerciseUpdated()
          }}
        />
      )}
    </div>
  )
}

// Admin Exercise Edit Modal
function ExerciseEditModal({ exercise, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: exercise.name || '',
    level: exercise.level || 'beginner',
    category: exercise.category || '',
    equipment: exercise.equipment || '',
    primaryMuscles: exercise.primaryMuscles || [],
    secondaryMuscles: exercise.secondaryMuscles || [],
    instructions: exercise.instructions || ['']
  })
  const [saving, setSaving] = useState(false)
  const [filterOptions, setFilterOptions] = useState({ muscles: [], equipment: [], categories: [] })
  const [showAddMuscle, setShowAddMuscle] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showAddEquipment, setShowAddEquipment] = useState(false)
  const [newMuscle, setNewMuscle] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newEquipment, setNewEquipment] = useState('')

  // Fetch filter options
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const response = await api.get('/exercises/filters/options')
        setFilterOptions(response.data)
      } catch (error) {
        console.error('Error fetching filters:', error)
      }
    }
    fetchFilters()
  }, [])

  // Available muscle groups
  const muscleOptions = [
    'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest',
    'forearms', 'glutes', 'hamstrings', 'lats', 'lower back', 'middle back',
    'neck', 'quadriceps', 'shoulders', 'traps', 'triceps'
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/exercises/${exercise.id}`, {
        ...formData,
        instructions: formData.instructions.filter(Boolean)
      })
      onSave()
    } catch (error) {
      console.error('Error saving exercise:', error)
      alert('Failed to save exercise')
    } finally {
      setSaving(false)
    }
  }

  const toggleMuscle = (muscle, isPrimary) => {
    const field = isPrimary ? 'primaryMuscles' : 'secondaryMuscles'
    const current = formData[field]
    if (current.includes(muscle)) {
      setFormData({ ...formData, [field]: current.filter(m => m !== muscle) })
    } else {
      setFormData({ ...formData, [field]: [...current, muscle] })
    }
  }

  const addCustomMuscle = (isPrimary) => {
    if (!newMuscle.trim()) return
    const field = isPrimary ? 'primaryMuscles' : 'secondaryMuscles'
    if (!formData[field].includes(newMuscle.toLowerCase())) {
      setFormData({ ...formData, [field]: [...formData[field], newMuscle.toLowerCase()] })
    }
    setNewMuscle('')
    setShowAddMuscle(false)
  }

  const addInstruction = () => {
    setFormData({ ...formData, instructions: [...formData.instructions, ''] })
  }

  const updateInstruction = (index, value) => {
    const updated = [...formData.instructions]
    updated[index] = value
    setFormData({ ...formData, instructions: updated })
  }

  const removeInstruction = (index) => {
    if (formData.instructions.length === 1) return
    const updated = formData.instructions.filter((_, i) => i !== index)
    setFormData({ ...formData, instructions: updated })
  }

  const moveInstruction = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= formData.instructions.length) return
    const updated = [...formData.instructions]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setFormData({ ...formData, instructions: updated })
  }

  // Combine existing options with fetched options
  const categoryOptions = [...new Set([...filterOptions.categories || [], 'strength', 'cardio', 'stretching', 'plyometrics', 'powerlifting', 'strongman', 'olympic weightlifting'])].sort()
  const equipmentOptions = [...new Set([...filterOptions.equipment || [], 'body only', 'barbell', 'dumbbell', 'cable', 'machine', 'kettlebell', 'bands', 'medicine ball', 'exercise ball', 'foam roll', 'e-z curl bar', 'other'])].sort()

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-dark-card w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-white">Edit Exercise</h2>
          <button onClick={onClose} className="btn-ghost p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Exercise Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full text-lg"
              required
            />
          </div>

          {/* Level, Category, Equipment Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Level</label>
              <select
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="input w-full"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Category</label>
              {showAddCategory ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="input flex-1"
                    placeholder="New category"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newCategory.trim()) {
                        setFormData({ ...formData, category: newCategory.toLowerCase() })
                      }
                      setNewCategory('')
                      setShowAddCategory(false)
                    }}
                    className="btn-primary px-3"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddCategory(false); setNewCategory('') }}
                    className="btn-ghost px-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input flex-1"
                  >
                    <option value="">Select category</option>
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(true)}
                    className="btn-ghost px-2"
                    title="Add new category"
                  >
                    <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Equipment</label>
              {showAddEquipment ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newEquipment}
                    onChange={(e) => setNewEquipment(e.target.value)}
                    className="input flex-1"
                    placeholder="New equipment"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newEquipment.trim()) {
                        setFormData({ ...formData, equipment: newEquipment.toLowerCase() })
                      }
                      setNewEquipment('')
                      setShowAddEquipment(false)
                    }}
                    className="btn-primary px-3"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddEquipment(false); setNewEquipment('') }}
                    className="btn-ghost px-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={formData.equipment}
                    onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                    className="input flex-1"
                  >
                    <option value="">Select equipment</option>
                    {equipmentOptions.map(eq => (
                      <option key={eq} value={eq}>{eq}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddEquipment(true)}
                    className="btn-ghost px-2"
                    title="Add new equipment"
                  >
                    <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Primary Muscles */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-400 text-sm">Primary Muscles</label>
              <button
                type="button"
                onClick={() => setShowAddMuscle(!showAddMuscle)}
                className="text-accent text-sm flex items-center gap-1 hover:underline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Custom
              </button>
            </div>
            {showAddMuscle && (
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newMuscle}
                  onChange={(e) => setNewMuscle(e.target.value)}
                  className="input flex-1"
                  placeholder="Enter muscle name"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomMuscle(true))}
                />
                <button type="button" onClick={() => addCustomMuscle(true)} className="btn-primary px-4">
                  Add
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {muscleOptions.map(muscle => (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleMuscle(muscle, true)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors capitalize ${
                    formData.primaryMuscles.includes(muscle)
                      ? 'bg-accent text-white'
                      : 'bg-dark-elevated text-gray-400 hover:text-white'
                  }`}
                >
                  {muscle}
                </button>
              ))}
              {/* Show custom muscles that aren't in the default list */}
              {formData.primaryMuscles.filter(m => !muscleOptions.includes(m)).map(muscle => (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleMuscle(muscle, true)}
                  className="px-3 py-1.5 rounded-lg text-sm bg-accent text-white capitalize"
                >
                  {muscle}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Muscles */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Secondary Muscles</label>
            <div className="flex flex-wrap gap-2">
              {muscleOptions.map(muscle => (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleMuscle(muscle, false)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors capitalize ${
                    formData.secondaryMuscles.includes(muscle)
                      ? 'bg-purple-500 text-white'
                      : 'bg-dark-elevated text-gray-400 hover:text-white'
                  }`}
                >
                  {muscle}
                </button>
              ))}
              {formData.secondaryMuscles.filter(m => !muscleOptions.includes(m)).map(muscle => (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleMuscle(muscle, false)}
                  className="px-3 py-1.5 rounded-lg text-sm bg-purple-500 text-white capitalize"
                >
                  {muscle}
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-gray-400 text-sm">Instructions</label>
              <button
                type="button"
                onClick={addInstruction}
                className="text-accent text-sm flex items-center gap-1 hover:underline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Step
              </button>
            </div>
            <div className="space-y-3">
              {formData.instructions.map((instruction, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-dark-elevated/50 rounded-lg p-2 sm:p-3">
                  <span className="w-8 h-8 flex items-center justify-center text-accent font-bold text-lg flex-shrink-0 bg-accent/10 rounded-full">
                    {idx + 1}
                  </span>
                  <textarea
                    value={instruction}
                    onChange={(e) => updateInstruction(idx, e.target.value)}
                    className="input flex-1 min-h-[100px] sm:min-h-[80px] resize-none py-3 px-3 text-base leading-relaxed"
                    placeholder={`Describe step ${idx + 1}...`}
                    rows={3}
                    onInput={(e) => {
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.max(100, e.target.scrollHeight) + 'px'
                    }}
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveInstruction(idx, -1)}
                      disabled={idx === 0}
                      className="btn-ghost p-1.5 disabled:opacity-30"
                      title="Move up"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveInstruction(idx, 1)}
                      disabled={idx === formData.instructions.length - 1}
                      className="btn-ghost p-1.5 disabled:opacity-30"
                      title="Move down"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeInstruction(idx)}
                      disabled={formData.instructions.length === 1}
                      className="btn-ghost p-1.5 text-error disabled:opacity-30"
                      title="Remove step"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-dark-border">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-3">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Catalog
