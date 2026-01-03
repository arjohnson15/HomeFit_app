import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function SMSSettings() {
  const [settings, setSettings] = useState({
    smsEnabled: false,
    smsGateway: 'vtext.com'
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [error, setError] = useState(null)
  const [testNumber, setTestNumber] = useState('')
  const [testing, setTesting] = useState(false)

  const gateways = [
    { id: 'vtext.com', label: 'Verizon', example: '1234567890@vtext.com' },
    { id: 'txt.att.net', label: 'AT&T', example: '1234567890@txt.att.net' },
    { id: 'tmomail.net', label: 'T-Mobile', example: '1234567890@tmomail.net' },
    { id: 'messaging.sprintpcs.com', label: 'Sprint', example: '1234567890@messaging.sprintpcs.com' },
    { id: 'vmobl.com', label: 'Virgin Mobile', example: '1234567890@vmobl.com' },
    { id: 'sms.myboostmobile.com', label: 'Boost Mobile', example: '1234567890@sms.myboostmobile.com' },
    { id: 'sms.cricketwireless.net', label: 'Cricket', example: '1234567890@sms.cricketwireless.net' },
    { id: 'email.uscc.net', label: 'US Cellular', example: '1234567890@email.uscc.net' },
    { id: 'mymetropcs.com', label: 'Metro PCS', example: '1234567890@mymetropcs.com' }
  ]

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await api.get('/admin/settings')
      const s = response.data.settings
      setSettings({
        smsEnabled: s.smsEnabled || false,
        smsGateway: s.smsGateway || 'vtext.com'
      })
    } catch (error) {
      console.error('Error fetching SMS settings:', error)
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

  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length >= 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
    }
    return cleaned
  }

  const sendTestSms = async () => {
    const cleanNumber = testNumber.replace(/\D/g, '')
    if (cleanNumber.length !== 10) {
      setTestResult({ success: false, message: 'Please enter a valid 10-digit phone number' })
      return
    }

    setTesting(true)
    setTestResult(null)
    try {
      const response = await api.post('/admin/notifications/test-sms', {
        phoneNumber: cleanNumber,
        gateway: settings.smsGateway
      })
      setTestResult({
        success: response.data.success,
        message: response.data.success
          ? 'Test SMS sent! Check your phone.'
          : response.data.message || 'Failed to send test SMS'
      })
    } catch (err) {
      console.error('Test SMS error:', err)
      setTestResult({
        success: false,
        message: err.response?.data?.message || 'Failed to send test SMS. Check your SMTP and SMS settings.'
      })
    } finally {
      setTesting(false)
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
        <h1 className="text-2xl font-bold text-white">SMS Setup</h1>
        {saved && (
          <span className="text-success text-sm ml-auto flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
      </div>

      {/* Info Card */}
      <div className="card bg-accent/10 border border-accent/30">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-white font-medium">Email-to-SMS Gateway</p>
            <p className="text-gray-400 text-sm mt-1">
              HomeFit sends SMS via email gateways provided by carriers. This requires your SMTP settings to be configured first. Users can add their phone number in their profile settings.
            </p>
          </div>
        </div>
      </div>

      {/* Enable SMS */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Enable SMS Notifications</p>
            <p className="text-gray-500 text-sm">Allow users to receive workout reminders via text</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, smsEnabled: !settings.smsEnabled })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.smsEnabled ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.smsEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {settings.smsEnabled && (
        <>
          {/* Carrier Selection */}
          <div className="card">
            <h3 className="text-white font-medium mb-4">Default SMS Gateway</h3>
            <p className="text-gray-400 text-sm mb-4">Select the carrier gateway to use for SMS. Most users are on Verizon, AT&T, or T-Mobile.</p>
            <div className="space-y-2">
              {gateways.map((gateway) => (
                <button
                  key={gateway.id}
                  onClick={() => setSettings({ ...settings, smsGateway: gateway.id })}
                  className={`w-full p-4 rounded-xl text-left transition-colors ${
                    settings.smsGateway === gateway.id
                      ? 'bg-accent text-white'
                      : 'bg-dark-elevated text-gray-400 hover:text-white'
                  }`}
                >
                  <p className="font-medium">{gateway.label}</p>
                  <p className={`text-sm ${settings.smsGateway === gateway.id ? 'text-white/70' : 'text-gray-500'}`}>
                    {gateway.example}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Test SMS */}
          <div className="card">
            <h3 className="text-white font-medium mb-2">Test SMS</h3>
            <p className="text-gray-400 text-sm mb-4">
              Send a test message to verify your SMS configuration is working.
            </p>
            <div className="flex gap-3">
              <input
                type="tel"
                value={testNumber}
                onChange={(e) => setTestNumber(formatPhoneNumber(e.target.value))}
                placeholder="(555) 123-4567"
                className="input flex-1"
                maxLength={14}
              />
              <button
                onClick={sendTestSms}
                disabled={testing || !testNumber}
                className="btn-secondary whitespace-nowrap"
              >
                {testing ? 'Sending...' : 'Send Test'}
              </button>
            </div>
            {testResult && (
              <div className={`mt-3 p-3 rounded-xl text-sm ${
                testResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {testResult.message}
              </div>
            )}
          </div>
        </>
      )}

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

export default SMSSettings
