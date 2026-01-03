import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function UpdatesSettings() {
  const [updateInfo, setUpdateInfo] = useState(null)
  const [settings, setSettings] = useState({
    autoUpdate: true,
    checkInterval: 3600000,
    branch: 'main'
  })
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [logs, setLogs] = useState([])

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const [statusRes, logsRes] = await Promise.all([
        api.get('/admin/updates/status').catch(() => ({ data: {} })),
        api.get('/admin/updates/logs').catch(() => ({ data: { logs: [] } }))
      ])
      if (statusRes.data) {
        setUpdateInfo(statusRes.data)
      }
      setLogs(logsRes.data.logs || [])
    } catch (error) {
      console.error('Error fetching update status:', error)
    }
  }

  const checkForUpdates = async () => {
    setChecking(true)
    try {
      const response = await api.get('/admin/updates/check')
      setUpdateInfo(response.data)
    } catch (error) {
      console.error('Error checking for updates:', error)
    } finally {
      setChecking(false)
    }
  }

  const installUpdate = async () => {
    if (!confirm('This will restart the server. Continue?')) return
    setUpdating(true)
    try {
      await api.post('/admin/updates/install')
      // Server will restart, so we'll lose connection
      setTimeout(() => {
        window.location.reload()
      }, 5000)
    } catch (error) {
      console.error('Error installing update:', error)
      setUpdating(false)
    }
  }

  const saveSettings = async () => {
    try {
      await api.put('/admin/updates/settings', settings)
    } catch (error) {
      console.error('Error saving settings:', error)
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
        <h1 className="text-2xl font-bold text-white">System Updates</h1>
      </div>

      {/* Current Version */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-medium">Current Version</h3>
            <p className="text-gray-400 text-sm">HomeFit v{updateInfo?.currentVersion || '0.1.0'}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm ${
            updateInfo?.available ? 'bg-accent/20 text-accent' : 'bg-green-500/20 text-green-400'
          }`}>
            {updateInfo?.available ? 'Update Available' : 'Up to Date'}
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
      {updateInfo?.available && (
        <div className="card border border-accent/30">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium">Version {updateInfo.latestVersion}</h3>
              <p className="text-gray-400 text-sm mt-1">{updateInfo.releaseNotes || 'Bug fixes and improvements'}</p>
              <div className="mt-4">
                <button
                  onClick={installUpdate}
                  disabled={updating}
                  className="btn-primary"
                >
                  {updating ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Installing...
                    </span>
                  ) : (
                    'Install Update'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto Update Settings */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Auto-Update</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Automatic Updates</p>
            <p className="text-gray-500 text-sm">Install updates automatically</p>
          </div>
          <button
            onClick={() => {
              setSettings({ ...settings, autoUpdate: !settings.autoUpdate })
              saveSettings()
            }}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.autoUpdate ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.autoUpdate ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div>
          <label className="text-gray-400 text-sm mb-2 block">Check Interval</label>
          <select
            value={settings.checkInterval}
            onChange={(e) => {
              setSettings({ ...settings, checkInterval: parseInt(e.target.value) })
              saveSettings()
            }}
            className="input w-full"
          >
            <option value={3600000}>Every hour</option>
            <option value={21600000}>Every 6 hours</option>
            <option value={86400000}>Daily</option>
            <option value={604800000}>Weekly</option>
          </select>
        </div>
      </div>

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
            <span className="text-white">{settings.branch}</span>
          </div>
        </div>
      </div>

      {/* Update History */}
      {logs.length > 0 && (
        <div className="card">
          <h3 className="text-white font-medium mb-4">Update History</h3>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${
                  log.success ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <div>
                  <p className="text-white">{log.version}</p>
                  <p className="text-gray-500 text-xs">
                    {new Date(log.date).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default UpdatesSettings
