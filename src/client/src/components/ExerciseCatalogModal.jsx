import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

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
function ExerciseQuickView({ exercise, onClose, isSelected, onToggleSelect }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

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
          <h2 className="text-lg font-bold text-white truncate pr-4">{exercise.name}</h2>
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
  const limit = 20

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

  const fetchExercises = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      })
      if (searchQuery) params.append('search', searchQuery)
      if (selectedMuscle) params.append('muscle', selectedMuscle)
      if (selectedEquipment) params.append('equipment', selectedEquipment)
      if (selectedLevel) params.append('level', selectedLevel)

      const response = await api.get(`/exercises?${params}`)
      setExercises(response.data.exercises)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error fetching exercises:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedMuscle, selectedEquipment, selectedLevel, offset])

  useEffect(() => {
    const debounce = setTimeout(() => {
      setOffset(0)
      fetchExercises()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, selectedMuscle, selectedEquipment, selectedLevel])

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
        <div className="p-4 border-b border-dark-border flex items-center justify-between flex-shrink-0">
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

          {/* Additional Filters */}
          <div className="flex gap-2">
            <select
              value={selectedEquipment}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="input flex-1 text-sm"
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
                        alt={exercise.name}
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
                    <h3 className="text-white font-medium truncate">{exercise.name}</h3>
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
                <p className="text-gray-500 text-center py-8">No exercises found</p>
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
        />
      )}
    </div>
  )
}

export default ExerciseCatalogModal
