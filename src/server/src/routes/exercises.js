import express from 'express'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import prisma from '../lib/prisma.js'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configure multer for exercise image uploads
const exerciseUploadsDir = path.join(__dirname, '../../uploads/exercises')
if (!fsSync.existsSync(exerciseUploadsDir)) {
  fsSync.mkdirSync(exerciseUploadsDir, { recursive: true })
}

const exerciseImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, exerciseUploadsDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `exercise-${req.user.id}-${Date.now()}${ext}`)
  }
})

const exerciseImageUpload = multer({
  storage: exerciseImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'))
    }
  }
})

// Cache for JSON exercises data only (custom exercises need user-specific filtering)
let exercisesCache = null

// Load exercises from JSON file
const loadJsonExercises = async () => {
  if (exercisesCache) return exercisesCache

  try {
    // Try production path first, then development path
    let exercisesPath = path.join(__dirname, '../../data/exercises.json')

    try {
      await fs.access(exercisesPath)
    } catch {
      // Fallback to exercises-db in development
      exercisesPath = path.join(__dirname, '../../../../exercises-db/dist/exercises.json')
    }

    const data = await fs.readFile(exercisesPath, 'utf-8')
    exercisesCache = JSON.parse(data)
    return exercisesCache
  } catch (error) {
    console.error('Error loading exercises:', error)
    return []
  }
}

// Load custom exercises from database with visibility filtering
const loadCustomExercises = async (userId = null) => {
  try {
    // Build where clause based on visibility
    // Users can see:
    // 1. System exercises (userId is null)
    // 2. Their own exercises (any visibility)
    // 3. PUBLIC exercises from other users
    // 4. FRIENDS exercises from their accepted friends
    let whereClause = { isActive: true }

    if (userId) {
      // Get user's friend IDs for FRIENDS visibility
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { userId: userId, status: 'ACCEPTED' },
            { friendId: userId, status: 'ACCEPTED' }
          ]
        },
        select: { userId: true, friendId: true }
      })
      const friendIds = friendships.map(f =>
        f.userId === userId ? f.friendId : f.userId
      )

      whereClause = {
        isActive: true,
        OR: [
          { userId: null }, // System/admin exercises
          { userId: userId }, // User's own exercises
          { visibility: 'PUBLIC' }, // Public community exercises
          { visibility: 'FRIENDS', userId: { in: friendIds } } // Friends' shared exercises
        ]
      }
    } else {
      // Not logged in: only show system exercises and public exercises
      whereClause = {
        isActive: true,
        OR: [
          { userId: null },
          { visibility: 'PUBLIC' }
        ]
      }
    }

    const customExercises = await prisma.customExercise.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transform to match JSON exercise format
    return customExercises.map(ex => ({
      id: `custom-${ex.id}`,
      name: ex.name,
      primaryMuscles: ex.primaryMuscles,
      secondaryMuscles: ex.secondaryMuscles,
      equipment: ex.equipment,
      category: ex.category,
      force: ex.force,
      level: ex.level,
      mechanic: ex.mechanic,
      instructions: ex.instructions,
      images: ex.images,
      isCustom: true,
      isUserCreated: !!ex.userId,
      visibility: ex.visibility,
      creatorId: ex.userId,
      creatorName: ex.user?.name || ex.user?.username || null,
      isOwnExercise: ex.userId === userId
    }))
  } catch (error) {
    console.error('Error loading custom exercises:', error)
    return []
  }
}

// Load all exercises (JSON + custom)
const loadExercises = async (userId = null) => {
  const [jsonExercises, customExercises] = await Promise.all([
    loadJsonExercises(),
    loadCustomExercises(userId)
  ])

  // Custom exercises appear first
  return [...customExercises, ...jsonExercises]
}

// GET /api/exercises
router.get('/', async (req, res, next) => {
  try {
    const {
      search,
      muscle,
      equipment,
      level,
      category,
      source, // 'official', 'custom', 'community', 'all'
      limit = 50,
      offset = 0
    } = req.query

    let exercises = await loadExercises(req.user?.id)

    // Apply source filter
    if (source && source !== 'all') {
      if (source === 'official') {
        exercises = exercises.filter(e => !e.isCustom)
      } else if (source === 'custom') {
        exercises = exercises.filter(e => e.isOwnExercise)
      } else if (source === 'community') {
        exercises = exercises.filter(e => e.isCustom && !e.isOwnExercise)
      }
    }

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase()

      // Load user's nicknames if authenticated
      let nicknameMap = new Map()
      if (req.user?.id) {
        try {
          const userNicknames = await prisma.exerciseNote.findMany({
            where: {
              userId: req.user.id,
              nickname: { not: null }
            },
            select: {
              exerciseId: true,
              nickname: true
            }
          })
          nicknameMap = new Map(userNicknames.map(n => [n.exerciseId, n.nickname.toLowerCase()]))
        } catch (err) {
          // If nickname lookup fails, continue with name-only search
          console.error('Error loading nicknames for search:', err)
        }
      }

      // Search by both name AND nickname
      exercises = exercises.filter(e => {
        const nameMatch = e.name.toLowerCase().includes(searchLower)
        const nickname = nicknameMap.get(e.id)
        const nicknameMatch = nickname && nickname.includes(searchLower)
        return nameMatch || nicknameMatch
      })
    }

    if (muscle) {
      const muscleLower = muscle.toLowerCase()
      // Map category names to actual muscle names in database
      const muscleMapping = {
        'back': ['lats', 'lower back', 'middle back', 'traps'],
        'arms': ['biceps', 'triceps', 'forearms'],
        'legs': ['quadriceps', 'hamstrings', 'calves', 'glutes'],
        'core': ['abdominals', 'lower back']
      }
      const musclesToMatch = muscleMapping[muscleLower] || [muscleLower]

      exercises = exercises.filter(e =>
        e.primaryMuscles?.some(m => musclesToMatch.includes(m.toLowerCase())) ||
        e.secondaryMuscles?.some(m => musclesToMatch.includes(m.toLowerCase()))
      )
    }

    if (equipment) {
      // Support comma-separated list of equipment types
      const equipmentList = equipment.toLowerCase().split(',').map(e => e.trim())
      exercises = exercises.filter(e => {
        const exerciseEquipment = e.equipment?.toLowerCase()
        // Always include "body only" exercises when filtering by equipment
        if (exerciseEquipment === 'body only') return true
        // Check primary equipment
        if (equipmentList.includes(exerciseEquipment)) return true
        // Check secondary equipment (e.g., barbell for bench press exercises)
        if (e.secondaryEquipment) {
          const secondaryList = Array.isArray(e.secondaryEquipment)
            ? e.secondaryEquipment
            : [e.secondaryEquipment]
          return secondaryList.some(se => equipmentList.includes(se.toLowerCase()))
        }
        return false
      })
    }

    if (level) {
      exercises = exercises.filter(e =>
        e.level?.toLowerCase() === level.toLowerCase()
      )
    }

    if (category) {
      exercises = exercises.filter(e =>
        e.category?.toLowerCase() === category.toLowerCase()
      )
    }

    // Paginate
    const total = exercises.length
    exercises = exercises.slice(parseInt(offset), parseInt(offset) + parseInt(limit))

    res.json({
      exercises,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/exercises/filters/options - Must be before /:id to avoid route conflict
router.get('/filters/options', async (req, res, next) => {
  try {
    const exercises = await loadExercises(req.user?.id)

    // Extract unique values for filters
    const muscles = new Set()
    const equipment = new Set()
    const levels = new Set()
    const categories = new Set()

    exercises.forEach(e => {
      e.primaryMuscles?.forEach(m => muscles.add(m))
      if (e.equipment) equipment.add(e.equipment)
      if (e.level) levels.add(e.level)
      if (e.category) categories.add(e.category)
    })

    res.json({
      muscles: Array.from(muscles).sort(),
      equipment: Array.from(equipment).sort(),
      levels: Array.from(levels),
      categories: Array.from(categories).sort()
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/exercises/:id
router.get('/:id', async (req, res, next) => {
  try {
    const exercises = await loadExercises(req.user?.id)
    const exercise = exercises.find(e => e.id === req.params.id)

    if (!exercise) {
      return res.status(404).json({ message: 'Exercise not found' })
    }

    res.json({ exercise })
  } catch (error) {
    next(error)
  }
})

// GET /api/exercises/favorites - Get user's favorite exercises
router.get('/favorites', async (req, res, next) => {
  try {
    const favorites = await prisma.exerciseNote.findMany({
      where: {
        userId: req.user.id,
        isFavorite: true
      },
      select: {
        exerciseId: true,
        nickname: true,
        notes: true
      }
    })

    if (favorites.length === 0) {
      return res.json({ exercises: [] })
    }

    // Load full exercise data
    const allExercises = await loadExercises(req.user.id)
    const favoriteIds = new Set(favorites.map(f => f.exerciseId))
    const prefsMap = new Map(favorites.map(f => [f.exerciseId, f]))

    const favoriteExercises = allExercises
      .filter(ex => favoriteIds.has(ex.id))
      .map(ex => ({
        ...ex,
        displayName: prefsMap.get(ex.id)?.nickname || ex.name,
        nickname: prefsMap.get(ex.id)?.nickname || null,
        isFavorite: true,
        hasNotes: !!prefsMap.get(ex.id)?.notes
      }))

    res.json({ exercises: favoriteExercises })
  } catch (error) {
    next(error)
  }
})

// POST /api/exercises/preferences/batch - Get preferences for multiple exercises
router.post('/preferences/batch', async (req, res, next) => {
  try {
    const { ids } = req.body

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: 'ids array required' })
    }

    const preferences = await prisma.exerciseNote.findMany({
      where: {
        userId: req.user.id,
        exerciseId: { in: ids }
      },
      select: {
        exerciseId: true,
        nickname: true,
        isFavorite: true
      }
    })

    res.json({ preferences })
  } catch (error) {
    next(error)
  }
})

// GET /api/exercises/:id/notes - Get user's preferences for an exercise
router.get('/:id/notes', async (req, res, next) => {
  try {
    const pref = await prisma.exerciseNote.findUnique({
      where: {
        userId_exerciseId: {
          userId: req.user.id,
          exerciseId: req.params.id
        }
      }
    })

    res.json({
      notes: pref?.notes || '',
      nickname: pref?.nickname || null,
      isFavorite: pref?.isFavorite || false
    })
  } catch (error) {
    next(error)
  }
})

// PUT /api/exercises/:id/notes - Save user's notes for an exercise
router.put('/:id/notes', async (req, res, next) => {
  try {
    const { notes } = req.body

    const note = await prisma.exerciseNote.upsert({
      where: {
        userId_exerciseId: {
          userId: req.user.id,
          exerciseId: req.params.id
        }
      },
      update: { notes },
      create: {
        userId: req.user.id,
        exerciseId: req.params.id,
        notes
      }
    })

    res.json({ notes: note.notes })
  } catch (error) {
    next(error)
  }
})

// PUT /api/exercises/:id/nickname - Set user's nickname for an exercise
router.put('/:id/nickname', async (req, res, next) => {
  try {
    const { nickname } = req.body
    const cleanNickname = nickname?.trim() || null

    const updated = await prisma.exerciseNote.upsert({
      where: {
        userId_exerciseId: {
          userId: req.user.id,
          exerciseId: req.params.id
        }
      },
      update: { nickname: cleanNickname },
      create: {
        userId: req.user.id,
        exerciseId: req.params.id,
        nickname: cleanNickname
      }
    })

    res.json({ nickname: updated.nickname })
  } catch (error) {
    next(error)
  }
})

// PUT /api/exercises/:id/favorite - Toggle favorite status for an exercise
router.put('/:id/favorite', async (req, res, next) => {
  try {
    const { isFavorite } = req.body

    const updated = await prisma.exerciseNote.upsert({
      where: {
        userId_exerciseId: {
          userId: req.user.id,
          exerciseId: req.params.id
        }
      },
      update: { isFavorite: !!isFavorite },
      create: {
        userId: req.user.id,
        exerciseId: req.params.id,
        isFavorite: !!isFavorite
      }
    })

    res.json({ isFavorite: updated.isFavorite })
  } catch (error) {
    next(error)
  }
})

// PUT /api/exercises/:id - Update exercise (Admin only)
router.put('/:id', async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    const exerciseId = req.params.id
    const updates = req.body

    // Load the exercises JSON file
    let exercisesPath = path.join(__dirname, '../../data/exercises.json')
    try {
      await fs.access(exercisesPath)
    } catch {
      exercisesPath = path.join(__dirname, '../../../../exercises-db/dist/exercises.json')
    }

    const data = await fs.readFile(exercisesPath, 'utf-8')
    const exercises = JSON.parse(data)

    // Find and update the exercise
    const exerciseIndex = exercises.findIndex(e => e.id === exerciseId)
    if (exerciseIndex === -1) {
      return res.status(404).json({ message: 'Exercise not found' })
    }

    // Update the exercise
    exercises[exerciseIndex] = {
      ...exercises[exerciseIndex],
      ...updates,
      id: exerciseId // Ensure ID doesn't change
    }

    // Save back to file
    await fs.writeFile(exercisesPath, JSON.stringify(exercises, null, 2))

    // Clear cache so next request gets updated data
    exercisesCache = null

    res.json({ exercise: exercises[exerciseIndex] })
  } catch (error) {
    next(error)
  }
})

// ============================================
// Custom Exercise Routes (User-created exercises)
// ============================================

// GET /api/exercises/custom/mine - Get user's own custom exercises
router.get('/custom/mine', async (req, res, next) => {
  try {
    const exercises = await prisma.customExercise.findMany({
      where: {
        userId: req.user.id,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({
      exercises: exercises.map(ex => ({
        id: `custom-${ex.id}`,
        dbId: ex.id,
        name: ex.name,
        primaryMuscles: ex.primaryMuscles,
        secondaryMuscles: ex.secondaryMuscles,
        equipment: ex.equipment,
        category: ex.category,
        force: ex.force,
        level: ex.level,
        mechanic: ex.mechanic,
        instructions: ex.instructions,
        images: ex.images,
        visibility: ex.visibility,
        isCustom: true,
        isOwnExercise: true,
        createdAt: ex.createdAt
      }))
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/exercises/custom - Create a new custom exercise
router.post('/custom', exerciseImageUpload.array('images', 4), async (req, res, next) => {
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
      visibility = 'PRIVATE'
    } = req.body

    if (!name || !primaryMuscles) {
      return res.status(400).json({ message: 'Name and primaryMuscles are required' })
    }

    // Parse arrays from form data
    const parsePrimaryMuscles = typeof primaryMuscles === 'string'
      ? JSON.parse(primaryMuscles)
      : primaryMuscles
    const parseSecondaryMuscles = secondaryMuscles
      ? (typeof secondaryMuscles === 'string' ? JSON.parse(secondaryMuscles) : secondaryMuscles)
      : []
    const parseInstructions = instructions
      ? (typeof instructions === 'string' ? JSON.parse(instructions) : instructions)
      : []

    // Get image URLs from uploaded files
    const imageUrls = req.files?.map(file => `/uploads/exercises/${file.filename}`) || []

    const exercise = await prisma.customExercise.create({
      data: {
        name: name.trim(),
        primaryMuscles: parsePrimaryMuscles,
        secondaryMuscles: parseSecondaryMuscles,
        equipment: equipment || null,
        category: category || null,
        force: force || null,
        level: level || null,
        mechanic: mechanic || null,
        instructions: parseInstructions,
        images: imageUrls,
        userId: req.user.id,
        visibility: visibility,
        isActive: true
      }
    })

    res.status(201).json({
      exercise: {
        id: `custom-${exercise.id}`,
        dbId: exercise.id,
        name: exercise.name,
        primaryMuscles: exercise.primaryMuscles,
        secondaryMuscles: exercise.secondaryMuscles,
        equipment: exercise.equipment,
        category: exercise.category,
        force: exercise.force,
        level: exercise.level,
        mechanic: exercise.mechanic,
        instructions: exercise.instructions,
        images: exercise.images,
        visibility: exercise.visibility,
        isCustom: true,
        isOwnExercise: true
      }
    })
  } catch (error) {
    next(error)
  }
})

// PUT /api/exercises/custom/:id - Update a custom exercise
router.put('/custom/:id', exerciseImageUpload.array('images', 4), async (req, res, next) => {
  try {
    const exerciseId = req.params.id

    // Find the exercise and verify ownership
    const existing = await prisma.customExercise.findUnique({
      where: { id: exerciseId }
    })

    if (!existing) {
      return res.status(404).json({ message: 'Exercise not found' })
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only edit your own exercises' })
    }

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
      visibility,
      existingImages
    } = req.body

    // Parse arrays from form data
    const parsePrimaryMuscles = primaryMuscles
      ? (typeof primaryMuscles === 'string' ? JSON.parse(primaryMuscles) : primaryMuscles)
      : undefined
    const parseSecondaryMuscles = secondaryMuscles
      ? (typeof secondaryMuscles === 'string' ? JSON.parse(secondaryMuscles) : secondaryMuscles)
      : undefined
    const parseInstructions = instructions
      ? (typeof instructions === 'string' ? JSON.parse(instructions) : instructions)
      : undefined
    const parseExistingImages = existingImages
      ? (typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages)
      : []

    // Combine existing images with new uploads
    const newImageUrls = req.files?.map(file => `/uploads/exercises/${file.filename}`) || []
    const allImages = [...parseExistingImages, ...newImageUrls]

    const updateData = {}
    if (name !== undefined) updateData.name = name.trim()
    if (parsePrimaryMuscles !== undefined) updateData.primaryMuscles = parsePrimaryMuscles
    if (parseSecondaryMuscles !== undefined) updateData.secondaryMuscles = parseSecondaryMuscles
    if (equipment !== undefined) updateData.equipment = equipment || null
    if (category !== undefined) updateData.category = category || null
    if (force !== undefined) updateData.force = force || null
    if (level !== undefined) updateData.level = level || null
    if (mechanic !== undefined) updateData.mechanic = mechanic || null
    if (parseInstructions !== undefined) updateData.instructions = parseInstructions
    if (visibility !== undefined) updateData.visibility = visibility
    if (existingImages !== undefined || req.files?.length) updateData.images = allImages

    const exercise = await prisma.customExercise.update({
      where: { id: exerciseId },
      data: updateData
    })

    res.json({
      exercise: {
        id: `custom-${exercise.id}`,
        dbId: exercise.id,
        name: exercise.name,
        primaryMuscles: exercise.primaryMuscles,
        secondaryMuscles: exercise.secondaryMuscles,
        equipment: exercise.equipment,
        category: exercise.category,
        force: exercise.force,
        level: exercise.level,
        mechanic: exercise.mechanic,
        instructions: exercise.instructions,
        images: exercise.images,
        visibility: exercise.visibility,
        isCustom: true,
        isOwnExercise: true
      }
    })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/exercises/custom/:id - Delete a custom exercise
router.delete('/custom/:id', async (req, res, next) => {
  try {
    const exerciseId = req.params.id

    // Find the exercise and verify ownership
    const existing = await prisma.customExercise.findUnique({
      where: { id: exerciseId }
    })

    if (!existing) {
      return res.status(404).json({ message: 'Exercise not found' })
    }

    if (existing.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'You can only delete your own exercises' })
    }

    // Soft delete by setting isActive to false
    await prisma.customExercise.update({
      where: { id: exerciseId },
      data: { isActive: false }
    })

    // Optionally, delete the image files
    if (existing.images?.length) {
      for (const imagePath of existing.images) {
        try {
          const fullPath = path.join(__dirname, '../../', imagePath)
          await fs.unlink(fullPath)
        } catch (err) {
          console.error('Error deleting exercise image:', err)
        }
      }
    }

    res.json({ message: 'Exercise deleted successfully' })
  } catch (error) {
    next(error)
  }
})

// GET /api/exercises/custom/:id - Get a specific custom exercise
router.get('/custom/:id', async (req, res, next) => {
  try {
    const exerciseId = req.params.id

    const exercise = await prisma.customExercise.findUnique({
      where: { id: exerciseId },
      include: {
        user: {
          select: { id: true, name: true, username: true }
        }
      }
    })

    if (!exercise || !exercise.isActive) {
      return res.status(404).json({ message: 'Exercise not found' })
    }

    // Check visibility permissions
    const isOwner = exercise.userId === req.user?.id
    const isPublic = exercise.visibility === 'PUBLIC'
    const isSystem = !exercise.userId

    if (!isOwner && !isPublic && !isSystem) {
      // Check if FRIENDS visibility and user is a friend
      if (exercise.visibility === 'FRIENDS') {
        const friendship = await prisma.friendship.findFirst({
          where: {
            status: 'ACCEPTED',
            OR: [
              { userId: exercise.userId, friendId: req.user?.id },
              { userId: req.user?.id, friendId: exercise.userId }
            ]
          }
        })
        if (!friendship) {
          return res.status(403).json({ message: 'You do not have permission to view this exercise' })
        }
      } else {
        return res.status(403).json({ message: 'You do not have permission to view this exercise' })
      }
    }

    res.json({
      exercise: {
        id: `custom-${exercise.id}`,
        dbId: exercise.id,
        name: exercise.name,
        primaryMuscles: exercise.primaryMuscles,
        secondaryMuscles: exercise.secondaryMuscles,
        equipment: exercise.equipment,
        category: exercise.category,
        force: exercise.force,
        level: exercise.level,
        mechanic: exercise.mechanic,
        instructions: exercise.instructions,
        images: exercise.images,
        visibility: exercise.visibility,
        isCustom: true,
        isOwnExercise: isOwner,
        creatorId: exercise.userId,
        creatorName: exercise.user?.name || exercise.user?.username || null
      }
    })
  } catch (error) {
    next(error)
  }
})

export default router
