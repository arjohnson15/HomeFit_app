import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import CreateExerciseModal from './CreateExerciseModal'

const muscleGroups = [
  { id: '', label: 'All' },
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
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

// Quick View for exercise details
function ExerciseQuickView({ exercise, onClose, isSelected, onToggleSelect, nickname }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const displayName = nickname || exercise.name

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[70] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-dark-card w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border flex items-center justify-between z-10">
          <div className="truncate pr-4">
            <h2 className="text-lg font-bold text-white truncate">{displayName}</h2>
            {nickname && (
              <p className="text-gray-500 text-sm truncate">{exercise.name}</p>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Image */}
          <div className="aspect-video bg-dark-elevated rounded-xl overflow-hidden flex items-center justify-center relative">
            {exercise.images?.length > 0 ? (
              <>
                <img
                  src={`/api/exercise-images/${exercise.images[currentImageIndex]}`}
                  alt={exercise.name}
                  className="w-full h-full object-contain bg-dark-elevated"
                />
                {exercise.images.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImageIndex(prev => prev === 0 ? exercise.images.length - 1 : prev - 1)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentImageIndex(prev => prev === exercise.images.length - 1 ? 0 : prev + 1)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
              </>
            ) : (
              <svg className="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>

          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-2">
            <div className="card p-2">
              <p className="text-gray-400 text-xs">Muscles</p>
              <p className="text-white text-sm capitalize">{exercise.primaryMuscles?.join(', ')}</p>
            </div>
            <div className="card p-2">
              <p className="text-gray-400 text-xs">Equipment</p>
              <p className="text-white text-sm capitalize">{exercise.equipment || 'Body Only'}</p>
            </div>
            <div className="card p-2">
              <p className="text-gray-400 text-xs">Level</p>
              <p className="text-white text-sm capitalize">{exercise.level}</p>
            </div>
            <div className="card p-2">
              <p className="text-gray-400 text-xs">Category</p>
              <p className="text-white text-sm capitalize">{exercise.category}</p>
            </div>
          </div>

          {/* Instructions */}
          {exercise.instructions?.length > 0 && (
            <div>
              <h3 className="text-white font-medium mb-2">Instructions</h3>
              <ol className="space-y-2">
                {exercise.instructions.slice(0, 4).map((step, idx) => (
                  <li key={idx} className="flex gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs flex-shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-gray-300">{step}</p>
                  </li>
                ))}
                {exercise.instructions.length > 4 && (
                  <p className="text-gray-500 text-sm pl-7">+{exercise.instructions.length - 4} more steps</p>
                )}
              </ol>
            </div>
          )}

          {/* Add/Remove Button */}
          <button
            onClick={onToggleSelect}
            className={`w-full py-3 rounded-xl font-medium transition-colors ${
              isSelected
                ? 'bg-error/20 text-error border border-error/30'
                : 'bg-accent text-white'
            }`}
          >
            {isSelected ? 'Remove from Selection' : 'Add to Selection'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ExerciseCatalogModal({ onClose, onAddExercises }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState('')
  const [selectedEquipment, setSelectedEquipment] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')
  const [filterOptions, setFilterOptions] = useState({ muscles: [], equipment: [], levels: [] })
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [selectedExercises, setSelectedExercises] = useState([])
  const [viewingExercise, setViewingExercise] = useState(null)
  const [exerciseNicknames, setExerciseNicknames] = useState({}) // Map of exerciseId -> nickname
  const [userEquipment, setUserEquipment] = useState([])
  const [myEquipmentOnly, setMyEquipmentOnly] = useState(false)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [selectedSource, setSelectedSource] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const limit = 20

  // Load user equipment from localStorage and API, favorite IDs on mount
  useEffect(() => {
    // Load user's equipment settings from localStorage first
    let localEquipment = []
    const savedTraining = localStorage.getItem('trainingSettings')
    if (savedTraining) {
      try {
        const parsed = JSON.parse(savedTraining)
        if (parsed.equipmentAccess && parsed.equipmentAccess.length > 0) {
          localEquipment = parsed.equipmentAccess
          setUserEquipment(localEquipment)
        }
      } catch (e) {
        console.log('Could not parse training settings')
      }
    }

    // Also fetch from API as fallback (for PWA where localStorage might be out of sync)
    const loadEquipmentFromAPI = async () => {
      try {
        const response = await api.get('/users/me')
        const apiEquipment = response.data.user?.settings?.availableEquipment || []
        if (apiEquipment.length > 0) {
          setUserEquipment(apiEquipment)
          // Sync to localStorage if it was missing
          if (localEquipment.length === 0) {
            const existing = localStorage.getItem('trainingSettings')
            const settings = existing ? JSON.parse(existing) : {}
            settings.equipmentAccess = apiEquipment
            localStorage.setItem('trainingSettings', JSON.stringify(settings))
          }
        }
      } catch (error) {
        // API failed, stick with localStorage data
      }
    }
    loadEquipmentFromAPI()

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
    const loadFavoriteIds = async () => {
      try {
        const response = await api.get('/exercises/favorites')
        const ids = new Set(response.data.exercises?.map(e => e.id) || [])
        setFavoriteIds(ids)
      } catch (error) {
        console.log('Could not load favorites')
      }
    }
    loadFavoriteIds()
  }, [])

  // Get equipment filter from user's selected equipment
  const getMyEquipmentFilter = useCallback(() => {
    if (!myEquipmentOnly || userEquipment.length === 0) return null
    return userEquipment.join(',')
  }, [myEquipmentOnly, userEquipment])

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
      if (selectedSource) params.append('source', selectedSource)

      const response = await api.get(`/exercises?${params}`)
      let fetchedExercises = response.data.exercises
      let fetchedTotal = response.data.total

      // Load nicknames and update favoriteIds for these exercises
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
  }, [searchQuery, selectedMuscle, selectedEquipment, selectedLevel, selectedSource, offset, getMyEquipmentFilter, favoritesOnly, favoriteIds])

  useEffect(() => {
    const debounce = setTimeout(() => {
      setOffset(0)
      fetchExercises()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, selectedMuscle, selectedEquipment, selectedLevel, selectedSource, myEquipmentOnly, favoritesOnly])

  useEffect(() => {
    fetchExercises()
  }, [offset])

  const toggleExerciseSelection = (exercise) => {
    setSelectedExercises(prev => {
      const isSelected = prev.some(e => e.id === exercise.id)
      if (isSelected) {
        return prev.filter(e => e.id !== exercise.id)
      } else {
        return [...prev, exercise]
      }
    })
  }

  const isSelected = (exerciseId) => selectedExercises.some(e => e.id === exerciseId)

  const handleAddSelected = () => {
    if (selectedExercises.length > 0) {
      onAddExercises(selectedExercises)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col" onClick={onClose}>
      <div
        className="bg-dark-card w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-dark-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Add Exercises</h2>
              <p className="text-gray-400 text-sm">{total.toLocaleString()} exercises available</p>
            </div>
            <button onClick={onClose} className="btn-ghost p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-4 space-y-3 border-b border-dark-border flex-shrink-0">
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
                className="input pl-12 w-full"
                autoFocus
              />
            </div>

            {/* Muscle Group Pills */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              {muscleGroups.map((muscle) => (
                <button
                  key={muscle.id}
                  onClick={() => setSelectedMuscle(muscle.id)}
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
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
              <div className="flex items-center justify-between bg-dark-elevated rounded-xl p-3">
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
                    myEquipmentOnly ? 'bg-accent' : 'bg-dark-card'
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
              <div className="flex items-center justify-between bg-dark-elevated rounded-xl p-3">
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
                    favoritesOnly ? 'bg-yellow-400' : 'bg-dark-card'
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
              <select
                value={selectedEquipment}
                onChange={(e) => setSelectedEquipment(e.target.value)}
                disabled={myEquipmentOnly}
                className={`input flex-1 text-sm ${myEquipmentOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <option value="">All Equipment</option>
                {filterOptions.equipment?.map(eq => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
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
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="input flex-1 text-sm"
              >
                <option value="">All Sources</option>
                <option value="official">Official</option>
                <option value="custom">My Custom</option>
                <option value="community">Community</option>
              </select>
            </div>
          </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {exercises.map((exercise) => (
                    <div
                      key={exercise.id}
                      className={`card flex items-center gap-3 cursor-pointer transition-colors ${
                        isSelected(exercise.id) ? 'ring-2 ring-accent bg-accent/10' : 'hover:bg-dark-elevated'
                      }`}
                      onClick={() => toggleExerciseSelection(exercise)}
                    >
                      {/* Checkbox */}
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected(exercise.id) ? 'bg-accent border-accent' : 'border-gray-500'
                      }`}>
                        {isSelected(exercise.id) && (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Exercise Image */}
                      <div className="w-14 h-14 rounded-xl bg-dark-elevated flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {exercise.images?.[0] ? (
                          <img
                            src={`/api/exercise-images/${exercise.images[0]}`}
                            alt={exerciseNicknames[exercise.id] || exercise.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        ) : (
                          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-medium truncate">
                            {exerciseNicknames[exercise.id] || exercise.name}
                          </h3>
                          {/* Custom/Community badges */}
                          {exercise.isOwnExercise && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-accent/20 text-accent flex-shrink-0">
                              Custom
                            </span>
                          )}
                          {exercise.isCustom && !exercise.isOwnExercise && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-500/20 text-green-400 flex-shrink-0">
                              Community
                            </span>
                          )}
                        </div>
                        {exerciseNicknames[exercise.id] && (
                          <p className="text-gray-500 text-xs truncate">{exercise.name}</p>
                        )}
                        <p className="text-gray-400 text-sm capitalize truncate">
                          {exercise.primaryMuscles?.join(', ')} {exercise.equipment && `• ${exercise.equipment}`}
                        </p>
                      </div>

                      {/* Level Badge - hidden on mobile */}
                      {exercise.level && (
                        <span className={`hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${levelColors[exercise.level] || 'bg-gray-500/20 text-gray-400'}`}>
                          {exercise.level}
                        </span>
                      )}

                      {/* View Details */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setViewingExercise(exercise)
                        }}
                        className="btn-ghost p-2 text-gray-400 hover:text-white flex-shrink-0"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  {exercises.length === 0 && !loading && (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">No exercises found</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="text-accent hover:underline text-sm"
                      >
                        Can't find it? Create a custom exercise
                      </button>
                    </div>
                  )}

                  {/* Create Custom Link */}
                  {exercises.length > 0 && (
                    <div className="text-center pt-4 pb-2">
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="text-accent hover:underline text-sm"
                      >
                        Can't find what you're looking for? Create a custom exercise
                      </button>
                    </div>
                  )}
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
        </div>

        {/* Selected Count and Add Button */}
        <div className="p-4 border-t border-dark-border flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <p className="text-gray-400">
              {selectedExercises.length > 0
                ? `${selectedExercises.length} exercise${selectedExercises.length > 1 ? 's' : ''} selected`
                : 'Select exercises to add'
              }
            </p>
            <button
              onClick={handleAddSelected}
              disabled={selectedExercises.length === 0}
              className="btn-primary px-6 disabled:opacity-50"
            >
              Add Selected
            </button>
          </div>
        </div>
      </div>

      {/* Exercise Detail View */}
      {viewingExercise && (
        <ExerciseQuickView
          exercise={viewingExercise}
          onClose={() => setViewingExercise(null)}
          isSelected={isSelected(viewingExercise.id)}
          onToggleSelect={() => toggleExerciseSelection(viewingExercise)}
          nickname={exerciseNicknames[viewingExercise.id]}
        />
      )}

      {/* Create Custom Exercise Modal */}
      {showCreateModal && (
        <CreateExerciseModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(newExercise) => {
            fetchExercises()
            setShowCreateModal(false)
            // Optionally auto-select the new exercise
            if (newExercise) {
              setSelectedExercises(prev => [...prev, newExercise])
            }
          }}
        />
      )}
    </div>
  )
}

export default ExerciseCatalogModal
