import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import MARATHON_ROUTES from '../data/marathonRoutes.js'
import achievementService from '../services/achievements.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()
const prisma = new PrismaClient()

// Configure multer for award image uploads
const awardDir = path.join(__dirname, '../../uploads/awards')
if (!fs.existsSync(awardDir)) {
  fs.mkdirSync(awardDir, { recursive: true })
}
const awardStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, awardDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png'
    cb(null, `award-${req.params.id}-${Date.now()}${ext}`)
  }
})
const awardUpload = multer({
  storage: awardStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(png|jpg|jpeg|webp|gif)$/i
    if (allowed.test(path.extname(file.originalname))) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  }
})

// =============================================
// PUBLIC: Browse marathons
// =============================================

// GET /marathons - List all available marathons
router.get('/', async (req, res, next) => {
  try {
    const marathons = await prisma.marathon.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        city: true,
        country: true,
        distance: true,
        type: true,
        difficulty: true,
        isOfficial: true,
        isPassive: true,
        imageUrl: true,
        awardImageUrl: true,
        milestones: true,
        _count: { select: { userMarathons: true } }
      },
      orderBy: [{ isPassive: 'desc' }, { distance: 'asc' }]
    })

    // Get friend participant data
    let friendsMap = {}
    try {
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { userId: req.user.id, status: 'ACCEPTED' },
            { friendId: req.user.id, status: 'ACCEPTED' }
          ]
        },
        select: { userId: true, friendId: true }
      })

      const friendIds = friendships.map(f =>
        f.userId === req.user.id ? f.friendId : f.userId
      )

      if (friendIds.length > 0) {
        const friendMarathons = await prisma.userMarathon.findMany({
          where: {
            userId: { in: friendIds },
            status: 'active'
          },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } }
          }
        })

        for (const um of friendMarathons) {
          if (!friendsMap[um.marathonId]) friendsMap[um.marathonId] = []
          friendsMap[um.marathonId].push({
            id: um.user.id,
            name: um.user.name,
            avatarUrl: um.user.avatarUrl
          })
        }
      }
    } catch (e) {
      // Non-critical, proceed without friend data
    }

    const marathonsWithFriends = marathons.map(m => ({
      ...m,
      friendsInRace: friendsMap[m.id] || []
    }))

    res.json({ marathons: marathonsWithFriends })
  } catch (error) {
    next(error)
  }
})

// GET /marathons/:id/friends - Get friends' progress on a specific race
router.get('/:id/friends', async (req, res, next) => {
  try {
    // Get current user's friend IDs
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: req.user.id, status: 'ACCEPTED' },
          { friendId: req.user.id, status: 'ACCEPTED' }
        ]
      },
      select: { userId: true, friendId: true }
    })

    const friendIds = friendships.map(f =>
      f.userId === req.user.id ? f.friendId : f.userId
    )

    if (friendIds.length === 0) {
      return res.json({ friends: [] })
    }

    const friendMarathons = await prisma.userMarathon.findMany({
      where: {
        marathonId: req.params.id,
        userId: { in: friendIds },
        status: { in: ['active', 'completed'] }
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { currentDistance: 'desc' }
    })

    const friends = friendMarathons.map(um => ({
      userId: um.user.id,
      name: um.user.name,
      avatarUrl: um.user.avatarUrl,
      currentDistance: um.currentDistance,
      status: um.status,
      completedAt: um.completedAt
    }))

    res.json({ friends })
  } catch (error) {
    next(error)
  }
})

// GET /marathons/:id - Get marathon details with route data
router.get('/:id', async (req, res, next) => {
  try {
    const marathon = await prisma.marathon.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { userMarathons: true } }
      }
    })

    if (!marathon) {
      return res.status(404).json({ message: 'Marathon not found' })
    }

    res.json({ marathon })
  } catch (error) {
    next(error)
  }
})

// =============================================
// USER: My marathons & progress
// =============================================

// GET /marathons/my/active - Get user's marathons with progress
router.get('/my/active', async (req, res, next) => {
  try {
    const userMarathons = await prisma.userMarathon.findMany({
      where: { userId: req.user.id },
      include: {
        marathon: {
          select: {
            id: true,
            name: true,
            description: true,
            city: true,
            country: true,
            distance: true,
            type: true,
            difficulty: true,
            isPassive: true,
            milestones: true,
            routeData: true,
            imageUrl: true,
            awardImageUrl: true
          }
        },
        entries: {
          orderBy: { loggedAt: 'desc' },
          take: 10
        }
      },
      orderBy: [{ isPassive: 'desc' }, { status: 'asc' }, { updatedAt: 'desc' }]
    })

    res.json({ userMarathons })
  } catch (error) {
    next(error)
  }
})

// POST /marathons/:id/enroll - Enroll in a marathon
router.post('/:id/enroll', async (req, res, next) => {
  try {
    const marathon = await prisma.marathon.findUnique({
      where: { id: req.params.id }
    })

    if (!marathon) {
      return res.status(404).json({ message: 'Marathon not found' })
    }

    // Enforce 1 active race at a time (passive/Across America doesn't count)
    if (!marathon.isPassive) {
      const activeRace = await prisma.userMarathon.findFirst({
        where: {
          userId: req.user.id,
          status: 'active',
          isPassive: false
        },
        include: { marathon: true }
      })
      if (activeRace && activeRace.marathonId !== req.params.id) {
        return res.status(400).json({
          message: `You can only be enrolled in one race at a time. You're currently in "${activeRace.marathon.name}". Abandon it first to enroll in a new one.`
        })
      }
    }

    // Check if already enrolled
    const existing = await prisma.userMarathon.findUnique({
      where: {
        userId_marathonId: {
          userId: req.user.id,
          marathonId: req.params.id
        }
      }
    })

    if (existing) {
      if (existing.status === 'abandoned') {
        // Check 1-race limit before re-activating
        if (!marathon.isPassive) {
          const otherActive = await prisma.userMarathon.findFirst({
            where: {
              userId: req.user.id,
              status: 'active',
              isPassive: false,
              id: { not: existing.id }
            },
            include: { marathon: true }
          })
          if (otherActive) {
            return res.status(400).json({
              message: `You can only be enrolled in one race at a time. You're currently in "${otherActive.marathon.name}". Abandon it first.`
            })
          }
        }
        // Re-activate abandoned marathon (keep progress)
        const updated = await prisma.userMarathon.update({
          where: { id: existing.id },
          data: { status: 'active' },
          include: { marathon: true }
        })
        return res.json({ userMarathon: updated, message: 'Re-enrolled! Your previous progress is preserved.' })
      }
      return res.status(400).json({ message: 'Already enrolled in this marathon' })
    }

    const userMarathon = await prisma.userMarathon.create({
      data: {
        userId: req.user.id,
        marathonId: req.params.id,
        isPassive: marathon.isPassive
      },
      include: { marathon: true }
    })

    res.json({ userMarathon })
  } catch (error) {
    next(error)
  }
})

// DELETE /marathons/:id/abandon - Abandon a marathon
router.delete('/:id/abandon', async (req, res, next) => {
  try {
    const userMarathon = await prisma.userMarathon.findFirst({
      where: {
        userId: req.user.id,
        marathonId: req.params.id,
        status: 'active'
      },
      include: { marathon: true }
    })

    if (!userMarathon) {
      return res.status(404).json({ message: 'Not enrolled in this marathon' })
    }

    if (userMarathon.isPassive) {
      return res.status(400).json({ message: 'Cannot abandon passive challenges' })
    }

    await prisma.userMarathon.update({
      where: { id: userMarathon.id },
      data: { status: 'abandoned' }
    })

    res.json({ message: 'Marathon abandoned' })
  } catch (error) {
    next(error)
  }
})

// =============================================
// DISTANCE LOGGING
// =============================================

// POST /marathons/:userMarathonId/log - Log distance
router.post('/:userMarathonId/log', async (req, res, next) => {
  try {
    const { distance, duration, notes } = req.body

    if (!distance || distance <= 0) {
      return res.status(400).json({ message: 'Distance must be positive' })
    }

    const userMarathon = await prisma.userMarathon.findFirst({
      where: {
        id: req.params.userMarathonId,
        userId: req.user.id,
        status: 'active'
      },
      include: { marathon: true }
    })

    if (!userMarathon) {
      return res.status(404).json({ message: 'Active marathon not found' })
    }

    // Create entry and update progress
    const newDistance = userMarathon.currentDistance + distance
    const isComplete = newDistance >= userMarathon.marathon.distance

    const [entry, updated] = await prisma.$transaction([
      prisma.marathonEntry.create({
        data: {
          userMarathonId: userMarathon.id,
          distance,
          duration: duration || null,
          notes: notes || null
        }
      }),
      prisma.userMarathon.update({
        where: { id: userMarathon.id },
        data: {
          currentDistance: newDistance,
          totalSeconds: userMarathon.totalSeconds + (duration || 0),
          ...(isComplete && {
            status: 'completed',
            completedAt: new Date()
          })
        },
        include: { marathon: true }
      })
    ])

    // If completed, update user stats and check achievements
    let newAchievements = []
    if (isComplete && !userMarathon.isPassive) {
      try {
        await prisma.userStats.upsert({
          where: { userId: req.user.id },
          update: { totalMarathonsCompleted: { increment: 1 } },
          create: { userId: req.user.id, totalMarathonsCompleted: 1 }
        })

        // Check marathon achievements
        newAchievements = await achievementService.checkAchievements(req.user.id, {
          marathonCompleted: true
        })

        // Create completion notification
        await prisma.inAppNotification.create({
          data: {
            userId: req.user.id,
            type: 'ACHIEVEMENT',
            title: 'Marathon Complete!',
            message: `You finished the ${userMarathon.marathon.name}! 🏅`,
          }
        }).catch(() => {}) // Ignore if notification model doesn't match
      } catch (e) {
        console.error('Error updating marathon stats:', e)
      }
    }

    res.json({
      entry,
      userMarathon: updated,
      completed: isComplete,
      newAchievements
    })
  } catch (error) {
    next(error)
  }
})

// =============================================
// ADMIN: Marathon management
// =============================================

// POST /marathons/seed - Seed pre-built marathon routes
router.post('/seed', async (req, res, next) => {
  try {
    // Check admin role
    if (req.user.role?.toLowerCase() !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    let created = 0
    for (const route of MARATHON_ROUTES) {
      const existing = await prisma.marathon.findFirst({
        where: { name: route.name, isOfficial: true }
      })

      if (!existing) {
        await prisma.marathon.create({
          data: {
            name: route.name,
            description: route.description || null,
            city: route.city,
            country: route.country,
            distance: route.distance,
            type: route.type || 'run',
            difficulty: route.difficulty || 'intermediate',
            routeData: route.routeData,
            milestones: route.milestones || null,
            isOfficial: true,
            isPassive: route.isPassive || false,
            isActive: true
          }
        })
        created++
      }
    }

    // Auto-create passive marathon records for all existing users
    const passiveMarathons = await prisma.marathon.findMany({
      where: { isPassive: true, isActive: true }
    })

    let passiveCreated = 0
    for (const pm of passiveMarathons) {
      const users = await prisma.user.findMany({ select: { id: true } })
      for (const user of users) {
        const exists = await prisma.userMarathon.findUnique({
          where: { userId_marathonId: { userId: user.id, marathonId: pm.id } }
        })
        if (!exists) {
          await prisma.userMarathon.create({
            data: {
              userId: user.id,
              marathonId: pm.id,
              isPassive: true
            }
          })
          passiveCreated++
        }
      }
    }

    res.json({
      message: `Seeded ${created} marathons. Created ${passiveCreated} passive challenge enrollments.`
    })
  } catch (error) {
    next(error)
  }
})

// POST /marathons/admin/create - Admin creates a marathon
router.post('/admin/create', async (req, res, next) => {
  try {
    if (req.user.role?.toLowerCase() !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    const { name, description, city, country, distance, type, difficulty, routeData, milestones, segments } = req.body

    if (!name || !city || !country || !distance || !routeData) {
      return res.status(400).json({ message: 'Name, city, country, distance, and routeData are required' })
    }

    const marathon = await prisma.marathon.create({
      data: {
        name,
        description: description || null,
        city,
        country,
        distance: parseFloat(distance),
        type: type || 'run',
        difficulty: difficulty || 'intermediate',
        routeData,
        milestones: milestones || null,
        segments: segments || null,
        isOfficial: false,
        createdBy: req.user.id
      }
    })

    res.json({ marathon })
  } catch (error) {
    next(error)
  }
})

// PUT /marathons/admin/:id - Admin updates a marathon
router.put('/admin/:id', async (req, res, next) => {
  try {
    if (req.user.role?.toLowerCase() !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    const { name, description, city, country, distance, type, difficulty, routeData, milestones, segments, isActive } = req.body

    const marathon = await prisma.marathon.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(city !== undefined && { city }),
        ...(country !== undefined && { country }),
        ...(distance !== undefined && { distance: parseFloat(distance) }),
        ...(type !== undefined && { type }),
        ...(difficulty !== undefined && { difficulty }),
        ...(routeData !== undefined && { routeData }),
        ...(milestones !== undefined && { milestones }),
        ...(segments !== undefined && { segments }),
        ...(isActive !== undefined && { isActive })
      }
    })

    res.json({ marathon })
  } catch (error) {
    next(error)
  }
})

// POST /marathons/admin/:id/award - Upload award image for a marathon
router.post('/admin/:id/award', awardUpload.single('awardImage'), async (req, res, next) => {
  try {
    if (req.user.role?.toLowerCase() !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' })
    }

    // Delete old award image if exists
    const existing = await prisma.marathon.findUnique({ where: { id: req.params.id } })
    if (existing?.awardImageUrl) {
      const oldPath = path.join(__dirname, '../..', existing.awardImageUrl.replace('/uploads', 'uploads'))
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }

    const awardImageUrl = `/uploads/awards/${req.file.filename}`
    const marathon = await prisma.marathon.update({
      where: { id: req.params.id },
      data: { awardImageUrl }
    })
    res.json({ marathon })
  } catch (error) {
    next(error)
  }
})

// DELETE /marathons/admin/:id - Admin deletes a marathon
router.delete('/admin/:id', async (req, res, next) => {
  try {
    if (req.user.role?.toLowerCase() !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    await prisma.marathon.delete({
      where: { id: req.params.id }
    })

    res.json({ message: 'Marathon deleted' })
  } catch (error) {
    next(error)
  }
})

// GET /marathons/admin/all - Admin list all marathons (including inactive)
router.get('/admin/all', async (req, res, next) => {
  try {
    if (req.user.role?.toLowerCase() !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    const marathons = await prisma.marathon.findMany({
      include: {
        _count: { select: { userMarathons: true } }
      },
      orderBy: [{ isPassive: 'desc' }, { createdAt: 'desc' }]
    })

    res.json({ marathons })
  } catch (error) {
    next(error)
  }
})

// =============================================
// HELPER: Ensure passive marathon for user
// =============================================

export async function ensurePassiveMarathon(userId) {
  try {
    const passiveMarathons = await prisma.marathon.findMany({
      where: { isPassive: true, isActive: true }
    })

    for (const pm of passiveMarathons) {
      const exists = await prisma.userMarathon.findUnique({
        where: { userId_marathonId: { userId, marathonId: pm.id } }
      })
      if (!exists) {
        await prisma.userMarathon.create({
          data: { userId, marathonId: pm.id, isPassive: true }
        })
      }
    }
  } catch (e) {
    // Silently fail — passive marathon tables may not exist yet
  }
}

// Helper: Log distance to all active marathons for a user (called from workouts)
export async function autoLogCardioDistance(userId, distance, duration, sessionId) {
  try {
    if (!distance || distance <= 0) return

    // Get all active user marathons (passive + enrolled)
    const activeMarathons = await prisma.userMarathon.findMany({
      where: { userId, status: 'active' },
      include: { marathon: true }
    })

    for (const um of activeMarathons) {
      const newDistance = um.currentDistance + distance
      const isComplete = newDistance >= um.marathon.distance

      await prisma.$transaction([
        prisma.marathonEntry.create({
          data: {
            userMarathonId: um.id,
            distance,
            duration: duration || null,
            sessionId: sessionId || null
          }
        }),
        prisma.userMarathon.update({
          where: { id: um.id },
          data: {
            currentDistance: newDistance,
            totalSeconds: um.totalSeconds + (duration || 0),
            ...(isComplete && {
              status: 'completed',
              completedAt: new Date()
            })
          }
        })
      ])

      // Update stats and check achievements if non-passive marathon completed
      if (isComplete && !um.isPassive) {
        await prisma.userStats.upsert({
          where: { userId },
          update: { totalMarathonsCompleted: { increment: 1 } },
          create: { userId, totalMarathonsCompleted: 1 }
        }).catch(() => {})

        await achievementService.checkAchievements(userId, {
          marathonCompleted: true
        }).catch(() => {})
      }
    }
  } catch (e) {
    console.error('Error auto-logging marathon distance:', e)
  }
}

export default router
