import express from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import notificationService, { SMS_GATEWAYS } from '../services/notifications.js'
import achievementService from '../services/achievements.js'
import updateService from '../services/updates.js'
import webpush from 'web-push'

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

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' })
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
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

// POST /api/admin/updates/apply - Apply update (Docker-based)
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

    // In Docker environment, updates are applied by:
    // 1. Pulling the latest image
    // 2. Recreating the container
    // This must be done from outside the container (host machine)

    // We can't actually restart ourselves from inside Docker
    // Instead, return instructions for the admin
    res.json({
      success: true,
      message: 'Update available',
      instructions: [
        'To apply the update, run these commands on your server:',
        'cd /path/to/production',
        'git pull origin main',
        'docker-compose down',
        'docker-compose up -d --build',
        'docker-compose exec app npx prisma db push'
      ],
      updateInfo: {
        currentVersion: updateInfo.currentVersion,
        newVersion: updateInfo.latestVersion,
        releaseNotes: updateInfo.releaseNotes,
        releaseUrl: updateInfo.releaseUrl
      }
    })
  } catch (error) {
    next(error)
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

export default router
