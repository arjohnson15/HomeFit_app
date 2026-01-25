import express from 'express'
import prisma from '../lib/prisma.js'
import { authenticateToken } from '../middleware/auth.js'
import notificationService from '../services/notifications.js'
import workoutReminderService, { PERSONALITIES } from '../services/workoutReminders.js'

const router = express.Router()

// All routes require auth
router.use(authenticateToken)

// GET /api/notifications/vapid-public-key
// Get the VAPID public key for web push subscriptions
router.get('/vapid-public-key', async (req, res, next) => {
  try {
    await notificationService.loadSettings()
    const publicKey = notificationService.getPublicVapidKey()

    if (!publicKey) {
      return res.status(404).json({
        message: 'Push notifications not configured',
        available: false
      })
    }

    res.json({ publicKey, available: true })
  } catch (error) {
    next(error)
  }
})

// GET /api/notifications/status
// Get notification availability status
router.get('/status', async (req, res, next) => {
  try {
    await notificationService.loadSettings()

    // Get app settings for SMS from email
    const appSettings = await prisma.appSettings.findFirst()

    res.json({
      email: notificationService.isEmailAvailable(),
      sms: notificationService.isSmsAvailable(),
      push: notificationService.isPushAvailable(),
      // Include SMS from email so users know what to expect
      smsFromEmail: appSettings?.smtpFrom || null
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/notifications/subscribe
// Subscribe to push notifications
router.post('/subscribe', async (req, res, next) => {
  try {
    const { endpoint, keys, userAgent } = req.body

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: 'Invalid subscription data' })
    }

    // Upsert the subscription
    const subscription = await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: req.user.id,
          endpoint
        }
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || null,
        updatedAt: new Date()
      },
      create: {
        userId: req.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || null
      }
    })

    res.json({ message: 'Subscribed successfully', id: subscription.id })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/notifications/unsubscribe
// Unsubscribe from push notifications
router.delete('/unsubscribe', async (req, res, next) => {
  try {
    const { endpoint } = req.body

    if (!endpoint) {
      return res.status(400).json({ message: 'Endpoint required' })
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: req.user.id,
        endpoint
      }
    })

    res.json({ message: 'Unsubscribed successfully' })
  } catch (error) {
    next(error)
  }
})

// GET /api/notifications/push-debug
// Diagnostic endpoint for push notification issues
router.get('/push-debug', async (req, res, next) => {
  try {
    await notificationService.loadSettings()

    // Get user's push subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        endpoint: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // Get app settings (without sensitive data)
    const appSettings = await prisma.appSettings.findFirst()

    res.json({
      pushAvailable: notificationService.isPushAvailable(),
      vapidConfigured: !!appSettings?.vapidPublicKey,
      smtpConfigured: !!(appSettings?.smtpHost && appSettings?.smtpUser),
      subscriptionCount: subscriptions.length,
      subscriptions: subscriptions.map(s => ({
        id: s.id,
        endpoint: s.endpoint.substring(0, 60) + '...',
        userAgent: s.userAgent?.substring(0, 50),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      })),
      troubleshooting: !notificationService.isPushAvailable()
        ? 'VAPID keys not configured. SMTP must be set up first (they are auto-generated when SMTP is configured). Try restarting the server.'
        : subscriptions.length === 0
        ? 'No push subscriptions found. User needs to click "Enable" on push notifications in Settings > Notifications.'
        : 'Push should be working. Try sending a test notification.'
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/notifications/test
// Send a test notification
router.post('/test', async (req, res, next) => {
  try {
    const { channel } = req.body // 'email', 'sms', 'push', or 'all'

    await notificationService.loadSettings()

    const results = {}

    if (channel === 'email' || channel === 'all') {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } })
      results.email = await notificationService.sendEmail(
        user.email,
        'HomeFit Test Notification',
        '<h1>Test Notification</h1><p>Email notifications are working!</p>'
      )
    }

    if (channel === 'sms' || channel === 'all') {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: req.user.id }
      })
      if (settings?.phoneNumber) {
        results.sms = await notificationService.sendSms(
          settings.phoneNumber,
          'HomeFit: SMS is working!',
          settings.phoneCarrier // Use user's carrier
        )
      } else {
        results.sms = false
        results.smsError = 'No phone number configured'
      }
    }

    if (channel === 'push' || channel === 'all') {
      results.push = await notificationService.sendPush(
        req.user.id,
        'Test Notification',
        'Push notifications are working!',
        { url: '/settings/notifications' }
      )
      if (!results.push) {
        // Add diagnostic info
        const subscriptions = await prisma.pushSubscription.count({
          where: { userId: req.user.id }
        })
        results.pushDebug = {
          vapidConfigured: notificationService.isPushAvailable(),
          subscriptionCount: subscriptions,
          hint: subscriptions === 0
            ? 'No push subscriptions. Enable push in Settings > Notifications first.'
            : 'Subscriptions exist but push failed. Check server logs.'
        }
      }
    }

    res.json({ results })
  } catch (error) {
    next(error)
  }
})

// ===========================================
// Workout Reminder Routes
// ===========================================

// GET /api/notifications/reminder-personalities
// Get available reminder personalities
router.get('/reminder-personalities', async (req, res, next) => {
  try {
    res.json({ personalities: PERSONALITIES })
  } catch (error) {
    next(error)
  }
})

// GET /api/notifications/reminder-settings
// Get user's reminder settings
router.get('/reminder-settings', async (req, res, next) => {
  try {
    let settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id }
    })

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: req.user.id }
      })
    }

    res.json({
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
  } catch (error) {
    next(error)
  }
})

// PATCH /api/notifications/reminder-settings
// Update user's reminder settings
router.patch('/reminder-settings', async (req, res, next) => {
  try {
    const {
      reminderPersonality,
      reminderFrequency,
      reminderTime,
      reminderDaysInactive,
      enableFunnyReminders,
      enableStreakAlerts,
      enableAchievementTeases,
      enableSocialMotivation,
      workoutReminders
    } = req.body

    // Validate personality if provided
    if (reminderPersonality && !PERSONALITIES[reminderPersonality]) {
      return res.status(400).json({ message: 'Invalid personality type' })
    }

    // Validate frequency if provided
    if (reminderFrequency && !['daily', 'smart', 'off'].includes(reminderFrequency)) {
      return res.status(400).json({ message: 'Invalid frequency' })
    }

    // Validate time format if provided (HH:mm)
    if (reminderTime && !/^\d{2}:\d{2}$/.test(reminderTime)) {
      return res.status(400).json({ message: 'Invalid time format (use HH:mm)' })
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: {
        ...(reminderPersonality !== undefined && { reminderPersonality }),
        ...(reminderFrequency !== undefined && { reminderFrequency }),
        ...(reminderTime !== undefined && { reminderTime }),
        ...(reminderDaysInactive !== undefined && { reminderDaysInactive }),
        ...(enableFunnyReminders !== undefined && { enableFunnyReminders }),
        ...(enableStreakAlerts !== undefined && { enableStreakAlerts }),
        ...(enableAchievementTeases !== undefined && { enableAchievementTeases }),
        ...(enableSocialMotivation !== undefined && { enableSocialMotivation }),
        ...(workoutReminders !== undefined && { workoutReminders })
      },
      create: {
        userId: req.user.id,
        reminderPersonality: reminderPersonality ?? 'supportive',
        reminderFrequency: reminderFrequency ?? 'daily',
        reminderTime: reminderTime ?? '09:00',
        reminderDaysInactive: reminderDaysInactive ?? 1,
        enableFunnyReminders: enableFunnyReminders ?? true,
        enableStreakAlerts: enableStreakAlerts ?? true,
        enableAchievementTeases: enableAchievementTeases ?? true,
        enableSocialMotivation: enableSocialMotivation ?? true,
        workoutReminders: workoutReminders ?? true
      }
    })

    res.json({
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
  } catch (error) {
    next(error)
  }
})

// POST /api/notifications/test-reminder
// Send a test workout reminder
router.post('/test-reminder', async (req, res, next) => {
  try {
    const { forceTemplate = false } = req.body

    // Initialize the service if needed
    await workoutReminderService.initialize()

    // Send reminder (bypasses the shouldSendReminder check)
    const context = await workoutReminderService.getUserReminderContext(req.user.id)

    if (!context) {
      return res.status(400).json({ message: 'User settings not found' })
    }

    const { settings, daysInactive, userName, streak, trainingStyle } = context
    const personality = settings.reminderPersonality || 'supportive'

    let message = null
    let usedAI = false

    // Try AI message first if enabled and not forcing template
    if (settings.enableFunnyReminders && !forceTemplate) {
      message = await workoutReminderService.generateAIMessage(req.user.id, {
        personality,
        daysInactive: daysInactive || 1,
        userName,
        streak,
        trainingStyle
      })
      usedAI = !!message
    }

    // Fall back to template message
    if (!message) {
      const { getReminderMessage } = await import('../data/reminderMessages.js')
      message = getReminderMessage(personality, daysInactive || 1, userName)
    }

    const personalityInfo = PERSONALITIES[personality]
    const title = `${personalityInfo.emoji} ${personalityInfo.name} Says...`

    // Send via all enabled channels
    const result = await notificationService.notifyUser(req.user.id, {
      title,
      body: message,
      html: workoutReminderService.generateEmailHTML(title, message, personality),
      url: '/today'
    })

    res.json({
      success: true,
      message,
      title,
      personality,
      usedAI,
      channels: {
        email: result.email,
        sms: result.sms,
        push: result.push
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/notifications/reminder-history
// Get user's reminder history
router.get('/reminder-history', async (req, res, next) => {
  try {
    const { limit = 20, type } = req.query

    const where = { userId: req.user.id }
    if (type) {
      where.type = type
    }

    const reminders = await prisma.reminderLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: parseInt(limit)
    })

    res.json({ reminders })
  } catch (error) {
    next(error)
  }
})

// GET /api/notifications/settings
// Get user notification settings
router.get('/settings', async (req, res, next) => {
  try {
    let settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id }
    })

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: req.user.id }
      })
    }

    res.json({
      notifyByEmail: settings.notifyByEmail,
      notifyBySms: settings.notifyBySms,
      notifyByPush: settings.notifyByPush,
      phoneNumber: settings.phoneNumber,
      workoutReminders: settings.workoutReminders,
      socialNotifications: settings.socialNotifications
    })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/notifications/settings
// Update user notification settings
router.patch('/settings', async (req, res, next) => {
  try {
    const {
      notifyByEmail,
      notifyBySms,
      notifyByPush,
      phoneNumber,
      phoneCarrier,
      workoutReminders,
      socialNotifications
    } = req.body

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: {
        ...(notifyByEmail !== undefined && { notifyByEmail }),
        ...(notifyBySms !== undefined && { notifyBySms }),
        ...(notifyByPush !== undefined && { notifyByPush }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(phoneCarrier !== undefined && { phoneCarrier }),
        ...(workoutReminders !== undefined && { workoutReminders }),
        ...(socialNotifications !== undefined && { socialNotifications })
      },
      create: {
        userId: req.user.id,
        notifyByEmail: notifyByEmail ?? true,
        notifyBySms: notifyBySms ?? false,
        notifyByPush: notifyByPush ?? true,
        phoneNumber,
        phoneCarrier: phoneCarrier ?? 'vtext.com',
        workoutReminders: workoutReminders ?? true,
        socialNotifications: socialNotifications ?? true
      }
    })

    res.json({
      notifyByEmail: settings.notifyByEmail,
      notifyBySms: settings.notifyBySms,
      notifyByPush: settings.notifyByPush,
      phoneNumber: settings.phoneNumber,
      workoutReminders: settings.workoutReminders,
      socialNotifications: settings.socialNotifications
    })
  } catch (error) {
    next(error)
  }
})

// ===========================================
// In-App Notification Routes
// ===========================================

// GET /api/notifications - Fetch user's in-app notifications
router.get('/', async (req, res, next) => {
  try {
    const { limit = 20, cursor, unreadOnly = 'false' } = req.query

    const where = { userId: req.user.id }
    if (unreadOnly === 'true') {
      where.read = false
    }
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) }
    }

    const notifications = await prisma.inAppNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit) + 1 // Fetch one extra to check for more
    })

    const hasMore = notifications.length > parseInt(limit)
    if (hasMore) notifications.pop()

    const unreadCount = await prisma.inAppNotification.count({
      where: { userId: req.user.id, read: false }
    })

    res.json({
      notifications,
      hasMore,
      unreadCount,
      nextCursor: notifications.length > 0
        ? notifications[notifications.length - 1].createdAt.toISOString()
        : null
    })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await prisma.inAppNotification.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { read: true, readAt: new Date() }
    })
    res.json({ notification })
  } catch (error) {
    next(error)
  }
})

// POST /api/notifications/mark-all-read - Mark all as read
router.post('/mark-all-read', async (req, res, next) => {
  try {
    await prisma.inAppNotification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true, readAt: new Date() }
    })
    res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.inAppNotification.delete({
      where: { id: req.params.id, userId: req.user.id }
    })
    res.json({ message: 'Notification deleted' })
  } catch (error) {
    next(error)
  }
})

export default router
