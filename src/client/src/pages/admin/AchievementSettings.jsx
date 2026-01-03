import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

const CATEGORIES = [
  { id: 'WORKOUT', label: 'Workout', icon: '💪' },
  { id: 'STREAK', label: 'Streak', icon: '🔥' },
  { id: 'PR', label: 'Personal Records', icon: '🏆' },
  { id: 'TIME', label: 'Time', icon: '⏱️' },
  { id: 'NUTRITION', label: 'Nutrition', icon: '🥗' },
  { id: 'SOCIAL', label: 'Social', icon: '🤝' }
]

const METRIC_TYPES = [
  { id: 'TOTAL_WORKOUTS', label: 'Total Workouts' },
  { id: 'CURRENT_STREAK', label: 'Current Streak' },
  { id: 'LONGEST_STREAK', label: 'Longest Streak' },
  { id: 'TOTAL_PRS', label: 'Total PRs' },
  { id: 'TOTAL_WORKOUT_HOURS', label: 'Total Workout Hours' },
  { id: 'TOTAL_MEALS_LOGGED', label: 'Total Meals Logged' },
  { id: 'CALORIE_GOAL_STREAK', label: 'Calorie Goal Streak' },
  { id: 'TOTAL_FRIENDS', label: 'Total Friends' }
]

const RARITIES = [
  { id: 'COMMON', label: 'Common', color: 'gray-500' },
  { id: 'UNCOMMON', label: 'Uncommon', color: 'green-500' },
  { id: 'RARE', label: 'Rare', color: 'blue-500' },
  { id: 'EPIC', label: 'Epic', color: 'purple-500' },
  { id: 'LEGENDARY', label: 'Legendary', color: 'yellow-500' }
]

function AchievementSettings() {
  const [achievements, setAchievements] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [editingAchievement, setEditingAchievement] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const [newAchievement, setNewAchievement] = useState({
    name: '',
    description: '',
    icon: '🏆',
    category: 'WORKOUT',
    metricType: 'TOTAL_WORKOUTS',
    threshold: 1,
    rarity: 'COMMON',
    points: 10
  })

  useEffect(() => {
    fetchAchievements()
  }, [])

  const fetchAchievements = async () => {
    try {
      const response = await api.get('/admin/achievements')
      setAchievements(response.data.achievements || [])
    } catch (error) {
      console.error('Error fetching achievements:', error)
    } finally {
      setLoading(false)
    }
  }

  const seedDefaults = async () => {
    setSeeding(true)
    try {
      const response = await api.post('/admin/achievements/seed')
      alert(response.data.message)
      fetchAchievements()
    } catch (error) {
      console.error('Error seeding achievements:', error)
      alert('Failed to seed achievements')
    } finally {
      setSeeding(false)
    }
  }

  const toggleAchievement = async (achievement) => {
    try {
      await api.put(`/admin/achievements/${achievement.id}`, {
        isActive: !achievement.isActive
      })
      setAchievements(achievements.map(a =>
        a.id === achievement.id ? { ...a, isActive: !a.isActive } : a
      ))
    } catch (error) {
      console.error('Error toggling achievement:', error)
    }
  }

  const saveAchievement = async () => {
    setSaving(true)
    try {
      await api.put(`/admin/achievements/${editingAchievement.id}`, editingAchievement)
      setAchievements(achievements.map(a =>
        a.id === editingAchievement.id ? editingAchievement : a
      ))
      setEditingAchievement(null)
    } catch (error) {
      console.error('Error saving achievement:', error)
    } finally {
      setSaving(false)
    }
  }

  const createAchievement = async () => {
    setSaving(true)
    try {
      const response = await api.post('/admin/achievements', newAchievement)
      setAchievements([...achievements, response.data.achievement])
      setShowCreateModal(false)
      setNewAchievement({
        name: '',
        description: '',
        icon: '🏆',
        category: 'WORKOUT',
        metricType: 'TOTAL_WORKOUTS',
        threshold: 1,
        rarity: 'COMMON',
        points: 10
      })
    } catch (error) {
      console.error('Error creating achievement:', error)
    } finally {
      setSaving(false)
    }
  }

  const deleteAchievement = async (achievement) => {
    if (achievement.isDefault) {
      alert('Cannot delete default achievements. Disable instead.')
      return
    }
    if (!confirm(`Delete "${achievement.name}"? This cannot be undone.`)) return

    try {
      await api.delete(`/admin/achievements/${achievement.id}`)
      setAchievements(achievements.filter(a => a.id !== achievement.id))
    } catch (error) {
      console.error('Error deleting achievement:', error)
      alert(error.response?.data?.message || 'Failed to delete')
    }
  }

  const filteredAchievements = selectedCategory === 'ALL'
    ? achievements
    : achievements.filter(a => a.category === selectedCategory)

  const getRarityColor = (rarity) => {
    const r = RARITIES.find(r => r.id === rarity)
    return r ? r.color : 'gray-500'
  }

  if (loading) {
    return (
      <div className="p-4 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/settings" className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">Achievement Settings</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-bold text-accent">{achievements.length}</p>
          <p className="text-gray-400 text-sm">Total</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-500">{achievements.filter(a => a.isActive).length}</p>
          <p className="text-gray-400 text-sm">Active</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-yellow-500">{achievements.filter(a => a.isDefault).length}</p>
          <p className="text-gray-400 text-sm">Default</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={seedDefaults}
          disabled={seeding}
          className="btn-secondary flex-1"
        >
          {seeding ? 'Seeding...' : 'Seed Defaults'}
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex-1"
        >
          + Create New
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap ${
            selectedCategory === 'ALL'
              ? 'bg-accent text-white'
              : 'bg-dark-card text-gray-400'
          }`}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 ${
              selectedCategory === cat.id
                ? 'bg-accent text-white'
                : 'bg-dark-card text-gray-400'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Achievement List */}
      <div className="space-y-3">
        {filteredAchievements.map(achievement => (
          <div
            key={achievement.id}
            className={`card flex items-center gap-4 ${
              !achievement.isActive ? 'opacity-50' : ''
            }`}
          >
            {/* Icon */}
            <div className={`text-3xl p-2 rounded-lg bg-dark-elevated border-2 border-${getRarityColor(achievement.rarity)}`}>
              {achievement.icon}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-medium truncate">{achievement.name}</h3>
                {achievement.isDefault && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">Default</span>
                )}
              </div>
              <p className="text-gray-400 text-sm truncate">{achievement.description}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span>Threshold: {achievement.threshold}</span>
                <span>Points: {achievement.points}</span>
                <span className={`text-${getRarityColor(achievement.rarity)}`}>
                  {achievement.rarity}
                </span>
                {achievement.unlockedCount > 0 && (
                  <span>{achievement.unlockedCount} unlocked ({achievement.unlockedPercent}%)</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Toggle */}
              <button
                onClick={() => toggleAchievement(achievement)}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  achievement.isActive ? 'bg-accent' : 'bg-dark-elevated'
                }`}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                  achievement.isActive ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>

              {/* Edit */}
              <button
                onClick={() => setEditingAchievement({ ...achievement })}
                className="p-2 text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>

              {/* Delete */}
              {!achievement.isDefault && (
                <button
                  onClick={() => deleteAchievement(achievement)}
                  className="p-2 text-gray-400 hover:text-error"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredAchievements.length === 0 && (
          <div className="card text-center py-8">
            <p className="text-gray-400">No achievements found</p>
            <button
              onClick={seedDefaults}
              className="btn-primary mt-4"
            >
              Seed Default Achievements
            </button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingAchievement && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Edit Achievement</h2>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Name</label>
                <input
                  type="text"
                  value={editingAchievement.name}
                  onChange={(e) => setEditingAchievement({ ...editingAchievement, name: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Description</label>
                <textarea
                  value={editingAchievement.description}
                  onChange={(e) => setEditingAchievement({ ...editingAchievement, description: e.target.value })}
                  className="input w-full"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Icon (emoji)</label>
                  <input
                    type="text"
                    value={editingAchievement.icon}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, icon: e.target.value })}
                    className="input w-full text-2xl text-center"
                    maxLength={2}
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Threshold</label>
                  <input
                    type="number"
                    value={editingAchievement.threshold}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, threshold: parseInt(e.target.value) || 1 })}
                    className="input w-full"
                    min={1}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Category</label>
                  <select
                    value={editingAchievement.category}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, category: e.target.value })}
                    className="input w-full"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Metric Type</label>
                  <select
                    value={editingAchievement.metricType}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, metricType: e.target.value })}
                    className="input w-full"
                  >
                    {METRIC_TYPES.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Rarity</label>
                  <select
                    value={editingAchievement.rarity}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, rarity: e.target.value })}
                    className="input w-full"
                  >
                    {RARITIES.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Points</label>
                  <input
                    type="number"
                    value={editingAchievement.points}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, points: parseInt(e.target.value) || 10 })}
                    className="input w-full"
                    min={1}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingAchievement(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={saveAchievement}
                disabled={saving}
                className="btn-primary flex-1"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Create Achievement</h2>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Name</label>
                <input
                  type="text"
                  value={newAchievement.name}
                  onChange={(e) => setNewAchievement({ ...newAchievement, name: e.target.value })}
                  placeholder="Achievement Name"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Description</label>
                <textarea
                  value={newAchievement.description}
                  onChange={(e) => setNewAchievement({ ...newAchievement, description: e.target.value })}
                  placeholder="What the user needs to do..."
                  className="input w-full"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Icon (emoji)</label>
                  <input
                    type="text"
                    value={newAchievement.icon}
                    onChange={(e) => setNewAchievement({ ...newAchievement, icon: e.target.value })}
                    className="input w-full text-2xl text-center"
                    maxLength={2}
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Threshold</label>
                  <input
                    type="number"
                    value={newAchievement.threshold}
                    onChange={(e) => setNewAchievement({ ...newAchievement, threshold: parseInt(e.target.value) || 1 })}
                    className="input w-full"
                    min={1}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Category</label>
                  <select
                    value={newAchievement.category}
                    onChange={(e) => setNewAchievement({ ...newAchievement, category: e.target.value })}
                    className="input w-full"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Metric Type</label>
                  <select
                    value={newAchievement.metricType}
                    onChange={(e) => setNewAchievement({ ...newAchievement, metricType: e.target.value })}
                    className="input w-full"
                  >
                    {METRIC_TYPES.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Rarity</label>
                  <select
                    value={newAchievement.rarity}
                    onChange={(e) => setNewAchievement({ ...newAchievement, rarity: e.target.value })}
                    className="input w-full"
                  >
                    {RARITIES.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Points</label>
                  <input
                    type="number"
                    value={newAchievement.points}
                    onChange={(e) => setNewAchievement({ ...newAchievement, points: parseInt(e.target.value) || 10 })}
                    className="input w-full"
                    min={1}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={createAchievement}
                disabled={saving || !newAchievement.name || !newAchievement.description}
                className="btn-primary flex-1"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AchievementSettings
