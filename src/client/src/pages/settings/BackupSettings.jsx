import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function BackupSettings() {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [storageUsed, setStorageUsed] = useState(0)
  const [importOptions, setImportOptions] = useState({
    includeWorkouts: true,
    includeNutrition: true,
    includeSchedules: true,
    includeSettings: true,
    mergeMode: 'replace'
  })
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchBackups()
    calculateStorageUsed()
  }, [])

  const calculateStorageUsed = () => {
    try {
      const used = JSON.stringify(localStorage).length / 1024
      setStorageUsed(used)
    } catch {
      setStorageUsed(0)
    }
  }

  const fetchBackups = async () => {
    try {
      const response = await api.get('/backup/user/history')
      setBackups(response.data.backups || [])
    } catch (error) {
      console.error('Error fetching backups:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportData = async () => {
    setExporting(true)
    try {
      const response = await api.get('/backup/user/export')
      const data = response.data

      // Create download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `homefit-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Refresh backup list
      fetchBackups()
    } catch (error) {
      console.error('Error exporting data:', error)
      alert('Failed to export data. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type !== 'application/json') {
      alert('Please select a JSON file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result)

        // Validate backup format
        if (!data.schemaVersion || !data.type || !data.data) {
          alert('Invalid backup file format')
          return
        }

        if (data.type !== 'USER_DATA') {
          alert('This is not a user data backup file')
          return
        }

        // Create preview
        const preview = {
          exportedAt: data.exportedAt,
          schemaVersion: data.schemaVersion,
          counts: {
            workouts: data.data.workoutSessions?.length || 0,
            recipes: data.data.recipes?.length || 0,
            foodLogs: data.data.foodLogEntries?.length || 0,
            weightLogs: data.data.weightLogs?.length || 0,
            weeklySchedules: data.data.weeklySchedules?.length || 0,
            achievements: data.data.userAchievements?.length || 0
          }
        }

        setImportFile(file)
        setImportPreview(preview)
        setShowImportModal(true)
      } catch (error) {
        alert('Failed to parse backup file')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!importFile) return

    setImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('backup', importFile)
      formData.append('mergeMode', importOptions.mergeMode)
      formData.append('includeWorkouts', importOptions.includeWorkouts)
      formData.append('includeNutrition', importOptions.includeNutrition)
      formData.append('includeSchedules', importOptions.includeSchedules)
      formData.append('includeSettings', importOptions.includeSettings)

      const response = await api.post('/backup/user/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setImportResult(response.data.results)
    } catch (error) {
      console.error('Error importing data:', error)
      setImportResult({ errors: [{ table: 'general', error: error.response?.data?.error || 'Import failed' }] })
    } finally {
      setImporting(false)
    }
  }

  const closeImportModal = () => {
    setShowImportModal(false)
    setImportFile(null)
    setImportPreview(null)
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const downloadBackup = async (backup) => {
    try {
      const response = await api.get(`/backup/user/${backup.id}/download`)
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
      await api.delete(`/backup/user/${backup.id}`)
      fetchBackups()
    } catch (error) {
      console.error('Error deleting backup:', error)
      alert('Failed to delete backup')
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const clearLocalData = () => {
    const keysToKeep = ['token', 'auth-storage'] // Keep auth data
    const allKeys = Object.keys(localStorage)
    allKeys.forEach(key => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key)
      }
    })
    calculateStorageUsed()
    alert('Local data cleared successfully')
  }

  const deleteAccount = async () => {
    setDeletingAccount(true)
    try {
      await api.delete('/users/account')
      localStorage.clear()
      window.location.href = '/login'
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('Failed to delete account. Please try again.')
    } finally {
      setDeletingAccount(false)
      setShowDeleteConfirm(false)
    }
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
        <h1 className="text-2xl font-bold text-white">Data & Backup</h1>
      </div>

      {/* Export Section */}
      <div className="card">
        <h3 className="text-white font-medium mb-2">Export Your Data</h3>
        <p className="text-gray-400 text-sm mb-4">
          Download all your workout history, nutrition data, schedules, and settings as a backup file.
        </p>
        <button
          onClick={exportData}
          disabled={exporting}
          className="btn-primary w-full"
        >
          {exporting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Creating Backup...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Create Backup
            </span>
          )}
        </button>
      </div>

      {/* Import Section */}
      <div className="card">
        <h3 className="text-white font-medium mb-2">Restore From Backup</h3>
        <p className="text-gray-400 text-sm mb-4">
          Import data from a previous backup file to restore your workouts, nutrition, and settings.
        </p>
        <input
          type="file"
          accept=".json,application/json"
          onChange={handleFileSelect}
          ref={fileInputRef}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary w-full"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Select Backup File
          </span>
        </button>
      </div>

      {/* Backup History */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Backup History</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : backups.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No backups yet. Create your first backup above.</p>
        ) : (
          <div className="space-y-3">
            {backups.map((backup) => (
              <div key={backup.id} className="bg-dark-elevated rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{backup.filename}</p>
                    <p className="text-gray-400 text-sm">{formatDate(backup.createdAt)}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      Size: {formatFileSize(backup.fileSize)} | Status: {backup.status}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => downloadBackup(backup)}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      title="Download"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
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

      {/* Storage Info */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Storage</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Local Storage</span>
            <span className="text-white">{storageUsed.toFixed(1)} KB</span>
          </div>
          <div className="h-2 bg-dark-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full"
              style={{ width: `${Math.min((storageUsed / 5000) * 100, 100)}%` }}
            />
          </div>
          <p className="text-gray-500 text-sm">5 MB limit for local storage</p>
        </div>
      </div>

      {/* Clear Local Data */}
      <div className="card">
        <h3 className="text-white font-medium mb-2">Clear Local Data</h3>
        <p className="text-gray-400 text-sm mb-4">
          Clear cached data and settings stored on this device. Your account data on the server will not be affected.
        </p>
        <button
          onClick={clearLocalData}
          className="btn-secondary w-full"
        >
          Clear Local Data
        </button>
      </div>

      {/* Danger Zone */}
      <div className="card border border-red-500/30">
        <h3 className="text-red-400 font-medium mb-2">Danger Zone</h3>
        <p className="text-gray-400 text-sm mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="btn-secondary w-full text-red-400 border-red-500/30 hover:bg-red-500/10"
        >
          Delete Account
        </button>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card max-w-sm w-full rounded-3xl p-6">
            <h3 className="text-xl font-bold text-white mb-2">Delete Account?</h3>
            <p className="text-gray-400 mb-6">
              This will permanently delete your account, all workouts, schedules, and settings. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={deletingAccount}
                className="flex-1 py-3 px-4 rounded-xl bg-red-500 text-white font-medium"
              >
                {deletingAccount ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card max-w-md w-full rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
            {!importResult ? (
              <>
                <h3 className="text-xl font-bold text-white mb-4">Import Backup</h3>

                {importPreview && (
                  <div className="bg-dark-elevated rounded-xl p-4 mb-4">
                    <p className="text-gray-400 text-sm mb-2">Backup from: {formatDate(importPreview.exportedAt)}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-400">Workouts:</div>
                      <div className="text-white">{importPreview.counts.workouts}</div>
                      <div className="text-gray-400">Recipes:</div>
                      <div className="text-white">{importPreview.counts.recipes}</div>
                      <div className="text-gray-400">Food Logs:</div>
                      <div className="text-white">{importPreview.counts.foodLogs}</div>
                      <div className="text-gray-400">Weight Logs:</div>
                      <div className="text-white">{importPreview.counts.weightLogs}</div>
                      <div className="text-gray-400">Schedules:</div>
                      <div className="text-white">{importPreview.counts.weeklySchedules}</div>
                    </div>
                  </div>
                )}

                <div className="space-y-3 mb-6">
                  <p className="text-gray-400 text-sm">Select what to import:</p>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={importOptions.includeWorkouts}
                      onChange={(e) => setImportOptions({ ...importOptions, includeWorkouts: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-600 bg-dark-elevated text-accent focus:ring-accent"
                    />
                    <span className="text-white">Workout History</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={importOptions.includeNutrition}
                      onChange={(e) => setImportOptions({ ...importOptions, includeNutrition: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-600 bg-dark-elevated text-accent focus:ring-accent"
                    />
                    <span className="text-white">Nutrition Data</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={importOptions.includeSchedules}
                      onChange={(e) => setImportOptions({ ...importOptions, includeSchedules: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-600 bg-dark-elevated text-accent focus:ring-accent"
                    />
                    <span className="text-white">Workout Schedules</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={importOptions.includeSettings}
                      onChange={(e) => setImportOptions({ ...importOptions, includeSettings: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-600 bg-dark-elevated text-accent focus:ring-accent"
                    />
                    <span className="text-white">Settings & Preferences</span>
                  </label>
                </div>

                <div className="mb-6">
                  <p className="text-gray-400 text-sm mb-2">Import mode:</p>
                  <select
                    value={importOptions.mergeMode}
                    onChange={(e) => setImportOptions({ ...importOptions, mergeMode: e.target.value })}
                    className="w-full bg-dark-elevated text-white rounded-xl p-3 border border-dark-border"
                  >
                    <option value="replace">Replace existing data</option>
                    <option value="skip_existing">Keep existing, add new</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={closeImportModal}
                    className="btn-secondary flex-1"
                    disabled={importing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="btn-primary flex-1"
                  >
                    {importing ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Importing...
                      </span>
                    ) : (
                      'Import'
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-white mb-4">Import Complete</h3>

                {importResult.errors?.length > 0 ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                    <p className="text-red-400 font-medium mb-2">Some errors occurred:</p>
                    <ul className="text-red-400/80 text-sm space-y-1">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err.table}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {importResult.imported && Object.keys(importResult.imported).length > 0 && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
                    <p className="text-green-400 font-medium mb-2">Successfully imported:</p>
                    <ul className="text-green-400/80 text-sm space-y-1">
                      {Object.entries(importResult.imported).map(([key, count]) => (
                        <li key={key}>{key}: {count} items</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={closeImportModal}
                  className="btn-primary w-full"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default BackupSettings
