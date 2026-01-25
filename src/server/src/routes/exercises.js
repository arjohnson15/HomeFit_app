import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma.js'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cache for exercises data
let exercisesCache = null
let customExercisesCache = null
let customExercisesCacheTime = 0
const CUSTOM_CACHE_TTL = 60000 // 1 minute

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

// Load custom exercises from database
const loadCustomExercises = async () => {
  const now = Date.now()
  if (customExercisesCache && (now - customExercisesCacheTime) < CUSTOM_CACHE_TTL) {
    return customExercisesCache
  }

  try {
    const customExercises = await prisma.customExercise.findMany({
      where: { isActive: true }
    })

    // Transform to match JSON exercise format
    customExercisesCache = customExercises.map(ex => ({
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
      isCustom: true
    }))
    customExercisesCacheTime = now
    return customExercisesCache
  } catch (error) {
    console.error('Error loading custom exercises:', error)
    return []
  }
}

// Load all exercises (JSON + custom)
const loadExercises = async () => {
  const [jsonExercises, customExercises] = await Promise.all([
    loadJsonExercises(),
    loadCustomExercises()
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
      limit = 50,
      offset = 0
    } = req.query

    let exercises = await loadExercises()

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
    const exercises = await loadExercises()

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
    const exercises = await loadExercises()
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
    const allExercises = await loadExercises()
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

export default router
