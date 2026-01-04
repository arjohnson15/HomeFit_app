import { useState, useEffect } from 'react'
import api from '../services/api'

function EditWorkoutModal({ workout, onClose, onUpdate, onDelete, formatDuration, formatDate }) {
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Editable workout fields
  const [name, setName] = useState(workout.name || '')
  const [notes, setNotes] = useState(workout.notes || '')
  const [rating, setRating] = useState(workout.rating || 0)
  const [durationMinutes, setDurationMinutes] = useState(Math.floor((workout.duration || 0) / 60))

  // Track edited exercises and sets
  const [exerciseLogs, setExerciseLogs] = useState(
    workout.exerciseLogs?.map(log => ({
      ...log,
      sets: log.sets?.map(set => ({ ...set })) || []
    })) || []
  )

  useEffect(() => {
    // Reset state when workout changes
    setName(workout.name || '')
    setNotes(workout.notes || '')
    setRating(workout.rating || 0)
    setDurationMinutes(Math.floor((workout.duration || 0) / 60))
    setExerciseLogs(
      workout.exerciseLogs?.map(log => ({
        ...log,
        sets: log.sets?.map(set => ({ ...set })) || []
      })) || []
    )
    setEditMode(false)
  }, [workout])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Update workout basics
      const workoutRes = await api.patch(`/workouts/${workout.id}`, {
        name,
        notes,
        rating: rating || null,
        duration: durationMinutes * 60
      })

      // Update each exercise log
      for (const log of exerciseLogs) {
        const originalLog = workout.exerciseLogs?.find(l => l.id === log.id)

        // Update exercise notes/difficulty if changed
        if (originalLog && (log.notes !== originalLog.notes || log.difficultyRating !== originalLog.difficultyRating)) {
          await api.patch(`/workouts/${workout.id}/exercises/${log.id}`, {
            notes: log.notes,
            difficultyRating: log.difficultyRating
          })
        }

        // Update each set
        for (const set of log.sets) {
          const originalSet = originalLog?.sets?.find(s => s.id === set.id)

          if (originalSet) {
            // Check if set was modified
            const changed = (
              set.weight !== originalSet.weight ||
              set.reps !== originalSet.reps ||
              set.duration !== originalSet.duration ||
              set.distance !== originalSet.distance ||
              set.rpe !== originalSet.rpe ||
              set.notes !== originalSet.notes
            )

            if (changed) {
              await api.patch(`/workouts/${workout.id}/exercises/${log.id}/sets/${set.id}`, {
                weight: set.weight,
                reps: set.reps,
                duration: set.duration,
                distance: set.distance,
                rpe: set.rpe,
                notes: set.notes
              })
            }
          }
        }
      }

      // Fetch updated workout
      const updatedRes = await api.get(`/workouts/${workout.id}`)
      onUpdate(updatedRes.data.workout)
      setEditMode(false)
    } catch (error) {
      console.error('Error saving workout:', error)
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteWorkout = async () => {
    setDeleting(true)
    try {
      await api.delete(`/workouts/${workout.id}`)
      onDelete(workout.id)
    } catch (error) {
      console.error('Error deleting workout:', error)
      alert('Failed to delete workout')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleDeleteExercise = async (logId) => {
    if (!confirm('Delete this exercise and all its sets?')) return

    try {
      await api.delete(`/workouts/${workout.id}/exercises/${logId}`)
      setExerciseLogs(prev => prev.filter(l => l.id !== logId))

      // Fetch updated workout
      const updatedRes = await api.get(`/workouts/${workout.id}`)
      onUpdate(updatedRes.data.workout)
    } catch (error) {
      console.error('Error deleting exercise:', error)
      alert('Failed to delete exercise')
    }
  }

  const handleDeleteSet = async (logId, setId) => {
    if (!confirm('Delete this set?')) return

    try {
      await api.delete(`/workouts/${workout.id}/exercises/${logId}/sets/${setId}`)
      setExerciseLogs(prev => prev.map(log => {
        if (log.id === logId) {
          return {
            ...log,
            sets: log.sets.filter(s => s.id !== setId)
          }
        }
        return log
      }))

      // Fetch updated workout
      const updatedRes = await api.get(`/workouts/${workout.id}`)
      onUpdate(updatedRes.data.workout)
    } catch (error) {
      console.error('Error deleting set:', error)
      alert('Failed to delete set')
    }
  }

  const updateSetField = (logId, setId, field, value) => {
    setExerciseLogs(prev => prev.map(log => {
      if (log.id === logId) {
        return {
          ...log,
          sets: log.sets.map(set => {
            if (set.id === setId) {
              return { ...set, [field]: value }
            }
            return set
          })
        }
      }
      return log
    }))
  }

  const updateExerciseField = (logId, field, value) => {
    setExerciseLogs(prev => prev.map(log => {
      if (log.id === logId) {
        return { ...log, [field]: value }
      }
      return log
    }))
  }

  const calculateVolume = () => {
    let volume = 0
    exerciseLogs.forEach(log => {
      log.sets?.forEach(set => {
        if (set.weight && set.reps) {
          volume += set.weight * set.reps
        }
      })
    })
    return volume
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-dark-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border flex items-center justify-between z-10">
          <div className="flex-1">
            {editMode ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input text-xl font-bold w-full"
                placeholder="Workout name"
              />
            ) : (
              <>
                <h2 className="text-xl font-bold text-white">{workout.name}</h2>
                <p className="text-gray-400 text-sm">{formatDate(workout.date)}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <button
                  onClick={() => setEditMode(false)}
                  className="btn-ghost px-3 py-2 text-sm"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn-primary px-4 py-2 text-sm"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditMode(true)}
                  className="btn-ghost p-2"
                  title="Edit workout"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={onClose} className="btn-ghost p-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center">
              <p className="text-gray-400 text-xs">Duration</p>
              {editMode ? (
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                  className="input text-center text-lg font-bold w-full mt-1"
                  min="0"
                />
              ) : (
                <p className="text-lg font-bold text-white">{formatDuration(workout.duration)}</p>
              )}
            </div>
            <div className="card text-center">
              <p className="text-gray-400 text-xs">Exercises</p>
              <p className="text-lg font-bold text-white">{exerciseLogs.length}</p>
            </div>
            <div className="card text-center">
              <p className="text-gray-400 text-xs">Rating</p>
              {editMode ? (
                <div className="flex justify-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star === rating ? 0 : star)}
                      className="p-0.5"
                    >
                      <svg
                        className={`w-5 h-5 ${star <= rating ? 'text-yellow-400' : 'text-gray-600'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-lg font-bold text-white">{workout.rating || '-'}/5</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <h3 className="text-white font-medium mb-2">Notes</h3>
            {editMode ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input w-full h-24 resize-none"
                placeholder="Add workout notes..."
              />
            ) : (
              <p className="text-gray-400">
                {workout.notes || <span className="text-gray-600 italic">No notes</span>}
              </p>
            )}
          </div>

          {/* Exercise Details */}
          <div>
            <h3 className="text-white font-medium mb-3">Exercises</h3>
            <div className="space-y-4">
              {exerciseLogs.map((log) => (
                <div key={log.id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-medium">{log.exerciseName}</h4>
                    {editMode && (
                      <button
                        onClick={() => handleDeleteExercise(log.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                        title="Delete exercise"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Sets table */}
                  {log.sets?.length > 0 ? (
                    <div className="space-y-2">
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 px-1">
                        <div className="col-span-1">Set</div>
                        <div className="col-span-3 text-center">Weight</div>
                        <div className="col-span-3 text-center">Reps</div>
                        <div className="col-span-3 text-center">RPE</div>
                        {editMode && <div className="col-span-2"></div>}
                      </div>

                      {/* Rows */}
                      {log.sets.map((set, setIdx) => (
                        <div
                          key={set.id}
                          className={`grid grid-cols-12 gap-2 items-center py-2 px-1 rounded-lg ${
                            set.isPR ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-dark-elevated'
                          }`}
                        >
                          <div className="col-span-1 text-gray-400 text-sm flex items-center gap-1">
                            {setIdx + 1}
                            {set.isPR && (
                              <span className="text-yellow-400 text-xs">PR</span>
                            )}
                          </div>

                          {editMode ? (
                            <>
                              <div className="col-span-3">
                                <input
                                  type="number"
                                  value={set.weight || ''}
                                  onChange={(e) => updateSetField(log.id, set.id, 'weight', parseFloat(e.target.value) || null)}
                                  className="input text-center text-sm py-1 w-full"
                                  placeholder="lbs"
                                />
                              </div>
                              <div className="col-span-3">
                                <input
                                  type="number"
                                  value={set.reps || ''}
                                  onChange={(e) => updateSetField(log.id, set.id, 'reps', parseInt(e.target.value) || null)}
                                  className="input text-center text-sm py-1 w-full"
                                  placeholder="reps"
                                />
                              </div>
                              <div className="col-span-3">
                                <input
                                  type="number"
                                  value={set.rpe || ''}
                                  onChange={(e) => updateSetField(log.id, set.id, 'rpe', parseInt(e.target.value) || null)}
                                  className="input text-center text-sm py-1 w-full"
                                  placeholder="1-10"
                                  min="1"
                                  max="10"
                                />
                              </div>
                              <div className="col-span-2 flex justify-end">
                                <button
                                  onClick={() => handleDeleteSet(log.id, set.id)}
                                  className="text-red-400 hover:text-red-300 p-1"
                                  title="Delete set"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="col-span-3 text-center text-white text-sm">
                                {set.weight ? `${set.weight} lbs` : '-'}
                              </div>
                              <div className="col-span-3 text-center text-white text-sm">
                                {set.reps || '-'}
                              </div>
                              <div className="col-span-3 text-center text-gray-400 text-sm">
                                {set.rpe ? `RPE ${set.rpe}` : '-'}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No sets logged</p>
                  )}

                  {/* Exercise difficulty in edit mode */}
                  {editMode && (
                    <div className="mt-3 pt-3 border-t border-dark-border">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Difficulty</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(level => (
                            <button
                              key={level}
                              onClick={() => updateExerciseField(log.id, 'difficultyRating', level === log.difficultyRating ? null : level)}
                              className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                                level <= (log.difficultyRating || 0)
                                  ? 'bg-accent text-white'
                                  : 'bg-dark-card text-gray-500 hover:bg-dark-elevated'
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {exerciseLogs.length === 0 && (
                <p className="text-gray-500 text-center py-4">No exercises logged</p>
              )}
            </div>
          </div>

          {/* Delete Workout */}
          {editMode && (
            <div className="pt-4 border-t border-dark-border">
              {showDeleteConfirm ? (
                <div className="card bg-red-500/10 border border-red-500/30">
                  <p className="text-white mb-3">Are you sure you want to delete this workout?</p>
                  <p className="text-gray-400 text-sm mb-4">This action cannot be undone.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="btn-secondary flex-1"
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteWorkout}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full text-red-400 hover:text-red-300 py-3 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Workout
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EditWorkoutModal
