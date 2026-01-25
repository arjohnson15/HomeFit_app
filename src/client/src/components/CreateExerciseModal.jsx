import { useState, useEffect, useRef } from 'react'
import api from '../services/api'

// Available muscle groups
const muscleOptions = [
  'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest',
  'forearms', 'glutes', 'hamstrings', 'lats', 'lower back', 'middle back',
  'neck', 'quadriceps', 'shoulders', 'traps', 'triceps'
]

const visibilityOptions = [
  { value: 'PRIVATE', label: 'Private', description: 'Only you can see this exercise' },
  { value: 'FRIENDS', label: 'Friends Only', description: 'You and your friends can see this' },
  { value: 'PUBLIC', label: 'Community', description: 'Everyone can see and use this exercise' }
]

function CreateExerciseModal({ onClose, onCreated, editExercise = null }) {
  const isEditing = !!editExercise
  const fileInputRef = useRef(null)

  const [formData, setFormData] = useState({
    name: editExercise?.name || '',
    level: editExercise?.level || 'beginner',
    category: editExercise?.category || '',
    equipment: editExercise?.equipment || '',
    force: editExercise?.force || '',
    mechanic: editExercise?.mechanic || '',
    primaryMuscles: editExercise?.primaryMuscles || [],
    secondaryMuscles: editExercise?.secondaryMuscles || [],
    instructions: editExercise?.instructions?.length ? editExercise.instructions : [''],
    visibility: editExercise?.visibility || 'PRIVATE'
  })

  const [saving, setSaving] = useState(false)
  const [filterOptions, setFilterOptions] = useState({ muscles: [], equipment: [], categories: [] })
  const [showAddMuscle, setShowAddMuscle] = useState(false)
  const [newMuscle, setNewMuscle] = useState('')

  // Image handling
  const [existingImages, setExistingImages] = useState(editExercise?.images || [])
  const [newImages, setNewImages] = useState([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState([])

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

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [imagePreviewUrls])

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    // Limit to 4 total images
    const totalImages = existingImages.length + newImages.length + files.length
    if (totalImages > 4) {
      alert('Maximum 4 images allowed')
      return
    }

    // Create preview URLs for new files
    const newPreviewUrls = files.map(file => URL.createObjectURL(file))
    setImagePreviewUrls(prev => [...prev, ...newPreviewUrls])
    setNewImages(prev => [...prev, ...files])
  }

  const removeExistingImage = (index) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index))
  }

  const removeNewImage = (index) => {
    URL.revokeObjectURL(imagePreviewUrls[index])
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index))
    setNewImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert('Exercise name is required')
      return
    }

    if (formData.primaryMuscles.length === 0) {
      alert('At least one primary muscle is required')
      return
    }

    setSaving(true)
    try {
      const submitData = new FormData()
      submitData.append('name', formData.name)
      submitData.append('primaryMuscles', JSON.stringify(formData.primaryMuscles))
      submitData.append('secondaryMuscles', JSON.stringify(formData.secondaryMuscles))
      submitData.append('equipment', formData.equipment || '')
      submitData.append('category', formData.category || '')
      submitData.append('force', formData.force || '')
      submitData.append('level', formData.level || '')
      submitData.append('mechanic', formData.mechanic || '')
      submitData.append('instructions', JSON.stringify(formData.instructions.filter(Boolean)))
      submitData.append('visibility', formData.visibility)

      // Add existing images for edit mode
      if (isEditing) {
        submitData.append('existingImages', JSON.stringify(existingImages))
      }

      // Add new image files
      newImages.forEach(file => {
        submitData.append('images', file)
      })

      let response
      if (isEditing) {
        response = await api.put(`/exercises/custom/${editExercise.dbId}`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      } else {
        response = await api.post('/exercises/custom', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      }

      if (onCreated) {
        onCreated(response.data.exercise)
      }
      onClose()
    } catch (error) {
      console.error('Error saving exercise:', error)
      alert(error.response?.data?.message || 'Failed to save exercise')
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
          <h2 className="text-xl font-bold text-white">
            {isEditing ? 'Edit Custom Exercise' : 'Create Custom Exercise'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Exercise Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full text-lg"
              placeholder="e.g., Landmine Press"
              required
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Visibility</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {visibilityOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, visibility: option.value })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    formData.visibility === option.value
                      ? 'border-accent bg-accent/10'
                      : 'border-dark-border hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {option.value === 'PRIVATE' && (
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                    {option.value === 'FRIENDS' && (
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    )}
                    {option.value === 'PUBLIC' && (
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <span className={`font-medium ${formData.visibility === option.value ? 'text-white' : 'text-gray-300'}`}>
                      {option.label}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Images (Optional, max 4)</label>
            <div className="flex flex-wrap gap-3">
              {/* Existing Images */}
              {existingImages.map((img, idx) => (
                <div key={`existing-${idx}`} className="relative w-24 h-24 rounded-lg overflow-hidden bg-dark-elevated">
                  <img
                    src={img.startsWith('/') ? img : `/api/exercise-images/${img}`}
                    alt={`Exercise ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(idx)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {/* New Image Previews */}
              {imagePreviewUrls.map((url, idx) => (
                <div key={`new-${idx}`} className="relative w-24 h-24 rounded-lg overflow-hidden bg-dark-elevated">
                  <img
                    src={url}
                    alt={`New ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeNewImage(idx)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {/* Add Image Button */}
              {existingImages.length + newImages.length < 4 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-lg border-2 border-dashed border-dark-border hover:border-accent flex flex-col items-center justify-center text-gray-400 hover:text-accent transition-colors"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs mt-1">Add</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageSelect}
              className="hidden"
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
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input w-full"
              >
                <option value="">Select category</option>
                {categoryOptions.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Equipment</label>
              <select
                value={formData.equipment}
                onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                className="input w-full"
              >
                <option value="">Select equipment</option>
                {equipmentOptions.map(eq => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Force and Mechanic Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Force (Optional)</label>
              <select
                value={formData.force}
                onChange={(e) => setFormData({ ...formData, force: e.target.value })}
                className="input w-full"
              >
                <option value="">Select force type</option>
                <option value="push">Push</option>
                <option value="pull">Pull</option>
                <option value="static">Static</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Mechanic (Optional)</label>
              <select
                value={formData.mechanic}
                onChange={(e) => setFormData({ ...formData, mechanic: e.target.value })}
                className="input w-full"
              >
                <option value="">Select mechanic</option>
                <option value="compound">Compound</option>
                <option value="isolation">Isolation</option>
              </select>
            </div>
          </div>

          {/* Primary Muscles */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-400 text-sm">Primary Muscles *</label>
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
            <label className="block text-gray-400 text-sm mb-2">Secondary Muscles (Optional)</label>
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
              <label className="text-gray-400 text-sm">Instructions (Optional)</label>
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
                <div key={idx} className="flex items-start gap-2 bg-dark-elevated/50 rounded-lg p-2">
                  <span className="w-7 h-7 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0 bg-accent/10 rounded-full">
                    {idx + 1}
                  </span>
                  <textarea
                    value={instruction}
                    onChange={(e) => updateInstruction(idx, e.target.value)}
                    className="input flex-1 min-h-[60px] resize-none py-2 px-3 text-sm"
                    placeholder={`Step ${idx + 1}...`}
                    rows={2}
                  />
                  <button
                    type="button"
                    onClick={() => removeInstruction(idx)}
                    disabled={formData.instructions.length === 1 && !formData.instructions[0]}
                    className="btn-ghost p-1.5 text-error disabled:opacity-30"
                    title="Remove step"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
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
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Exercise'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateExerciseModal
