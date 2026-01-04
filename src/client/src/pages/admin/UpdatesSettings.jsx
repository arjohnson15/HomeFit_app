import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function UpdatesSettings() {
  const [updateInfo, setUpdateInfo] = useState(null)
  const [releaseHistory, setReleaseHistory] = useState([])
  const [checking, setChecking] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [updateInstructions, setUpdateInstructions] = useState(null)
  const [error, setError] = useState(null)
  const [applying, setApplying] = useState(false)
  const [updateStatus, setUpdateStatus] = useState(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const statusPollRef = useRef(null)

  useEffect(() => {
    fetchStatus()
    fetchHistory()

    // Cleanup polling on unmount
    return () => {
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current)
      }
    }
  }, [])

  const fetchStatus = async () => {
    try {
      setError(null)
      const response = await api.get('/admin/updates')
      setUpdateInfo(response.data)
    } catch (err) {
      console.error('Error fetching update status:', err)
      setError('Failed to check for updates')
    }
  }

  const fetchHistory = async () => {
    try {
      const response = await api.get('/admin/updates/history')
      setReleaseHistory(response.data.releases || [])
    } catch (err) {
      console.error('Error fetching release history:', err)
    }
  }

  const checkForUpdates = async () => {
    setChecking(true)
    setError(null)
    try {
      const response = await api.post('/admin/updates/check')
      setUpdateInfo(response.data)
      // Also refresh history
      fetchHistory()
    } catch (err) {
      console.error('Error checking for updates:', err)
      setError('Failed to check for updates. Make sure you have internet access.')
    } finally {
      setChecking(false)
    }
  }

  const handleApplyUpdate = async () => {
    setApplying(true)
    setError(null)
    setUpdateStatus({ inProgress: true, logs: ['Starting update...'] })

    try {
      const response = await api.post('/admin/updates/apply')
      const data = response.data

      if (data.success && data.status === 'in_progress') {
        // Update started, poll for status
        pollUpdateStatus()
      } else if (data.instructions) {
        // Automatic update not available, show manual instructions
        setApplying(false)
        setUpdateInstructions(data)
        setShowInstructions(true)
        setUpdateStatus(null)
      } else {
        setApplying(false)
        setUpdateStatus(null)
        setError(data.message || 'Update failed')
      }
    } catch (err) {
      console.error('Error applying update:', err)
      setApplying(false)
      setUpdateStatus(null)
      setError(err.response?.data?.message || 'Failed to apply update')
    }
  }

  const pollUpdateStatus = () => {
    // Poll every 2 seconds
    statusPollRef.current = setInterval(async () => {
      try {
        const response = await api.get('/admin/updates/status')
        setUpdateStatus(response.data)

        if (!response.data.inProgress) {
          // Update finished
          clearInterval(statusPollRef.current)
          statusPollRef.current = null
          setApplying(false)

          if (response.data.lastResult === 'success') {
            setShowSuccess(true)
            // Refresh after 3 seconds
            setTimeout(() => {
              window.location.reload()
            }, 3000)
          } else if (response.data.lastResult === 'already_current') {
            setError('Already up to date!')
            setUpdateStatus(null)
          } else if (response.data.lastResult === 'failed') {
            setError('Update failed. Check the logs below.')
          }
        }
      } catch {
        // Server might be restarting, keep polling
      }
    }, 2000)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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
        <h1 className="text-2xl font-bold text-white">System Updates</h1>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-4 rounded-xl">
          {error}
        </div>
      )}

      {/* Current Version */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-medium">Current Version</h3>
            <p className="text-gray-400 text-sm">HomeFit v{updateInfo?.currentVersion || '...'}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm ${
            updateInfo?.updateAvailable
              ? 'bg-accent/20 text-accent'
              : 'bg-green-500/20 text-green-400'
          }`}>
            {updateInfo?.updateAvailable ? 'Update Available' : 'Up to Date'}
          </div>
        </div>

        <button
          onClick={checkForUpdates}
          disabled={checking}
          className="btn-secondary w-full"
        >
          {checking ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Checking...
            </span>
          ) : (
            'Check for Updates'
          )}
        </button>
      </div>

      {/* Available Update */}
      {updateInfo?.updateAvailable && (
        <div className="card border border-accent/30">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium">{updateInfo.releaseName || `Version ${updateInfo.latestVersion}`}</h3>
              <p className="text-gray-500 text-xs mt-0.5">
                Released {formatDate(updateInfo.publishedAt)}
              </p>
              {updateInfo.releaseNotes && (
                <div className="mt-3 p-3 bg-dark-elevated rounded-lg text-sm text-gray-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {updateInfo.releaseNotes}
                </div>
              )}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleApplyUpdate}
                  disabled={applying}
                  className="btn-primary"
                >
                  {applying ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Applying Update...
                    </span>
                  ) : (
                    'Apply Update'
                  )}
                </button>
                {updateInfo.releaseUrl && !applying && (
                  <a
                    href={updateInfo.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    View on GitHub
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Progress */}
      {updateStatus && updateStatus.inProgress && (
        <div className="card border border-blue-500/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <h3 className="text-white font-medium">Updating...</h3>
          </div>
          <div className="bg-dark-base rounded-lg p-4 font-mono text-xs max-h-48 overflow-y-auto">
            {updateStatus.logs?.map((log, idx) => (
              <div key={idx} className="text-gray-300">{log}</div>
            ))}
          </div>
          <p className="text-gray-500 text-sm mt-3">
            The application will restart automatically when the update completes.
          </p>
        </div>
      )}

      {/* Update Success */}
      {showSuccess && (
        <div className="card border border-green-500/30 bg-green-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-green-400 font-medium">Update Complete!</h3>
              <p className="text-gray-400 text-sm">The page will refresh automatically...</p>
            </div>
          </div>
        </div>
      )}

      {/* Update Instructions Modal */}
      {showInstructions && updateInstructions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium text-lg">Update Instructions</h3>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-dark-elevated p-3 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Current</span>
                  <span className="text-white">v{updateInstructions.updateInfo?.currentVersion}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">New</span>
                  <span className="text-accent">v{updateInstructions.updateInfo?.newVersion}</span>
                </div>
              </div>

              <div>
                <p className="text-gray-300 text-sm mb-3">
                  Run these commands on your server to apply the update:
                </p>
                <div className="bg-dark-base rounded-lg p-4 font-mono text-sm">
                  {updateInstructions.instructions?.slice(1).map((cmd, idx) => (
                    <div key={idx} className="text-green-400">
                      {cmd.startsWith('cd ') || cmd.startsWith('git ') || cmd.startsWith('docker')
                        ? <span className="text-gray-500">$ </span>
                        : null}
                      {cmd}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  const cmds = updateInstructions.instructions?.slice(1).join('\n')
                  navigator.clipboard.writeText(cmds)
                }}
                className="btn-secondary w-full"
              >
                Copy Commands
              </button>

              {updateInstructions.updateInfo?.releaseUrl && (
                <a
                  href={updateInstructions.updateInfo.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost w-full text-center block"
                >
                  View Full Release Notes
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GitHub Info */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">GitHub Repository</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400">Repository</span>
            <a
              href="https://github.com/arjohnson15/HomeFit_app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              arjohnson15/HomeFit_app
            </a>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Branch</span>
            <span className="text-white">main</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Latest Version</span>
            <span className="text-white">v{updateInfo?.latestVersion || '...'}</span>
          </div>
        </div>
      </div>

      {/* Release History */}
      {releaseHistory.length > 0 && (
        <div className="card">
          <h3 className="text-white font-medium mb-4">Release History</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {releaseHistory.map((release, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 bg-dark-elevated rounded-lg"
              >
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  idx === 0 ? 'bg-accent' : 'bg-gray-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white font-medium truncate">
                      {release.name || `v${release.version}`}
                    </p>
                    <span className="text-gray-500 text-xs flex-shrink-0">
                      {formatDate(release.publishedAt)}
                    </span>
                  </div>
                  {release.notes && (
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                      {release.notes.split('\n')[0]}
                    </p>
                  )}
                  {release.url && (
                    <a
                      href={release.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent text-xs hover:underline mt-1 inline-block"
                    >
                      View release
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="card bg-dark-elevated/50">
        <h3 className="text-white font-medium mb-2">How Updates Work</h3>
        <div className="text-gray-400 text-sm space-y-2">
          <p>
            HomeFit uses Docker for deployment. When an update is available, you'll need to run the update commands on your server.
          </p>
          <p>
            Updates include new features, bug fixes, and security patches. We recommend keeping your installation up to date.
          </p>
          <p>
            Before updating, it's a good idea to create a backup using the Backup Management page.
          </p>
        </div>
      </div>
    </div>
  )
}

export default UpdatesSettings
