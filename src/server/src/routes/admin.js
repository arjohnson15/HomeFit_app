import express from 'express'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import notificationService, { SMS_GATEWAYS } from '../services/notifications.js'
import achievementService from '../services/achievements.js'
import updateService from '../services/updates.js'
import webpush from 'web-push'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configure multer for exercise image uploads
const exerciseImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/exercises')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'exercise-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const uploadExerciseImage = multer({
  storage: exerciseImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    if (extname && mimetype) {
      return cb(null, true)
    }
    cb(new Error('Only image files are allowed'))
  }
})

const router = express.Router()

// All admin routes require admin role
router.use(requireAdmin)

// GET /api/admin/users - List all users
router.get('/users', async (req, res, next) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query

    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } }
      ]
    } : {}

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: { workoutSessions: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    })

    const total = await prisma.user.count({ where })

    res.json({ users, total })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/admin/users/:id - Update user
router.patch('/users/:id', async (req, res, next) => {
  try {
    const { role, name, email } = req.body

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(role && { role }),
        ...(name && { name }),
        ...(email && { email })
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true
      }
    })

    res.json({ user })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    const { newPassword } = req.body

    // Validate password
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'Password is required' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' })
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      parseInt(process.env.BCRYPT_ROUNDS) || 12
    )

    await prisma.user.update({
      where: { id: req.params.id },
      data: { password: hashedPassword }
    })

    res.json({ message: 'Password reset successfully' })
  } catch (error) {
    next(error)
  }
})

// PUT /api/admin/users/:id/role - Update user role
router.put('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body

    // Accept both lowercase and uppercase, normalize to uppercase for Prisma enum
    const normalizedRole = role?.toUpperCase()
    if (!['USER', 'ADMIN'].includes(normalizedRole)) {
      return res.status(400).json({ message: 'Invalid role' })
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: normalizedRole },
      select: { id: true, role: true }
    })

    res.json({ user })
  } catch (error) {
    next(error)
  }
})

// PUT /api/admin/users/:id/status - Update user active status
router.put('/users/:id/status', async (req, res, next) => {
  try {
    const { active } = req.body

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { active },
      select: { id: true, active: true }
    })

    res.json({ user })
  } catch (error) {
    next(error)
  }
})

// PUT /api/admin/users/:id/email - Update user email
router.put('/users/:id/email', async (req, res, next) => {
  try {
    const { email } = req.body

    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Valid email required' })
    }

    // Check if email already in use
    const existing = await prisma.user.findFirst({
      where: {
        email,
        NOT: { id: req.params.id }
      }
    })

    if (existing) {
      return res.status(400).json({ message: 'Email already in use' })
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { email },
      select: { id: true, email: true }
    })

    res.json({ user })
  } catch (error) {
    next(error)
  }
})

// PUT /api/admin/users/:id/password - Reset user password
router.put('/users/:id/password', async (req, res, next) => {
  try {
    const { password } = req.body

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: req.params.id },
      data: { password: hashedPassword }
    })

    res.json({ message: 'Password reset successfully' })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/admin/users/:id/avatar - Remove user avatar
router.delete('/users/:id/avatar', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { avatarUrl: true }
    })

    // Delete the file if it exists
    if (user?.avatarUrl) {
      const fs = await import('fs')
      const path = await import('path')
      const { fileURLToPath } = await import('url')
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = path.dirname(__filename)

      const avatarPath = path.join(__dirname, '../..', user.avatarUrl.replace('/uploads', 'uploads'))
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath)
      }
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: { avatarUrl: null }
    })

    res.json({ message: 'Avatar removed successfully' })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res, next) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete yourself' })
    }

    // Check if target user is an admin
    const targetUser = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: true, email: true }
    })

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    // If deleting an admin, ensure at least one admin remains
    if (targetUser.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' }
      })

      if (adminCount <= 1) {
        return res.status(400).json({
          message: 'Cannot delete the last admin. Promote another user to admin first.'
        })
      }
    }

    await prisma.user.delete({
      where: { id: req.params.id }
    })

    res.json({ message: 'User deleted' })
  } catch (error) {
    next(error)
  }
})

// GET /api/admin/settings - Get app settings
router.get('/settings', async (req, res, next) => {
  try {
    let settings = await prisma.appSettings.findFirst()

    if (!settings) {
      // Create default settings
      settings = await prisma.appSettings.create({
        data: {
          appName: 'HomeFit',
          primaryColor: '#0a84ff',
          accentColor: '#30d158'
        }
      })
    }

    res.json({ settings })
  } catch (error) {
    next(error)
  }
})

// GET /api/admin/sms-gateways - Get available SMS gateways
router.get('/sms-gateways', async (req, res) => {
  res.json({ gateways: SMS_GATEWAYS })
})

// PATCH /api/admin/settings
router.patch('/settings', async (req, res, next) => {
  try {
    const {
      appName,
      primaryColor,
      accentColor,
      logoUrl,
      fullLogoUrl,
      faviconUrl,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFrom,
      smsEnabled,
      smsGateway,
      smsSenderName,
      globalOpenaiApiKey,
      globalOpenaiEnabled,
      globalAiProvider,
      globalOllamaEndpoint,
      globalOllamaModel,
      globalOllamaApiKey,
      fatSecretClientId,
      fatSecretClientSecret,
      fatSecretTier,
      feedbackEmailEnabled,
      feedbackEmail,
      feedbackPushEnabled
    } = req.body

    // Check if we need to generate VAPID keys
    // Generate when: SMTP is being configured AND no VAPID keys exist
    let vapidData = {}
    if (smtpFrom || smtpHost) {
      const currentSettings = await prisma.appSettings.findFirst()
      if (!currentSettings?.vapidPublicKey) {
        // Generate new VAPID keys
        const vapidKeys = webpush.generateVAPIDKeys()
        vapidData = {
          vapidPublicKey: vapidKeys.publicKey,
          vapidPrivateKey: vapidKeys.privateKey,
          vapidEmail: smtpFrom || currentSettings?.smtpFrom
        }
        console.log('Auto-generated VAPID keys for web push notifications')
      } else if (smtpFrom) {
        // Update VAPID email if smtpFrom changes
        vapidData.vapidEmail = smtpFrom
      }
    }

    const settings = await prisma.appSettings.upsert({
      where: { id: '1' },
      update: {
        ...(appName && { appName }),
        ...(primaryColor && { primaryColor }),
        ...(accentColor && { accentColor }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(fullLogoUrl !== undefined && { fullLogoUrl }),
        ...(faviconUrl !== undefined && { faviconUrl }),
        ...(smtpHost !== undefined && { smtpHost }),
        ...(smtpPort !== undefined && { smtpPort }),
        ...(smtpUser !== undefined && { smtpUser }),
        ...(smtpPass !== undefined && { smtpPass }),
        ...(smtpFrom !== undefined && { smtpFrom }),
        ...(smsEnabled !== undefined && { smsEnabled }),
        ...(smsGateway !== undefined && { smsGateway }),
        ...(smsSenderName !== undefined && { smsSenderName }),
        ...(globalOpenaiApiKey !== undefined && { globalOpenaiApiKey }),
        ...(globalOpenaiEnabled !== undefined && { globalOpenaiEnabled }),
        ...(globalAiProvider !== undefined && { globalAiProvider }),
        ...(globalOllamaEndpoint !== undefined && { globalOllamaEndpoint }),
        ...(globalOllamaModel !== undefined && { globalOllamaModel }),
        ...(globalOllamaApiKey !== undefined && { globalOllamaApiKey }),
        ...(fatSecretClientId !== undefined && { fatSecretClientId }),
        ...(fatSecretClientSecret !== undefined && { fatSecretClientSecret }),
        ...(fatSecretTier !== undefined && { fatSecretTier }),
        ...(feedbackEmailEnabled !== undefined && { feedbackEmailEnabled }),
        ...(feedbackEmail !== undefined && { feedbackEmail }),
        ...(feedbackPushEnabled !== undefined && { feedbackPushEnabled }),
        ...vapidData
      },
      create: {
        appName: appName || 'HomeFit',
        primaryColor: primaryColor || '#0a84ff',
        accentColor: accentColor || '#30d158',
        ...(globalOpenaiApiKey !== undefined && { globalOpenaiApiKey }),
        ...(globalOpenaiEnabled !== undefined && { globalOpenaiEnabled }),
        ...(globalAiProvider !== undefined && { globalAiProvider }),
        ...(globalOllamaEndpoint !== undefined && { globalOllamaEndpoint }),
        ...(globalOllamaModel !== undefined && { globalOllamaModel }),
        ...(globalOllamaApiKey !== undefined && { globalOllamaApiKey }),
        ...vapidData
      }
    })

    // Reload notification service settings
    await notificationService.loadSettings()

    res.json({ settings })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/notifications/test
// Send a test notification to admin
router.post('/notifications/test', async (req, res, next) => {
  try {
    const { channel } = req.body

    await notificationService.loadSettings()

    const results = {}

    if (channel === 'email') {
      const admin = await prisma.user.findUnique({ where: { id: req.user.id } })
      results.email = await notificationService.sendEmail(
        admin.email,
        'HomeFit Admin Test',
        '<h1>Email Test Successful!</h1><p>Your SMTP configuration is working correctly.</p>'
      )
    }

    if (channel === 'push') {
      results.push = await notificationService.sendPush(
        req.user.id,
        'Admin Test',
        'Push notifications are working!',
        { url: '/settings/appearance' }
      )
    }

    res.json({
      success: Object.values(results).some(r => r),
      results
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/notifications/test-push-user
// Send a test push notification to a specific user
router.post('/notifications/test-push-user', async (req, res, next) => {
  try {
    const { userId, title, body } = req.body

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }

    await notificationService.loadSettings()

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    })
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    // Check subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, userAgent: true, createdAt: true, updatedAt: true }
    })

    if (subscriptions.length === 0) {
      return res.json({
        success: false,
        message: `${user.name} (${user.email}) has no push subscriptions registered`,
        user: { name: user.name, email: user.email },
        subscriptionCount: 0
      })
    }

    const result = await notificationService.sendPush(
      userId,
      title || 'HomeFit Debug Test',
      body || `Test push notification for ${user.name}`,
      { url: '/today' }
    )

    res.json({
      success: result,
      message: result
        ? `Push notification sent to ${user.name} (${subscriptions.length} subscription${subscriptions.length > 1 ? 's' : ''})`
        : `Failed to send push to ${user.name}. Subscriptions may be expired.`,
      user: { name: user.name, email: user.email },
      subscriptionCount: subscriptions.length,
      subscriptions: subscriptions.map(s => ({
        id: s.id,
        endpoint: s.endpoint.substring(0, 80) + '...',
        userAgent: s.userAgent,
        created: s.createdAt,
        updated: s.updatedAt
      }))
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/notifications/test-sms
// Send a test SMS to a specific phone number
router.post('/notifications/test-sms', async (req, res, next) => {
  try {
    const { phoneNumber, gateway } = req.body

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required' })
    }

    await notificationService.loadSettings()

    // Check if SMS is properly configured
    if (!notificationService.isSmsAvailable()) {
      return res.status(400).json({
        success: false,
        message: 'SMS is not configured. Please set up SMTP and enable SMS first.'
      })
    }

    // Get app name for the test message
    const settings = await prisma.appSettings.findFirst()
    const appName = settings?.appName || 'HomeFit'

    // Send test SMS - keep message short, no emojis (can cause encoding issues)
    const success = await notificationService.sendSms(
      phoneNumber,
      `${appName}: SMS is working!`
    )

    res.json({
      success,
      message: success
        ? 'Test SMS sent successfully!'
        : 'Failed to send SMS. Check your SMTP configuration.'
    })
  } catch (error) {
    console.error('Test SMS error:', error)
    next(error)
  }
})

// GET /api/admin/updates - Check for updates
router.get('/updates', async (req, res, next) => {
  try {
    const updateInfo = await updateService.checkForUpdates()
    res.json(updateInfo)
  } catch (error) {
    next(error)
  }
})

// GET /api/admin/updates/history - Get version history
router.get('/updates/history', async (req, res, next) => {
  try {
    const history = await updateService.getVersionHistory()
    res.json({ releases: history })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/updates/check - Force check for updates (clears cache)
router.post('/updates/check', async (req, res, next) => {
  try {
    updateService.clearCache()
    const updateInfo = await updateService.checkForUpdates()
    res.json(updateInfo)
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/updates/apply - Apply update (via updater service)
router.post('/updates/apply', async (req, res, next) => {
  try {
    // Check if update is available first
    const updateInfo = await updateService.checkForUpdates()

    if (!updateInfo.updateAvailable) {
      return res.status(400).json({
        success: false,
        message: 'No update available'
      })
    }

    // Call the updater service to apply the update
    const updaterUrl = process.env.UPDATER_URL || 'http://updater:9999'
    const updateSecret = process.env.UPDATE_SECRET || 'homefit-update-secret'

    try {
      const response = await fetch(`${updaterUrl}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: updateSecret })
      })

      const result = await response.json()

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: result.error || 'Failed to start update',
          updateInfo: {
            currentVersion: updateInfo.currentVersion,
            newVersion: updateInfo.latestVersion
          }
        })
      }

      res.json({
        success: true,
        message: 'Update started! The application will restart automatically.',
        status: result.status,
        updateInfo: {
          currentVersion: updateInfo.currentVersion,
          newVersion: updateInfo.latestVersion,
          releaseNotes: updateInfo.releaseNotes,
          releaseUrl: updateInfo.releaseUrl
        }
      })
    } catch (fetchError) {
      // Updater service not available - provide manual instructions
      console.error('[Admin] Updater service unavailable:', fetchError.message)
      res.json({
        success: false,
        message: 'Automatic update unavailable. Please update manually.',
        instructions: [
          'Run these commands on your server:',
          'cd /srv/config/HomeFit_app/production',
          'git pull origin main',
          'docker-compose up -d --build'
        ],
        updateInfo: {
          currentVersion: updateInfo.currentVersion,
          newVersion: updateInfo.latestVersion,
          releaseNotes: updateInfo.releaseNotes,
          releaseUrl: updateInfo.releaseUrl
        }
      })
    }
  } catch (error) {
    next(error)
  }
})

// GET /api/admin/updates/status - Get update progress status
router.get('/updates/status', async (req, res, next) => {
  try {
    const updaterUrl = process.env.UPDATER_URL || 'http://updater:9999'

    const response = await fetch(`${updaterUrl}/status`)
    const status = await response.json()

    res.json(status)
  } catch (error) {
    res.json({
      inProgress: false,
      lastUpdate: null,
      lastResult: null,
      error: 'Updater service unavailable'
    })
  }
})

// ===========================================
// Achievement Management
// ===========================================

// GET /api/admin/achievements - List all achievements
router.get('/achievements', async (req, res, next) => {
  try {
    const achievements = await prisma.achievement.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      include: {
        _count: {
          select: {
            userAchievements: {
              where: { isUnlocked: true }
            }
          }
        }
      }
    })

    // Get total user count for percentage calculation
    const totalUsers = await prisma.user.count()

    const achievementsWithStats = achievements.map(a => ({
      ...a,
      unlockedCount: a._count.userAchievements,
      unlockedPercent: totalUsers > 0
        ? Math.round((a._count.userAchievements / totalUsers) * 100)
        : 0
    }))

    res.json({ achievements: achievementsWithStats, totalUsers })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/achievements - Create achievement
router.post('/achievements', async (req, res, next) => {
  try {
    const {
      name,
      description,
      icon,
      category,
      metricType,
      threshold,
      rarity,
      points,
      sortOrder
    } = req.body

    if (!name || !description || !category || !metricType) {
      return res.status(400).json({
        message: 'Name, description, category, and metricType are required'
      })
    }

    const achievement = await prisma.achievement.create({
      data: {
        name,
        description,
        icon: icon || '🏆',
        category,
        metricType,
        threshold: threshold || 1,
        rarity: rarity || 'COMMON',
        points: points || 10,
        sortOrder: sortOrder || 0,
        isDefault: false
      }
    })

    res.status(201).json({ achievement })
  } catch (error) {
    next(error)
  }
})

// PUT /api/admin/achievements/:id - Update achievement
router.put('/achievements/:id', async (req, res, next) => {
  try {
    const {
      name,
      description,
      icon,
      category,
      metricType,
      threshold,
      rarity,
      points,
      sortOrder,
      isActive
    } = req.body

    const achievement = await prisma.achievement.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(category !== undefined && { category }),
        ...(metricType !== undefined && { metricType }),
        ...(threshold !== undefined && { threshold }),
        ...(rarity !== undefined && { rarity }),
        ...(points !== undefined && { points }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive })
      }
    })

    res.json({ achievement })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/admin/achievements/:id - Delete achievement
router.delete('/achievements/:id', async (req, res, next) => {
  try {
    // Check if it's a default achievement
    const achievement = await prisma.achievement.findUnique({
      where: { id: req.params.id }
    })

    if (!achievement) {
      return res.status(404).json({ message: 'Achievement not found' })
    }

    if (achievement.isDefault) {
      return res.status(400).json({
        message: 'Cannot delete default achievements. Disable instead.'
      })
    }

    // Delete user achievements first, then the achievement
    await prisma.userAchievement.deleteMany({
      where: { achievementId: req.params.id }
    })

    await prisma.achievement.delete({
      where: { id: req.params.id }
    })

    res.json({ message: 'Achievement deleted' })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/achievements/seed - Seed default achievements
router.post('/achievements/seed', async (req, res, next) => {
  try {
    const count = await achievementService.seedDefaultAchievements()
    res.json({
      message: count > 0
        ? `Seeded ${count} new achievements`
        : 'All default achievements already exist'
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/admin/achievements/stats - Get achievement statistics
router.get('/achievements/stats', async (req, res, next) => {
  try {
    const totalAchievements = await prisma.achievement.count()
    const activeAchievements = await prisma.achievement.count({
      where: { isActive: true }
    })
    const totalUnlocks = await prisma.userAchievement.count({
      where: { isUnlocked: true }
    })

    // Get most/least unlocked achievements
    const unlockCounts = await prisma.userAchievement.groupBy({
      by: ['achievementId'],
      where: { isUnlocked: true },
      _count: true,
      orderBy: { _count: { achievementId: 'desc' } },
      take: 5
    })

    const mostUnlockedIds = unlockCounts.map(u => u.achievementId)
    const mostUnlocked = await prisma.achievement.findMany({
      where: { id: { in: mostUnlockedIds } }
    })

    res.json({
      totalAchievements,
      activeAchievements,
      totalUnlocks,
      mostUnlocked: mostUnlocked.map(a => ({
        ...a,
        unlockCount: unlockCounts.find(u => u.achievementId === a.id)?._count || 0
      }))
    })
  } catch (error) {
    next(error)
  }
})

// ===========================================
// Feedback Management
// ===========================================

// GET /api/admin/feedback - List all feedback
router.get('/feedback', async (req, res, next) => {
  try {
    const { type, status } = req.query

    const where = {}
    if (type && type !== 'all') where.type = type
    if (status && status !== 'all') where.status = status

    const feedback = await prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        // We don't have a relation, so we'll fetch user separately
      }
    })

    // Fetch user names for each feedback
    const userIds = [...new Set(feedback.map(f => f.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, username: true }
    })
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))

    const feedbackWithUsers = feedback.map(f => ({
      ...f,
      userName: userMap[f.userId]?.name || userMap[f.userId]?.username || 'Unknown'
    }))

    res.json(feedbackWithUsers)
  } catch (error) {
    next(error)
  }
})

// PATCH /api/admin/feedback/:id - Update feedback status/notes
router.patch('/feedback/:id', async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body

    const updateData = {}
    if (status !== undefined) {
      updateData.status = status
      if (status === 'RESOLVED') {
        updateData.resolvedAt = new Date()
      }
    }
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes

    const feedback = await prisma.feedback.update({
      where: { id: req.params.id },
      data: updateData
    })

    res.json(feedback)
  } catch (error) {
    next(error)
  }
})

// DELETE /api/admin/feedback/:id - Delete feedback
router.delete('/feedback/:id', async (req, res, next) => {
  try {
    await prisma.feedback.delete({
      where: { id: req.params.id }
    })

    res.json({ message: 'Feedback deleted' })
  } catch (error) {
    next(error)
  }
})

// ===========================================
// Custom Exercise Management
// ===========================================

// GET /api/admin/exercises - List all custom exercises
router.get('/exercises', async (req, res, next) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query

    const where = search ? {
      name: { contains: search, mode: 'insensitive' }
    } : {}

    const exercises = await prisma.customExercise.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    })

    const total = await prisma.customExercise.count({ where })

    res.json({ exercises, total })
  } catch (error) {
    next(error)
  }
})

// GET /api/admin/exercises/:id - Get single custom exercise
router.get('/exercises/:id', async (req, res, next) => {
  try {
    const exercise = await prisma.customExercise.findUnique({
      where: { id: req.params.id }
    })

    if (!exercise) {
      return res.status(404).json({ message: 'Exercise not found' })
    }

    res.json({ exercise })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/exercises - Create custom exercise
router.post('/exercises', async (req, res, next) => {
  try {
    const {
      name,
      primaryMuscles,
      secondaryMuscles,
      equipment,
      category,
      force,
      level,
      mechanic,
      instructions,
      images
    } = req.body

    if (!name) {
      return res.status(400).json({ message: 'Name is required' })
    }

    if (!primaryMuscles || primaryMuscles.length === 0) {
      return res.status(400).json({ message: 'At least one primary muscle is required' })
    }

    const exercise = await prisma.customExercise.create({
      data: {
        name,
        primaryMuscles: primaryMuscles || [],
        secondaryMuscles: secondaryMuscles || [],
        equipment: equipment || null,
        category: category || null,
        force: force || null,
        level: level || null,
        mechanic: mechanic || null,
        instructions: instructions || [],
        images: images || [],
        createdById: req.user.id,
        isActive: true
      }
    })

    res.status(201).json({ exercise })
  } catch (error) {
    next(error)
  }
})

// PUT /api/admin/exercises/:id - Update custom exercise
router.put('/exercises/:id', async (req, res, next) => {
  try {
    const {
      name,
      primaryMuscles,
      secondaryMuscles,
      equipment,
      category,
      force,
      level,
      mechanic,
      instructions,
      images,
      isActive
    } = req.body

    const exercise = await prisma.customExercise.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(primaryMuscles !== undefined && { primaryMuscles }),
        ...(secondaryMuscles !== undefined && { secondaryMuscles }),
        ...(equipment !== undefined && { equipment }),
        ...(category !== undefined && { category }),
        ...(force !== undefined && { force }),
        ...(level !== undefined && { level }),
        ...(mechanic !== undefined && { mechanic }),
        ...(instructions !== undefined && { instructions }),
        ...(images !== undefined && { images }),
        ...(isActive !== undefined && { isActive })
      }
    })

    res.json({ exercise })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/exercises/:id/image - Upload image for exercise
router.post('/exercises/:id/image', uploadExerciseImage.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' })
    }

    const exercise = await prisma.customExercise.findUnique({
      where: { id: req.params.id }
    })

    if (!exercise) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ message: 'Exercise not found' })
    }

    // Create URL path for the uploaded image
    const imageUrl = `/uploads/exercises/${req.file.filename}`

    // Add image to exercise's images array
    const updatedExercise = await prisma.customExercise.update({
      where: { id: req.params.id },
      data: {
        images: [...exercise.images, imageUrl]
      }
    })

    res.json({
      exercise: updatedExercise,
      imageUrl
    })
  } catch (error) {
    // Clean up file on error
    if (req.file) {
      try { fs.unlinkSync(req.file.path) } catch (e) { /* ignore */ }
    }
    next(error)
  }
})

// DELETE /api/admin/exercises/:id/image - Remove image from exercise
router.delete('/exercises/:id/image', async (req, res, next) => {
  try {
    const { imageUrl } = req.body

    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' })
    }

    const exercise = await prisma.customExercise.findUnique({
      where: { id: req.params.id }
    })

    if (!exercise) {
      return res.status(404).json({ message: 'Exercise not found' })
    }

    // Remove image from array
    const updatedImages = exercise.images.filter(img => img !== imageUrl)

    // If it's a local file, delete it
    if (imageUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../..', imageUrl)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    const updatedExercise = await prisma.customExercise.update({
      where: { id: req.params.id },
      data: { images: updatedImages }
    })

    res.json({ exercise: updatedExercise })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/admin/exercises/:id - Delete custom exercise
router.delete('/exercises/:id', async (req, res, next) => {
  try {
    const exercise = await prisma.customExercise.findUnique({
      where: { id: req.params.id }
    })

    if (!exercise) {
      return res.status(404).json({ message: 'Exercise not found' })
    }

    // Delete any uploaded images
    for (const imageUrl of exercise.images) {
      if (imageUrl.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '../..', imageUrl)
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath) } catch (e) { /* ignore */ }
        }
      }
    }

    await prisma.customExercise.delete({
      where: { id: req.params.id }
    })

    res.json({ message: 'Exercise deleted' })
  } catch (error) {
    next(error)
  }
})

export default router
