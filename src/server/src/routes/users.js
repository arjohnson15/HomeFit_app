import express from 'express'
import prisma from '../lib/prisma.js'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Configure multer for avatar uploads
const uploadsDir = path.join(__dirname, '../../uploads/avatars')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${req.user.id}-${Date.now()}${ext}`)
  }
})

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'))
    }
  }
})

// GET /api/users/profile
router.get('/profile', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        settings: true,
        _count: {
          select: {
            workoutSessions: true,
            friendships: true
          }
        }
      }
    })

    res.json({ user })
  } catch (error) {
    next(error)
  }
})

// GET /api/users/stats
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user.id

    // Get workout stats
    const workoutCount = await prisma.workoutSession.count({
      where: { userId }
    })

    const totalDuration = await prisma.workoutSession.aggregate({
      where: { userId },
      _sum: { duration: true }
    })

    // Get all workouts for streak calculation
    const workouts = await prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true }
    })

    // Calculate streaks
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    let lastDate = null
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const workout of workouts) {
      const workoutDate = new Date(workout.date)
      workoutDate.setHours(0, 0, 0, 0)

      if (lastDate === null) {
        // Check if first workout is today or yesterday (for current streak)
        const daysSinceWorkout = Math.floor((today - workoutDate) / (1000 * 60 * 60 * 24))
        if (daysSinceWorkout <= 1) {
          tempStreak = 1
          lastDate = workoutDate
        } else {
          // First workout is too old, no current streak
          tempStreak = 1
          lastDate = workoutDate
        }
      } else {
        const dayDiff = Math.floor((lastDate - workoutDate) / (1000 * 60 * 60 * 24))
        if (dayDiff === 0) {
          // Same day, skip
          continue
        } else if (dayDiff === 1) {
          tempStreak++
          lastDate = workoutDate
        } else {
          // Gap in workouts
          if (currentStreak === 0) currentStreak = tempStreak
          longestStreak = Math.max(longestStreak, tempStreak)
          tempStreak = 1
          lastDate = workoutDate
        }
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak)
    if (currentStreak === 0) currentStreak = tempStreak

    // Count personal records
    const prCount = await prisma.set.count({
      where: {
        log: {
          session: { userId }
        },
        isPR: true
      }
    })

    // Get favorite exercise (most frequently logged)
    const exerciseLogs = await prisma.exerciseLog.groupBy({
      by: ['exerciseName'],
      where: {
        session: { userId }
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1
    })

    res.json({
      totalWorkouts: workoutCount,
      totalTime: totalDuration._sum.duration || 0,
      currentStreak,
      longestStreak,
      personalRecords: prCount,
      favoriteExercise: exerciseLogs[0]?.exerciseName || null
    })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/users/settings
router.patch('/settings', async (req, res, next) => {
  try {
    const settings = await prisma.userSettings.update({
      where: { userId: req.user.id },
      data: req.body
    })

    res.json({ settings })
  } catch (error) {
    next(error)
  }
})

// PUT /api/users/settings
router.put('/settings', async (req, res, next) => {
  try {
    const { trainingPreferences, availableEquipment } = req.body

    // Build update data
    const updateData = {}
    if (availableEquipment !== undefined) {
      updateData.availableEquipment = Array.isArray(availableEquipment) ? availableEquipment : []
    }

    // Upsert user settings
    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: updateData,
      create: { userId: req.user.id, ...updateData }
    })

    res.json({ success: true, settings })
  } catch (error) {
    next(error)
  }
})

// PUT /api/users/profile
// Update user profile (name, username, email)
router.put('/profile', async (req, res, next) => {
  try {
    const { name, username, email } = req.body

    // Check if username or email already taken by another user
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id: req.user.id }
        }
      })
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' })
      }
    }

    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: req.user.id }
        }
      })
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' })
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(username && { username }),
        ...(email && { email })
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        avatarUrl: true
      }
    })

    res.json({ user })
  } catch (error) {
    next(error)
  }
})

// POST /api/users/avatar
// Upload user avatar
router.post('/avatar', avatarUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    // Delete old avatar if exists
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatarUrl: true }
    })

    if (currentUser?.avatarUrl) {
      const oldPath = path.join(__dirname, '../..', currentUser.avatarUrl.replace('/uploads', 'uploads'))
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath)
      }
    }

    // Save new avatar URL
    const avatarUrl = `/uploads/avatars/${req.file.filename}`
    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl }
    })

    res.json({ avatarUrl })
  } catch (error) {
    next(error)
  }
})

// PUT /api/users/password
// Change user password (no current password required for logged-in users)
router.put('/password', async (req, res, next) => {
  try {
    const { newPassword } = req.body

    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    })

    res.json({ message: 'Password updated successfully' })
  } catch (error) {
    next(error)
  }
})

// GET /api/users/ai-settings
// Get AI-related settings (API key, Ollama config, and feature toggles)
router.get('/ai-settings', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { openaiApiKey: true }
    })

    // Get or create user settings
    let settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id }
    })

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: req.user.id }
      })
    }

    // Check if global AI is available (either OpenAI or Ollama)
    const appSettings = await prisma.appSettings.findUnique({
      where: { id: '1' }
    })

    const globalProvider = appSettings?.globalAiProvider || 'openai'
    let globalAvailable = false
    if (appSettings?.globalOpenaiEnabled) {
      if (globalProvider === 'openai' && appSettings?.globalOpenaiApiKey) {
        globalAvailable = true
      } else if (globalProvider === 'ollama' && appSettings?.globalOllamaEndpoint) {
        globalAvailable = true
      }
    }

    // Mask the API key for display (show last 4 chars only)
    let maskedKey = ''
    if (user?.openaiApiKey) {
      maskedKey = 'sk-...' + user.openaiApiKey.slice(-4)
    }

    res.json({
      // OpenAI settings
      apiKey: user?.openaiApiKey || '',
      maskedKey,
      model: settings.aiModel || 'gpt-4o-mini',

      // Provider selection
      provider: settings.aiProvider || 'openai',

      // Ollama settings
      ollamaEndpoint: settings.ollamaEndpoint || '',
      ollamaModel: settings.ollamaModel || '',
      ollamaApiKey: settings.ollamaApiKey || '',

      // Global AI availability
      globalAvailable,
      globalProvider: globalAvailable ? globalProvider : null,

      // Features
      features: {
        workoutSuggestions: settings.aiWorkoutSuggestions,
        formTips: settings.aiFormTips,
        nutritionAdvice: settings.aiNutritionAdvice,
        progressAnalysis: settings.aiProgressAnalysis
      },
      availableEquipment: settings.availableEquipment || [],
      gymType: settings.gymType || ''
    })
  } catch (error) {
    next(error)
  }
})

// PUT /api/users/ai-settings
// Save AI-related settings (API key, Ollama config, and feature toggles)
router.put('/ai-settings', async (req, res, next) => {
  try {
    const { apiKey, features, model, provider, ollamaEndpoint, ollamaModel, ollamaApiKey, availableEquipment, gymType } = req.body

    // Update API key on user if provided
    if (apiKey !== undefined) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { openaiApiKey: apiKey || null }
      })
    }

    // Update feature settings if provided
    const updateData = {}
    if (features) {
      updateData.aiWorkoutSuggestions = features.workoutSuggestions ?? true
      updateData.aiFormTips = features.formTips ?? true
      updateData.aiNutritionAdvice = features.nutritionAdvice ?? false
      updateData.aiProgressAnalysis = features.progressAnalysis ?? true
    }

    // OpenAI model
    if (model) {
      updateData.aiModel = model
    }

    // Provider selection (openai or ollama)
    if (provider) {
      updateData.aiProvider = provider
    }

    // Ollama settings
    if (ollamaEndpoint !== undefined) {
      updateData.ollamaEndpoint = ollamaEndpoint || null
    }
    if (ollamaModel !== undefined) {
      updateData.ollamaModel = ollamaModel || null
    }
    if (ollamaApiKey !== undefined) {
      updateData.ollamaApiKey = ollamaApiKey || null
    }

    // Update equipment settings
    if (availableEquipment !== undefined) {
      updateData.availableEquipment = Array.isArray(availableEquipment) ? availableEquipment : []
    }
    if (gymType !== undefined) {
      updateData.gymType = gymType || null
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.userSettings.upsert({
        where: { userId: req.user.id },
        update: updateData,
        create: {
          userId: req.user.id,
          ...updateData
        }
      })
    }

    res.json({ success: true, message: 'AI settings saved' })
  } catch (error) {
    next(error)
  }
})

// GET /api/users/achievements
// Get user achievements based on workout stats
router.get('/achievements', async (req, res, next) => {
  try {
    const userId = req.user.id

    // Get workout stats
    const workoutCount = await prisma.workoutSession.count({
      where: { userId }
    })

    // Calculate streaks
    const workouts = await prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true }
    })

    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    let lastDate = null

    for (const workout of workouts) {
      const workoutDate = new Date(workout.date).toDateString()
      if (lastDate === null) {
        tempStreak = 1
        lastDate = new Date(workout.date)
      } else {
        const dayDiff = Math.floor((lastDate - new Date(workout.date)) / (1000 * 60 * 60 * 24))
        if (dayDiff === 1) {
          tempStreak++
        } else if (dayDiff > 1) {
          if (currentStreak === 0) currentStreak = tempStreak
          longestStreak = Math.max(longestStreak, tempStreak)
          tempStreak = 1
        }
        lastDate = new Date(workout.date)
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak)
    if (currentStreak === 0) currentStreak = tempStreak

    // Generate achievements based on stats
    const achievements = [
      { id: 1, icon: '💪', name: 'First Workout', earned: workoutCount >= 1 },
      { id: 2, icon: '🔥', name: '7 Day Streak', earned: longestStreak >= 7 },
      { id: 3, icon: '💯', name: '10 Workouts', earned: workoutCount >= 10 },
      { id: 4, icon: '🏆', name: '30 Day Streak', earned: longestStreak >= 30 },
      { id: 5, icon: '⚡', name: '50 Workouts', earned: workoutCount >= 50 },
      { id: 6, icon: '🌟', name: '100 Workouts', earned: workoutCount >= 100 },
      { id: 7, icon: '👑', name: '365 Day Streak', earned: longestStreak >= 365 }
    ]

    res.json({ achievements })
  } catch (error) {
    next(error)
  }
})

// GET /api/users/:userId/profile - Get public profile for a friend
router.get('/:userId/profile', async (req, res, next) => {
  try {
    const { userId } = req.params
    const requesterId = req.user.id

    // Can always view own profile
    if (userId === requesterId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { settings: true, stats: true }
      })

      const achievements = await prisma.userAchievement.findMany({
        where: { userId, isUnlocked: true },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' },
        take: 10
      })

      return res.json({
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          avatarUrl: user.avatarUrl
        },
        stats: {
          totalWorkouts: user.stats?.totalWorkouts || 0,
          totalTime: user.stats?.totalWorkoutSeconds || 0,
          currentStreak: user.stats?.currentStreak || 0,
          longestStreak: user.stats?.longestStreak || 0,
          totalPRs: user.stats?.totalPRs || 0
        },
        achievements: achievements.map(ua => ({
          id: ua.achievement.id,
          name: ua.achievement.name,
          icon: ua.achievement.icon,
          rarity: ua.achievement.rarity,
          unlockedAt: ua.unlockedAt
        })),
        isSelf: true
      })
    }

    // Check if users are friends
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: requesterId, friendId: userId, status: 'ACCEPTED' },
          { userId: userId, friendId: requesterId, status: 'ACCEPTED' }
        ]
      }
    })

    if (!friendship) {
      return res.status(403).json({ message: 'Not friends with this user' })
    }

    // Get user and settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        settings: { select: { profileVisibility: true } },
        stats: true
      }
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Check privacy setting
    if (user.settings?.profileVisibility === 'PRIVATE') {
      return res.status(403).json({ message: 'This profile is private' })
    }

    // Get achievements
    const achievements = await prisma.userAchievement.findMany({
      where: { userId, isUnlocked: true },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
      take: 10
    })

    res.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl
      },
      stats: {
        totalWorkouts: user.stats?.totalWorkouts || 0,
        totalTime: user.stats?.totalWorkoutSeconds || 0,
        currentStreak: user.stats?.currentStreak || 0,
        longestStreak: user.stats?.longestStreak || 0,
        totalPRs: user.stats?.totalPRs || 0
      },
      achievements: achievements.map(ua => ({
        id: ua.achievement.id,
        name: ua.achievement.name,
        icon: ua.achievement.icon,
        rarity: ua.achievement.rarity,
        unlockedAt: ua.unlockedAt
      })),
      isSelf: false
    })
  } catch (error) {
    next(error)
  }
})

export default router
