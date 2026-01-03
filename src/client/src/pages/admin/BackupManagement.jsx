import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function BackupManagement() {
  const [backups, setBackups] = useState([])
  const [schedule, setSchedule] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(null)
  const [filter, setFilter] = useState({ type: '', status: '' })

  useEffect(() => {
    fetchData()
  }, [filter])

  const fetchData = async () => {
    try {
      const [backupsRes, scheduleRes, statsRes] = await Promise.all([
        api.get('/backup/admin/list', { params: filter }),
        api.get('/backup/admin/schedule'),
        api.get('/backup/admin/stats')
      ])
      setBackups(backupsRes.data.backups || [])
      setSchedule(scheduleRes.data.schedule)
      setStats(statsRes.data)
    } catch (error) {
      console.error('Error fetching backup data:', error)
    } finally {
      setLoading(false)
    }
  }

  const createFullBackup = async () => {
    setCreating('full')
    try {
      await api.post('/backup/admin/full')
      fetchData()
    } catch (error) {
      console.error('Error creating full backup:', error)
      alert('Failed to create backup')
    } finally {
      setCreating(null)
    }
  }

  const createSettingsBackup = async () => {
    setCreating('settings')
    try {
      await api.post('/backup/admin/settings')
      fetchData()
    } catch (error) {
      console.error('Error creating settings backup:', error)
      alert('Failed to create backup')
    } finally {
      setCreating(null)
    }
  }

  const runScheduledBackup = async () => {
    setCreating('scheduled')
    try {
      await api.post('/backup/admin/schedule/run', { type: 'daily' })
      fetchData()
    } catch (error) {
      console.error('Error running scheduled backup:', error)
      alert('Failed to run backup')
    } finally {
      setCreating(null)
    }
  }

  const updateSchedule = async (updates) => {
    try {
      const response = await api.put('/backup/admin/schedule', updates)
      setSchedule(response.data.schedule)
    } catch (error) {
      console.error('Error updating schedule:', error)
      alert('Failed to update schedule')
    }
  }

  const downloadBackup = async (backup) => {
    try {
      const response = await api.get(`/backup/admin/${backup.id}/download`)
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backup.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading backup:', error)
      alert('Failed to download backup')
    }
  }

  const deleteBackup = async (backup) => {
    if (!confirm('Are you sure you want to delete this backup?')) return

    try {
      await api.delete(`/backup/admin/${backup.id}`)
      fetchData()
    } catch (error) {
      console.error('Error deleting backup:', error)
      alert('Failed to delete backup')
    }
  }

  const runCleanup = async () => {
    try {
      const response = await api.post('/backup/admin/cleanup')
      alert(response.data.message)
      fetchData()
    } catch (error) {
      console.error('Error running cleanup:', error)
      alert('Failed to run cleanup')
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'FULL_SYSTEM': return 'text-blue-400 bg-blue-400/10'
      case 'USER_DATA': return 'text-green-400 bg-green-400/10'
      case 'SETTINGS': return 'text-purple-400 bg-purple-400/10'
      default: return 'text-gray-400 bg-gray-400/10'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-400'
      case 'IN_PROGRESS': return 'text-yellow-400'
      case 'FAILED': return 'text-red-400'
      case 'EXPIRED': return 'text-gray-500'
      default: return 'text-gray-400'
    }
  }

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/settings" className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">System Backup</h1>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Create Backup</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={createFullBackup}
            disabled={creating !== null}
            className="btn-primary py-3"
          >
            {creating === 'full' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Full Backup
              </span>
            )}
          </button>

          <button
            onClick={createSettingsBackup}
            disabled={creating !== null}
            className="btn-secondary py-3"
          >
            {creating === 'settings' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
                Settings Only
              </span>
            )}
          </button>

          <button
            onClick={runScheduledBackup}
            disabled={creating !== null}
            className="btn-secondary py-3"
          >
            {creating === 'scheduled' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Running...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Scheduled
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Storage Stats */}
      {stats && (
        <div className="card">
          <h3 className="text-white font-medium mb-4">Storage Usage</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-dark-elevated rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{stats.storage?.totalBackups || 0}</p>
              <p className="text-gray-400 text-sm">Total Backups</p>
            </div>
            <div className="bg-dark-elevated rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{formatFileSize(stats.storage?.totalSize)}</p>
              <p className="text-gray-400 text-sm">Total Size</p>
            </div>
            <div className="bg-dark-elevated rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{stats.storage?.byType?.FULL_SYSTEM?.count || 0}</p>
              <p className="text-gray-400 text-sm">Full Backups</p>
            </div>
            <div className="bg-dark-elevated rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{stats.storage?.byType?.USER_DATA?.count || 0}</p>
              <p className="text-gray-400 text-sm">User Backups</p>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Settings */}
      {schedule && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Automatic Backup Schedule</h3>
            <button
              onClick={runCleanup}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Run Cleanup
            </button>
          </div>

          <div className="space-y-6">
            {/* Daily Backup */}
            <div className="bg-dark-elevated rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-white font-medium">Daily Backup</h4>
                  <p className="text-gray-400 text-sm">Last run: {formatDate(schedule.lastDailyRun)}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedule.dailyEnabled}
                    onChange={(e) => updateSchedule({ dailyEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                </label>
              </div>

              {schedule.dailyEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Time</label>
                    <input
                      type="time"
                      value={schedule.dailyTime}
                      onChange={(e) => updateSchedule({ dailyTime: e.target.value })}
                      className="w-full bg-dark-card text-white rounded-xl p-3 border border-dark-border"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Keep for (days)</label>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={schedule.dailyRetention}
                      onChange={(e) => updateSchedule({ dailyRetention: parseInt(e.target.value) })}
                      className="w-full bg-dark-card text-white rounded-xl p-3 border border-dark-border"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Weekly Backup */}
            <div className="bg-dark-elevated rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-white font-medium">Weekly Backup</h4>
                  <p className="text-gray-400 text-sm">Last run: {formatDate(schedule.lastWeeklyRun)}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedule.weeklyEnabled}
                    onChange={(e) => updateSchedule({ weeklyEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                </label>
              </div>

              {schedule.weeklyEnabled && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Day</label>
                    <select
                      value={schedule.weeklyDay}
                      onChange={(e) => updateSchedule({ weeklyDay: parseInt(e.target.value) })}
                      className="w-full bg-dark-card text-white rounded-xl p-3 border border-dark-border"
                    >
                      {daysOfWeek.map((day, i) => (
                        <option key={i} value={i}>{day}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Time</label>
                    <input
                      type="time"
                      value={schedule.weeklyTime}
                      onChange={(e) => updateSchedule({ weeklyTime: e.target.value })}
                      className="w-full bg-dark-card text-white rounded-xl p-3 border border-dark-border"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Keep (days)</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={schedule.weeklyRetention}
                      onChange={(e) => updateSchedule({ weeklyRetention: parseInt(e.target.value) })}
                      className="w-full bg-dark-card text-white rounded-xl p-3 border border-dark-border"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Backup List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">All Backups</h3>
          <div className="flex gap-2">
            <select
              value={filter.type}
              onChange={(e) => setFilter({ ...filter, type: e.target.value })}
              className="bg-dark-elevated text-white text-sm rounded-xl px-3 py-2 border border-dark-border"
            >
              <option value="">All Types</option>
              <option value="FULL_SYSTEM">Full System</option>
              <option value="USER_DATA">User Data</option>
              <option value="SETTINGS">Settings</option>
            </select>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="bg-dark-elevated text-white text-sm rounded-xl px-3 py-2 border border-dark-border"
            >
              <option value="">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : backups.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No backups found</p>
        ) : (
          <div className="space-y-3">
            {backups.map((backup) => (
              <div key={backup.id} className="bg-dark-elevated rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeColor(backup.type)}`}>
                        {backup.type.replace('_', ' ')}
                      </span>
                      <span className={`text-xs ${getStatusColor(backup.status)}`}>
                        {backup.status}
                      </span>
                      {backup.isAutomatic && (
                        <span className="text-xs text-gray-500">Auto ({backup.scheduleType})</span>
                      )}
                    </div>
                    <p className="text-white font-medium truncate">{backup.filename}</p>
                    <p className="text-gray-400 text-sm">{formatDate(backup.createdAt)}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      Size: {formatFileSize(backup.fileSize)}
                      {backup.expiresAt && ` | Expires: ${formatDate(backup.expiresAt)}`}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {backup.status === 'COMPLETED' && (
                      <button
                        onClick={() => downloadBackup(backup)}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                        title="Download"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => deleteBackup(backup)}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default BackupManagement
