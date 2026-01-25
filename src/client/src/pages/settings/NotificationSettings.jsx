import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { useAuthStore } from '../../services/authStore'

function NotificationSettings() {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN'

  const [settings, setSettings] = useState({
    workoutReminders: true,
    reminderTime: '09:00',
    restDayReminders: false,
    friendActivity: true,
    achievements: true,
    weeklyProgress: true,
    // Notification channels
    notifyByEmail: true,
    notifyBySms: false,
    notifyByPush: true,
    phoneNumber: '',
    phoneCarrier: 'vtext.com',
    // Fun reminder settings
    reminderPersonality: 'supportive',
    reminderFrequency: 'daily',
    reminderDaysInactive: 1,
    enableFunnyReminders: true,
    enableStreakAlerts: true,
    enableAchievementTeases: true,
    enableSocialMotivation: true
  })

  const [personalities, setPersonalities] = useState({})
  const [testingReminder, setTestingReminder] = useState(false)
  const [previewMessage, setPreviewMessage] = useState(null)

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
    loadReminderSettings()
    loadPersonalities()
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

  const loadReminderSettings = async () => {
    try {
      const response = await api.get('/notifications/reminder-settings')
      setSettings(prev => ({
        ...prev,
        ...response.data
      }))
    } catch (error) {
      console.error('Error loading reminder settings:', error)
    }
  }

  const loadPersonalities = async () => {
    try {
      const response = await api.get('/notifications/reminder-personalities')
      setPersonalities(response.data.personalities || {})
    } catch (error) {
      console.error('Error loading personalities:', error)
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

      // Save to API - notification channels
      await api.patch('/notifications/settings', {
        notifyByEmail: settings.notifyByEmail,
        notifyBySms: settings.notifyBySms,
        notifyByPush: settings.notifyByPush,
        phoneNumber: settings.phoneNumber,
        phoneCarrier: settings.phoneCarrier,
        workoutReminders: settings.workoutReminders,
        socialNotifications: settings.friendActivity
      })

      // Save reminder settings
      await api.patch('/notifications/reminder-settings', {
        reminderPersonality: settings.reminderPersonality,
        reminderFrequency: settings.reminderFrequency,
        reminderTime: settings.reminderTime,
        reminderDaysInactive: settings.reminderDaysInactive,
        enableFunnyReminders: settings.enableFunnyReminders,
        enableStreakAlerts: settings.enableStreakAlerts,
        enableAchievementTeases: settings.enableAchievementTeases,
        enableSocialMotivation: settings.enableSocialMotivation,
        workoutReminders: settings.workoutReminders
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const testReminderNotification = async () => {
    setTestingReminder(true)
    try {
      const response = await api.post('/notifications/test-reminder', {
        forceTemplate: false
      })
      setPreviewMessage({
        title: response.data.title,
        message: response.data.message,
        personality: response.data.personality,
        usedAI: response.data.usedAI,
        channels: response.data.channels
      })
    } catch (error) {
      console.error('Error testing reminder:', error)
      alert('Failed to send test reminder')
    } finally {
      setTestingReminder(false)
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
          <>
            <div>
              <p className="text-gray-400 text-sm mb-2">Reminder Time</p>
              <input
                type="time"
                value={settings.reminderTime}
                onChange={(e) => setSettings({ ...settings, reminderTime: e.target.value })}
                className="input w-full"
              />
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-2">Days inactive before reminders</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="7"
                  value={settings.reminderDaysInactive}
                  onChange={(e) => setSettings({ ...settings, reminderDaysInactive: parseInt(e.target.value) })}
                  className="flex-1 accent-accent"
                />
                <span className="text-white w-16 text-center">
                  {settings.reminderDaysInactive} day{settings.reminderDaysInactive > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </>
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

      {/* Fun Reminder Personality */}
      {settings.workoutReminders && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">Reminder Personality</h3>
            <button
              onClick={() => setSettings({ ...settings, enableFunnyReminders: !settings.enableFunnyReminders })}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                settings.enableFunnyReminders ? 'bg-accent' : 'bg-dark-elevated'
              }`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                settings.enableFunnyReminders ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <p className="text-gray-500 text-sm">Choose how your workout reminders sound</p>

          {settings.enableFunnyReminders && Object.keys(personalities).length > 0 && (
            <>
              <div className="grid gap-3">
                {Object.entries(personalities).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => setSettings({ ...settings, reminderPersonality: key })}
                    className={`p-4 rounded-xl text-left transition-all ${
                      settings.reminderPersonality === key
                        ? 'bg-accent/20 border-2 border-accent'
                        : 'bg-dark-elevated border-2 border-transparent hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{p.emoji}</span>
                      <span className="text-white font-medium">{p.name}</span>
                      {settings.reminderPersonality === key && (
                        <svg className="w-5 h-5 text-accent ml-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm">{p.description}</p>
                    <p className="text-gray-400 text-xs mt-2 italic">"{p.preview}"</p>
                  </button>
                ))}
              </div>

              {/* Test Reminder Button */}
              <div className="pt-2">
                <button
                  onClick={testReminderNotification}
                  disabled={testingReminder}
                  className="btn-secondary w-full"
                >
                  {testingReminder ? 'Sending...' : 'Send Test Reminder'}
                </button>
                {previewMessage && (
                  <div className="mt-3 p-4 bg-dark-elevated rounded-xl">
                    <p className="text-white font-medium mb-1">{previewMessage.title}</p>
                    <p className="text-gray-300 text-sm">{previewMessage.message}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      {previewMessage.usedAI && <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">AI Generated</span>}
                      {previewMessage.channels.email && <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Email</span>}
                      {previewMessage.channels.push && <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Push</span>}
                      {previewMessage.channels.sms && <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">SMS</span>}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Additional Reminder Types */}
      {settings.workoutReminders && (
        <div className="card space-y-4">
          <h3 className="text-white font-medium">Smart Reminders</h3>
          <p className="text-gray-500 text-sm">Extra motivation when you need it</p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Streak Alerts</p>
              <p className="text-gray-500 text-sm">Warn me when my streak is at risk</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, enableStreakAlerts: !settings.enableStreakAlerts })}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                settings.enableStreakAlerts ? 'bg-accent' : 'bg-dark-elevated'
              }`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                settings.enableStreakAlerts ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Achievement Teases</p>
              <p className="text-gray-500 text-sm">When I'm close to an achievement</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, enableAchievementTeases: !settings.enableAchievementTeases })}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                settings.enableAchievementTeases ? 'bg-accent' : 'bg-dark-elevated'
              }`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                settings.enableAchievementTeases ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Social Motivation</p>
              <p className="text-gray-500 text-sm">When friends are working out</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, enableSocialMotivation: !settings.enableSocialMotivation })}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                settings.enableSocialMotivation ? 'bg-accent' : 'bg-dark-elevated'
              }`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                settings.enableSocialMotivation ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      )}

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
