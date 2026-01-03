import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { useAuthStore } from '../../services/authStore'

function NotificationSettings() {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN'

  const [settings, setSettings] = useState({
    workoutReminders: true,
    reminderTime: '08:00',
    restDayReminders: false,
    friendActivity: true,
    achievements: true,
    weeklyProgress: true,
    // Notification channels
    notifyByEmail: true,
    notifyBySms: false,
    notifyByPush: true,
    phoneNumber: '',
    phoneCarrier: 'vtext.com'
  })

  const carriers = [
    { id: 'vtext.com', label: 'Verizon' },
    { id: 'txt.att.net', label: 'AT&T' },
    { id: 'tmomail.net', label: 'T-Mobile' },
    { id: 'messaging.sprintpcs.com', label: 'Sprint' },
    { id: 'vmobl.com', label: 'Virgin Mobile' },
    { id: 'sms.myboostmobile.com', label: 'Boost Mobile' },
    { id: 'sms.cricketwireless.net', label: 'Cricket' },
    { id: 'email.uscc.net', label: 'US Cellular' },
    { id: 'mymetropcs.com', label: 'Metro PCS' }
  ]
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pushPermission, setPushPermission] = useState('default')
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [availableChannels, setAvailableChannels] = useState({
    email: false,
    sms: false,
    push: false,
    smsFromEmail: null
  })
  const [testingChannel, setTestingChannel] = useState(null)

  useEffect(() => {
    loadSettings()
    checkNotificationStatus()
    if ('Notification' in window) {
      setPushPermission(Notification.permission)
    }
  }, [])

  const loadSettings = async () => {
    try {
      // Load from localStorage first
      const saved = localStorage.getItem('notificationSettings')
      if (saved) {
        const localSettings = JSON.parse(saved)
        setSettings(prev => ({ ...prev, ...localSettings }))
      }

      // Then load from API
      const response = await api.get('/notifications/settings')
      setSettings(prev => ({
        ...prev,
        ...response.data
      }))
    } catch (error) {
      console.error('Error loading notification settings:', error)
    }
  }

  const checkNotificationStatus = async () => {
    try {
      const response = await api.get('/notifications/status')
      setAvailableChannels(response.data)
    } catch (error) {
      console.error('Error checking notification status:', error)
    }
  }

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('Push notifications are not supported in this browser')
      return
    }

    const permission = await Notification.requestPermission()
    setPushPermission(permission)

    if (permission === 'granted') {
      await subscribeToPush()
    }
  }

  const subscribeToPush = async () => {
    try {
      // Get VAPID public key from server
      const vapidResponse = await api.get('/notifications/vapid-public-key')
      if (!vapidResponse.data.available) {
        alert('Push notifications are not configured on the server')
        return
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidResponse.data.publicKey)
      })

      // Send subscription to server
      const subJson = subscription.toJSON()
      await api.post('/notifications/subscribe', {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        userAgent: navigator.userAgent
      })

      setPushSubscribed(true)
      setSettings(prev => ({ ...prev, notifyByPush: true }))
    } catch (error) {
      console.error('Error subscribing to push:', error)
      alert('Failed to enable push notifications')
    }
  }

  const unsubscribeFromPush = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager?.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
        await api.delete('/notifications/unsubscribe', {
          data: { endpoint: subscription.endpoint }
        })
      }

      setPushSubscribed(false)
      setSettings(prev => ({ ...prev, notifyByPush: false }))
    } catch (error) {
      console.error('Error unsubscribing from push:', error)
    }
  }

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  const saveSettings = async () => {
    setSaving(true)
    setSaved(false)
    try {
      // Save to localStorage
      localStorage.setItem('notificationSettings', JSON.stringify(settings))

      // Save to API
      await api.patch('/notifications/settings', {
        notifyByEmail: settings.notifyByEmail,
        notifyBySms: settings.notifyBySms,
        notifyByPush: settings.notifyByPush,
        phoneNumber: settings.phoneNumber,
        phoneCarrier: settings.phoneCarrier,
        workoutReminders: settings.workoutReminders,
        socialNotifications: settings.friendActivity
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const testNotification = async (channel) => {
    setTestingChannel(channel)
    try {
      await api.post('/notifications/test', { channel })
      alert(`Test ${channel} notification sent!`)
    } catch (error) {
      console.error('Error sending test notification:', error)
      alert(`Failed to send test ${channel} notification`)
    } finally {
      setTestingChannel(null)
    }
  }

  const formatPhoneNumber = (value) => {
    // Remove non-digits
    const cleaned = value.replace(/\D/g, '')
    // Format as (XXX) XXX-XXXX
    if (cleaned.length >= 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
    }
    return cleaned
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
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
      </div>

      {/* Notification Channels */}
      <div className="card">
        <h3 className="text-white font-medium mb-4">Notification Channels</h3>
        <p className="text-gray-500 text-sm mb-4">Choose how you want to receive notifications</p>

        {/* Email */}
        <div className="flex items-center justify-between py-3 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${availableChannels.email ? 'bg-blue-500/20' : 'bg-dark-elevated'}`}>
              <svg className={`w-5 h-5 ${availableChannels.email ? 'text-blue-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-white">Email</p>
              <p className="text-gray-500 text-sm">
                {availableChannels.email ? 'Receive notifications via email' : 'Not configured by admin'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSettings({ ...settings, notifyByEmail: !settings.notifyByEmail })}
            disabled={!availableChannels.email}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.notifyByEmail && availableChannels.email ? 'bg-accent' : 'bg-dark-elevated'
            } ${!availableChannels.email ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.notifyByEmail && availableChannels.email ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* SMS */}
        <div className="py-3 border-b border-dark-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${availableChannels.sms ? 'bg-green-500/20' : 'bg-dark-elevated'}`}>
                <svg className={`w-5 h-5 ${availableChannels.sms ? 'text-green-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-white">SMS</p>
                <p className="text-gray-500 text-sm">
                  {availableChannels.sms ? 'Text message notifications' : 'Requires email (SMTP) setup'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSettings({ ...settings, notifyBySms: !settings.notifyBySms })}
              disabled={!availableChannels.sms}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                settings.notifyBySms && availableChannels.sms ? 'bg-accent' : 'bg-dark-elevated'
              } ${!availableChannels.sms ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                settings.notifyBySms && availableChannels.sms ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {settings.notifyBySms && availableChannels.sms && (
            <div className="mt-4 space-y-4 pl-13">
              {/* Explanation */}
              <div className="p-3 bg-dark-elevated rounded-lg">
                <p className="text-gray-400 text-sm">
                  SMS notifications are sent via email-to-text. You must select your cell carrier for this to work.
                  {availableChannels.smsFromEmail && (
                    <span className="block mt-1 text-gray-500">
                      Messages will come from: <span className="text-white">{availableChannels.smsFromEmail}</span>
                    </span>
                  )}
                </p>
              </div>

              {/* Phone Number */}
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Phone Number</label>
                <input
                  type="tel"
                  value={settings.phoneNumber}
                  onChange={(e) => setSettings({ ...settings, phoneNumber: formatPhoneNumber(e.target.value) })}
                  className="input w-full"
                  placeholder="(555) 123-4567"
                />
              </div>

              {/* Carrier Selection */}
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Cell Carrier</label>
                <div className="grid grid-cols-2 gap-2">
                  {carriers.map((carrier) => (
                    <button
                      key={carrier.id}
                      onClick={() => setSettings({ ...settings, phoneCarrier: carrier.id })}
                      className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                        settings.phoneCarrier === carrier.id
                          ? 'bg-accent text-white'
                          : 'bg-dark-elevated text-gray-400 hover:text-white'
                      }`}
                    >
                      {carrier.label}
                    </button>
                  ))}
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  Select your carrier. If you switch carriers, update this setting.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Push */}
        <div className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${availableChannels.push ? 'bg-purple-500/20' : 'bg-dark-elevated'}`}>
                <svg className={`w-5 h-5 ${availableChannels.push ? 'text-purple-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <p className="text-white">Push Notifications</p>
                <p className="text-gray-500 text-sm">
                  {!availableChannels.push ? 'Not configured by admin' :
                    pushPermission === 'granted' ? 'Browser push enabled' :
                    pushPermission === 'denied' ? 'Blocked in browser settings' :
                    'Click to enable'}
                </p>
              </div>
            </div>
            {availableChannels.push && pushPermission !== 'granted' && pushPermission !== 'denied' && (
              <button onClick={requestPushPermission} className="btn-primary text-sm">
                Enable
              </button>
            )}
            {availableChannels.push && pushPermission === 'granted' && (
              <button
                onClick={() => {
                  if (settings.notifyByPush) {
                    unsubscribeFromPush()
                  } else {
                    subscribeToPush()
                  }
                }}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  settings.notifyByPush ? 'bg-accent' : 'bg-dark-elevated'
                }`}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.notifyByPush ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            )}
          </div>
        </div>

        {/* Test notifications */}
        {(availableChannels.email || availableChannels.push) && (
          <div className="mt-4 pt-4 border-t border-dark-border">
            <p className="text-gray-400 text-sm mb-2">Test notifications</p>
            <div className="flex gap-2">
              {availableChannels.email && settings.notifyByEmail && (
                <button
                  onClick={() => testNotification('email')}
                  disabled={testingChannel === 'email'}
                  className="btn-secondary text-xs flex-1"
                >
                  {testingChannel === 'email' ? 'Sending...' : 'Test Email'}
                </button>
              )}
              {availableChannels.sms && settings.notifyBySms && settings.phoneNumber && (
                <button
                  onClick={() => testNotification('sms')}
                  disabled={testingChannel === 'sms'}
                  className="btn-secondary text-xs flex-1"
                >
                  {testingChannel === 'sms' ? 'Sending...' : 'Test SMS'}
                </button>
              )}
              {availableChannels.push && settings.notifyByPush && pushPermission === 'granted' && (
                <button
                  onClick={() => testNotification('push')}
                  disabled={testingChannel === 'push'}
                  className="btn-secondary text-xs flex-1"
                >
                  {testingChannel === 'push' ? 'Sending...' : 'Test Push'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Workout Reminders */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Workout Reminders</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Daily Reminder</p>
            <p className="text-gray-500 text-sm">Remind me to work out</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, workoutReminders: !settings.workoutReminders })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.workoutReminders ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.workoutReminders ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {settings.workoutReminders && (
          <div>
            <p className="text-gray-400 text-sm mb-2">Reminder Time</p>
            <input
              type="time"
              value={settings.reminderTime}
              onChange={(e) => setSettings({ ...settings, reminderTime: e.target.value })}
              className="input w-full"
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Rest Day Reminders</p>
            <p className="text-gray-500 text-sm">Get reminded on rest days too</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, restDayReminders: !settings.restDayReminders })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.restDayReminders ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.restDayReminders ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Social Notifications */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Social</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Friend Activity</p>
            <p className="text-gray-500 text-sm">When friends complete workouts</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, friendActivity: !settings.friendActivity })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.friendActivity ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.friendActivity ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Progress Notifications */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">Progress</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Achievements</p>
            <p className="text-gray-500 text-sm">When you unlock achievements</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, achievements: !settings.achievements })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.achievements ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.achievements ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Weekly Progress</p>
            <p className="text-gray-500 text-sm">Weekly summary of your progress</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, weeklyProgress: !settings.weeklyProgress })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.weeklyProgress ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.weeklyProgress ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={saveSettings}
        disabled={saving}
        className={`w-full py-3 rounded-xl font-medium transition-all ${
          saved ? 'bg-success text-white' : 'btn-primary'
        }`}
      >
        {saving ? 'Saving...' : saved ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved!
          </span>
        ) : 'Save Settings'}
      </button>
    </div>
  )
}

export default NotificationSettings
