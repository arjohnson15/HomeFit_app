import { Link } from 'react-router-dom'

function AboutSettings() {
  const appVersion = '0.1.0'
  const buildDate = '2026-01-01'

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
            <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-2a2 2 0 00-2 2v4h-2V7c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v4H3.5a1.5 1.5 0 000 3H5v4c0 1.1.9 2 2 2h2a2 2 0 002-2v-4h2v4c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-4h1.5a1.5 1.5 0 000-3z"/>
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

      {/* Links */}
      <div className="card p-0 divide-y divide-dark-border">
        <Link
          to="/privacy"
          className="flex items-center gap-4 p-4 hover:bg-dark-elevated transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="flex-1 text-white">Privacy Policy</span>
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          to="/terms"
          className="flex items-center gap-4 p-4 hover:bg-dark-elevated transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="flex-1 text-white">Terms of Service</span>
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
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
