import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals', 'obliques',
  'traps', 'lats', 'lower back', 'neck', 'adductors', 'abductors'
]

const EQUIPMENT_OPTIONS = [
  'body only', 'barbell', 'dumbbell', 'cable', 'machine',
  'kettlebell', 'bands', 'medicine ball', 'exercise ball',
  'foam roll', 'e-z curl bar', 'other'
]

const CATEGORIES = [
  'strength', 'stretching', 'plyometrics', 'strongman',
  'powerlifting', 'cardio', 'olympic weightlifting'
]

const LEVELS = ['beginner', 'intermediate', 'expert']

const FORCE_TYPES = ['push', 'pull', 'static']

const MECHANIC_TYPES = ['compound', 'isolation']

function ExerciseManagement() {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingExercise, setEditingExercise] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef(null)

  const emptyExercise = {
    name: '',
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: '',
    category: '',
    force: '',
    level: '',
    mechanic: '',
    instructions: [''],
    images: []
  }

  const [newExercise, setNewExercise] = useState(emptyExercise)

  useEffect(() => {
    fetchExercises()
  }, [])

  const fetchExercises = async () => {
    try {
      const response = await api.get('/admin/exercises')
      setExercises(response.data.exercises || [])
    } catch (error) {
      console.error('Error fetching exercises:', error)
    } finally {
      setLoading(false)
    }
  }

  const createExercise = async () => {
    if (!newExercise.name) {
      alert('Exercise name is required')
      return
    }
    if (newExercise.primaryMuscles.length === 0) {
      alert('At least one primary muscle is required')
      return
    }

    setSaving(true)
    try {
      // Filter out empty instructions
      const cleanedExercise = {
        ...newExercise,
        instructions: newExercise.instructions.filter(i => i.trim())
      }
      const response = await api.post('/admin/exercises', cleanedExercise)
      setExercises([response.data.exercise, ...exercises])
      setShowCreateModal(false)
      setNewExercise(emptyExercise)
    } catch (error) {
      console.error('Error creating exercise:', error)
      alert(error.response?.data?.message || 'Failed to create exercise')
    } finally {
      setSaving(false)
    }
  }

  const updateExercise = async () => {
    if (!editingExercise.name) {
      alert('Exercise name is required')
      return
    }

    setSaving(true)
    try {
      const cleanedExercise = {
        ...editingExercise,
        instructions: editingExercise.instructions.filter(i => i.trim())
      }
      const response = await api.put(`/admin/exercises/${editingExercise.id}`, cleanedExercise)
      setExercises(exercises.map(e =>
        e.id === editingExercise.id ? response.data.exercise : e
      ))
      setEditingExercise(null)
    } catch (error) {
      console.error('Error updating exercise:', error)
      alert(error.response?.data?.message || 'Failed to update exercise')
    } finally {
      setSaving(false)
    }
  }

  const deleteExercise = async (exercise) => {
    if (!confirm(`Delete "${exercise.name}"? This cannot be undone.`)) return

    try {
      await api.delete(`/admin/exercises/${exercise.id}`)
      setExercises(exercises.filter(e => e.id !== exercise.id))
    } catch (error) {
      console.error('Error deleting exercise:', error)
      alert(error.response?.data?.message || 'Failed to delete')
    }
  }

  const toggleExerciseActive = async (exercise) => {
    try {
      await api.put(`/admin/exercises/${exercise.id}`, {
        isActive: !exercise.isActive
      })
      setExercises(exercises.map(e =>
        e.id === exercise.id ? { ...e, isActive: !e.isActive } : e
      ))
    } catch (error) {
      console.error('Error toggling exercise:', error)
    }
  }

  const handleImageUpload = async (e, exerciseId) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    const formData = new FormData()
    formData.append('image', file)

    try {
      const response = await api.post(`/admin/exercises/${exerciseId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      // Update the exercise in state
      if (editingExercise?.id === exerciseId) {
        setEditingExercise(response.data.exercise)
      }
      setExercises(exercises.map(e =>
        e.id === exerciseId ? response.data.exercise : e
      ))
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  const removeImage = async (exerciseId, imageUrl) => {
    try {
      const response = await api.delete(`/admin/exercises/${exerciseId}/image`, {
        data: { imageUrl }
      })

      if (editingExercise?.id === exerciseId) {
        setEditingExercise(response.data.exercise)
      }
      setExercises(exercises.map(e =>
        e.id === exerciseId ? response.data.exercise : e
      ))
    } catch (error) {
      console.error('Error removing image:', error)
      alert('Failed to remove image')
    }
  }

  const addImageUrl = (exercise, setExercise) => {
    const url = prompt('Enter image URL:')
    if (url && url.trim()) {
      setExercise({
        ...exercise,
        images: [...(exercise.images || []), url.trim()]
      })
    }
  }

  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleMuscle = (exercise, setExercise, field, muscle) => {
    const current = exercise[field] || []
    const updated = current.includes(muscle)
      ? current.filter(m => m !== muscle)
      : [...current, muscle]
    setExercise({ ...exercise, [field]: updated })
  }

  const addInstruction = (exercise, setExercise) => {
    setExercise({
      ...exercise,
      instructions: [...(exercise.instructions || []), '']
    })
  }

  const updateInstruction = (exercise, setExercise, index, value) => {
    const updated = [...exercise.instructions]
    updated[index] = value
    setExercise({ ...exercise, instructions: updated })
  }

  const removeInstruction = (exercise, setExercise, index) => {
    const updated = exercise.instructions.filter((_, i) => i !== index)
    setExercise({ ...exercise, instructions: updated })
  }

  const ExerciseForm = ({ exercise, setExercise, onSave, onCancel, title }) => (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-dark-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onCancel} className="btn-ghost p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Name */}
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Exercise Name *</label>
            <input
              type="text"
              value={exercise.name}
              onChange={e => setExercise({ ...exercise, name: e.target.value })}
              className="input w-full"
              placeholder="e.g., Barbell Bench Press"
            />
          </div>

          {/* Primary Muscles */}
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Primary Muscles *</label>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS.map(muscle => (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleMuscle(exercise, setExercise, 'primaryMuscles', muscle)}
                  className={`px-3 py-1.5 rounded-full text-xs capitalize transition-colors ${
                    exercise.primaryMuscles?.includes(muscle)
                      ? 'bg-accent text-white'
                      : 'bg-dark-elevated text-gray-400 hover:text-white'
                  }`}
                >
                  {muscle}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Muscles */}
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Secondary Muscles</label>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS.map(muscle => (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleMuscle(exercise, setExercise, 'secondaryMuscles', muscle)}
                  className={`px-3 py-1.5 rounded-full text-xs capitalize transition-colors ${
                    exercise.secondaryMuscles?.includes(muscle)
                      ? 'bg-warning/30 text-warning'
                      : 'bg-dark-elevated text-gray-400 hover:text-white'
                  }`}
                >
                  {muscle}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment & Category Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Equipment</label>
              <select
                value={exercise.equipment || ''}
                onChange={e => setExercise({ ...exercise, equipment: e.target.value })}
                className="input w-full"
              >
                <option value="">Select equipment</option>
                {EQUIPMENT_OPTIONS.map(eq => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Category</label>
              <select
                value={exercise.category || ''}
                onChange={e => setExercise({ ...exercise, category: e.target.value })}
                className="input w-full"
              >
                <option value="">Select category</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Level & Force & Mechanic Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Level</label>
              <select
                value={exercise.level || ''}
                onChange={e => setExercise({ ...exercise, level: e.target.value })}
                className="input w-full"
              >
                <option value="">Select level</option>
                {LEVELS.map(lvl => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Force</label>
              <select
                value={exercise.force || ''}
                onChange={e => setExercise({ ...exercise, force: e.target.value })}
                className="input w-full"
              >
                <option value="">Select force</option>
                {FORCE_TYPES.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Mechanic</label>
              <select
                value={exercise.mechanic || ''}
                onChange={e => setExercise({ ...exercise, mechanic: e.target.value })}
                className="input w-full"
              >
                <option value="">Select mechanic</option>
                {MECHANIC_TYPES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Instructions</label>
            <div className="space-y-2">
              {(exercise.instructions || ['']).map((instruction, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-gray-500 py-2 w-6">{idx + 1}.</span>
                  <input
                    type="text"
                    value={instruction}
                    onChange={e => updateInstruction(exercise, setExercise, idx, e.target.value)}
                    className="input flex-1"
                    placeholder="Enter instruction step..."
                  />
                  <button
                    type="button"
                    onClick={() => removeInstruction(exercise, setExercise, idx)}
                    className="btn-ghost p-2 text-error"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addInstruction(exercise, setExercise)}
                className="btn-secondary w-full"
              >
                + Add Step
              </button>
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Images</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(exercise.images || []).map((img, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={img.startsWith('/') ? img : img}
                    alt={`Exercise ${idx + 1}`}
                    className="w-full aspect-video object-cover rounded-lg bg-dark-elevated"
                    onError={e => e.target.src = '/placeholder-exercise.png'}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = exercise.images.filter((_, i) => i !== idx)
                      setExercise({ ...exercise, images: updated })
                    }}
                    className="absolute top-1 right-1 bg-error/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {exercise.id && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={e => handleImageUpload(e, exercise.id)}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="btn-secondary flex-1"
                  >
                    {uploadingImage ? 'Uploading...' : 'Upload Image'}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => addImageUrl(exercise, setExercise)}
                className="btn-secondary flex-1"
              >
                Add Image URL
              </button>
            </div>
            {!exercise.id && (
              <p className="text-gray-500 text-xs mt-2">
                Save the exercise first to upload image files
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button onClick={onCancel} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? 'Saving...' : 'Save Exercise'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <div className="bg-dark-card border-b border-dark-border">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link to="/settings" className="btn-ghost p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Exercise Management</h1>
              <p className="text-gray-400 text-sm">Create and manage custom exercises</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Search & Add */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search exercises..."
              className="input pl-12 w-full"
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Exercise
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="card text-center">
            <div className="text-2xl font-bold text-white">{exercises.length}</div>
            <div className="text-gray-400 text-sm">Total Exercises</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-success">{exercises.filter(e => e.isActive).length}</div>
            <div className="text-gray-400 text-sm">Active</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-warning">{exercises.filter(e => !e.isActive).length}</div>
            <div className="text-gray-400 text-sm">Inactive</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-accent">{exercises.filter(e => e.images?.length > 0).length}</div>
            <div className="text-gray-400 text-sm">With Images</div>
          </div>
        </div>

        {/* Exercise List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="card text-center py-12">
            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-white font-medium mb-2">No custom exercises yet</h3>
            <p className="text-gray-400 mb-4">Create your first custom exercise to get started</p>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              Create Exercise
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExercises.map(exercise => (
              <div
                key={exercise.id}
                className={`card flex items-center gap-4 ${!exercise.isActive ? 'opacity-60' : ''}`}
              >
                {/* Image Preview */}
                <div className="w-16 h-16 rounded-xl bg-dark-elevated flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {exercise.images?.[0] ? (
                    <img
                      src={exercise.images[0]}
                      alt={exercise.name}
                      className="w-full h-full object-cover"
                      onError={e => e.target.style.display = 'none'}
                    />
                  ) : (
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{exercise.name}</h3>
                  <p className="text-gray-400 text-sm capitalize truncate">
                    {exercise.primaryMuscles?.join(', ')}
                    {exercise.equipment && ` • ${exercise.equipment}`}
                  </p>
                  <div className="flex gap-2 mt-1">
                    {exercise.level && (
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        exercise.level === 'beginner' ? 'bg-success/20 text-success' :
                        exercise.level === 'intermediate' ? 'bg-warning/20 text-warning' :
                        'bg-error/20 text-error'
                      }`}>
                        {exercise.level}
                      </span>
                    )}
                    {exercise.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-dark-elevated text-gray-400 capitalize">
                        {exercise.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Active Toggle */}
                <button
                  onClick={() => toggleExerciseActive(exercise)}
                  className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    exercise.isActive ? 'bg-accent' : 'bg-dark-elevated'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    exercise.isActive ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>

                {/* Actions */}
                <button
                  onClick={() => setEditingExercise(exercise)}
                  className="btn-ghost p-2 text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteExercise(exercise)}
                  className="btn-ghost p-2 text-error hover:text-error"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <ExerciseForm
          exercise={newExercise}
          setExercise={setNewExercise}
          onSave={createExercise}
          onCancel={() => {
            setShowCreateModal(false)
            setNewExercise(emptyExercise)
          }}
          title="Create Custom Exercise"
        />
      )}

      {/* Edit Modal */}
      {editingExercise && (
        <ExerciseForm
          exercise={editingExercise}
          setExercise={setEditingExercise}
          onSave={updateExercise}
          onCancel={() => setEditingExercise(null)}
          title="Edit Exercise"
        />
      )}
    </div>
  )
}

export default ExerciseManagement
