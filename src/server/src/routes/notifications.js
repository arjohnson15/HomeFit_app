import express from 'express'
import prisma from '../lib/prisma.js'
import { authenticateToken } from '../middleware/auth.js'
import notificationService from '../services/notifications.js'

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
    }

    res.json({ results })
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
