import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function EmailSettings() {
  const [settings, setSettings] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpFrom: ''
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  // Push debug state
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [pushDebugResult, setPushDebugResult] = useState(null)
  const [pushTesting, setPushTesting] = useState(false)
  const [dingTesting, setDingTesting] = useState(false)

  useEffect(() => {
    fetchSettings()
    fetchUsers()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await api.get('/admin/settings')
      const s = response.data.settings
      setSettings({
        smtpHost: s.smtpHost || '',
        smtpPort: s.smtpPort || 587,
        smtpUser: s.smtpUser || '',
        smtpPass: s.smtpPass || '',
        smtpFrom: s.smtpFrom || ''
      })
    } catch (error) {
      console.error('Error fetching email settings:', error)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.patch('/admin/settings', settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Save error:', err)
      setError(err.response?.data?.message || 'Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const sendTestEmail = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const response = await api.post('/admin/notifications/test', { channel: 'email' })
      setTestResult({
        success: response.data.results?.email,
        message: response.data.results?.email ? 'Test email sent successfully!' : 'Failed to send test email'
      })
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to send test email. Check your settings.' })
    } finally {
      setTesting(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users')
      setUsers(response.data.users || [])
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }

  const testPushForUser = async () => {
    if (!selectedUserId) return
    setPushTesting(true)
    setPushDebugResult(null)
    try {
      const response = await api.post('/admin/notifications/test-push-user', {
        userId: selectedUserId
      })
      setPushDebugResult(response.data)
    } catch (err) {
      setPushDebugResult({ success: false, message: err.response?.data?.message || 'Request failed' })
    } finally {
      setPushTesting(false)
    }
  }

  const playTestDing = () => {
    setDingTesting(true)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      if (ctx.state === 'suspended') ctx.resume()

      const playTone = (frequency, startTime, duration) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.frequency.value = frequency
        oscillator.type = 'sine'
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05)
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
        oscillator.start(startTime)
        oscillator.stop(startTime + duration)
      }

      const now = ctx.currentTime
      playTone(880, now, 0.15)
      playTone(1100, now + 0.15, 0.2)
      playTone(1320, now + 0.35, 0.3)

      setTimeout(() => {
        ctx.close()
        setDingTesting(false)
      }, 1000)
    } catch (err) {
      console.error('Error playing ding:', err)
      setDingTesting(false)
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
        <h1 className="text-2xl font-bold text-white">Email Settings</h1>
        {saved && (
          <span className="text-success text-sm ml-auto flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
      </div>

      {/* Info */}
      <div className="card bg-accent/10 border border-accent/30">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-400 text-sm">
            When you save SMTP settings, VAPID keys for web push notifications will be auto-generated using your email address.
          </p>
        </div>
      </div>

      {/* SMTP Server */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">SMTP Server</h3>

        <div>
          <label className="text-gray-400 text-sm mb-1 block">Host</label>
          <input
            type="text"
            value={settings.smtpHost}
            onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
            placeholder="smtp.gmail.com"
            className="input w-full"
          />
        </div>

        <div>
          <label className="text-gray-400 text-sm mb-1 block">Port</label>
          <input
            type="number"
            value={settings.smtpPort}
            onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 587 })}
            placeholder="587"
            className="input w-full"
          />
          <p className="text-gray-500 text-xs mt-1">Common ports: 587 (TLS), 465 (SSL), 25 (unencrypted)</p>
        </div>
      </div>

      {/* Authentication */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Authentication</h3>

        <div>
          <label className="text-gray-400 text-sm mb-1 block">Username / Email</label>
          <input
            type="text"
            value={settings.smtpUser}
            onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
            placeholder="your-email@gmail.com"
            className="input w-full"
          />
        </div>

        <div>
          <label className="text-gray-400 text-sm mb-1 block">Password / App Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={settings.smtpPass}
              onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
              placeholder="App password"
              className="input w-full pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showPassword ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                )}
              </svg>
            </button>
          </div>
          <p className="text-gray-500 text-xs mt-1">
            For Gmail, use an App Password from your Google Account settings
          </p>
        </div>
      </div>

      {/* Sender */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Sender</h3>

        <div>
          <label className="text-gray-400 text-sm mb-1 block">From Email Address</label>
          <input
            type="email"
            value={settings.smtpFrom}
            onChange={(e) => setSettings({ ...settings, smtpFrom: e.target.value })}
            placeholder="noreply@homefit.app"
            className="input w-full"
          />
          <p className="text-gray-500 text-xs mt-1">This email will appear as the sender for all notifications</p>
        </div>
      </div>

      {/* Test Email */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Test Configuration</h3>
        <p className="text-gray-400 text-sm">Send a test email to your admin email address</p>

        <button
          onClick={sendTestEmail}
          disabled={testing || !settings.smtpHost}
          className="btn-secondary w-full"
        >
          {testing ? 'Sending...' : 'Send Test Email'}
        </button>

        {testResult && (
          <div className={`p-3 rounded-xl ${
            testResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {testResult.message}
          </div>
        )}
      </div>

      {/* Push Notification Debug */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Push Notification Debug</h3>
        <p className="text-gray-400 text-sm">Test push notifications for a specific user or test the rest timer ding sound</p>

        {/* User Selector */}
        <div>
          <label className="text-gray-400 text-sm mb-1 block">Select User</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="input w-full"
          >
            <option value="">-- Select a user --</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={testPushForUser}
            disabled={pushTesting || !selectedUserId}
            className="btn-secondary flex-1"
          >
            {pushTesting ? 'Sending...' : 'Send Test Push'}
          </button>

          <button
            onClick={playTestDing}
            disabled={dingTesting}
            className="btn-secondary flex-1"
          >
            {dingTesting ? 'Playing...' : 'Test Ding Sound'}
          </button>
        </div>

        {/* Push Debug Result */}
        {pushDebugResult && (
          <div className={`p-3 rounded-xl text-sm space-y-2 ${
            pushDebugResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            <p className="font-medium">{pushDebugResult.message}</p>
            {pushDebugResult.user && (
              <p className="text-xs opacity-80">User: {pushDebugResult.user.name} ({pushDebugResult.user.email})</p>
            )}
            {pushDebugResult.subscriptionCount !== undefined && (
              <p className="text-xs opacity-80">Subscriptions: {pushDebugResult.subscriptionCount}</p>
            )}
            {pushDebugResult.subscriptions?.map((sub, i) => (
              <div key={i} className="text-xs opacity-70 border-t border-white/10 pt-1 mt-1">
                <p className="flex items-center gap-1">
                  Status: <span className={`font-bold ${
                    sub.deliveryStatus === 'delivered' ? 'text-green-400' :
                    sub.deliveryStatus === 'expired_removed' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>{sub.deliveryStatus}</span>
                  {sub.error && <span className="text-red-300">({sub.error})</span>}
                </p>
                <p>Endpoint: {sub.endpoint}</p>
                <p>Agent: {sub.userAgent?.substring(0, 60) || 'Unknown'}</p>
                <p>Created: {new Date(sub.created).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={saveSettings}
        disabled={saving}
        className={`w-full py-3 rounded-xl font-medium transition-all ${
          saved
            ? 'bg-green-500 text-white'
            : 'bg-accent text-white hover:bg-accent/90'
        }`}
      >
        {saving ? 'Saving...' : saved ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        ) : 'Save Settings'}
      </button>
    </div>
  )
}

export default EmailSettings
