import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function AboutSettings() {
  const [updateInfo, setUpdateInfo] = useState(null)
  const [checking, setChecking] = useState(false)

  const appVersion = '0.1.0'
  const buildDate = '2026-01-01'

  const checkForUpdates = async () => {
    setChecking(true)
    try {
      const response = await api.get('/admin/updates/check')
      setUpdateInfo(response.data)
    } catch (error) {
      setUpdateInfo({ available: false, message: 'Unable to check for updates' })
    } finally {
      setChecking(false)
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
        <h1 className="text-2xl font-bold text-white">About</h1>
      </div>

      {/* App Info */}
      <div className="card text-center py-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center">
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">HomeFit</h2>
        <p className="text-gray-400">Your Personal Home Gym Tracker</p>
      </div>

      {/* Version Info */}
      <div className="card">
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-gray-400">Version</span>
            <span className="text-white font-medium">{appVersion}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Build Date</span>
            <span className="text-white">{buildDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Platform</span>
            <span className="text-white">Web (PWA)</span>
          </div>
        </div>
      </div>

      {/* Updates */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Updates</h3>
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
        {updateInfo && (
          <div className={`mt-4 p-3 rounded-xl ${
            updateInfo.available
              ? 'bg-accent/20 text-accent'
              : 'bg-dark-elevated text-gray-400'
          }`}>
            {updateInfo.available ? (
              <>
                <p className="font-medium">Update Available: v{updateInfo.version}</p>
                <p className="text-sm mt-1">{updateInfo.message}</p>
              </>
            ) : (
              <p>You're running the latest version</p>
            )}
          </div>
        )}
      </div>

      {/* Links */}
      <div className="card p-0 divide-y divide-dark-border">
        <a
          href="https://github.com/arjohnson15/HomeFit_app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 hover:bg-dark-elevated transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          <span className="flex-1 text-white">GitHub Repository</span>
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <a
          href="mailto:support@homefit.app"
          className="flex items-center gap-4 p-4 hover:bg-dark-elevated transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="flex-1 text-white">Contact Support</span>
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
        <button
          onClick={() => window.open('/privacy', '_blank')}
          className="flex items-center gap-4 p-4 hover:bg-dark-elevated transition-colors w-full text-left"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="flex-1 text-white">Privacy Policy</span>
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={() => window.open('/terms', '_blank')}
          className="flex items-center gap-4 p-4 hover:bg-dark-elevated transition-colors w-full text-left"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="flex-1 text-white">Terms of Service</span>
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Credits */}
      <div className="text-center py-4">
        <p className="text-gray-500 text-sm">
          Made with ❤️ for home gym enthusiasts
        </p>
        <p className="text-gray-600 text-xs mt-2">
          © 2026 HomeFit. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default AboutSettings
