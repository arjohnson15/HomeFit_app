import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cache for exercises data
let exercisesCache = null

// Load exercises from JSON file
const loadExercises = async () => {
  if (exercisesCache) return exercisesCache

  try {
    // Try production path first, then development path
    let exercisesPath = path.join(__dirname, '../../../data/exercises.json')

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
      exercises = exercises.filter(e =>
        e.name.toLowerCase().includes(searchLower)
      )
    }

    if (muscle) {
      const muscleLower = muscle.toLowerCase()
      exercises = exercises.filter(e =>
        e.primaryMuscles?.some(m => m.toLowerCase() === muscleLower) ||
        e.secondaryMuscles?.some(m => m.toLowerCase() === muscleLower)
      )
    }

    if (equipment) {
      const equipmentLower = equipment.toLowerCase()
      exercises = exercises.filter(e =>
        e.equipment?.toLowerCase() === equipmentLower
      )
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

// GET /api/exercises/filters/options
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

// GET /api/exercises/:id/notes - Get user's notes for an exercise
router.get('/:id/notes', async (req, res, next) => {
  try {
    const note = await prisma.exerciseNote.findUnique({
      where: {
        userId_exerciseId: {
          userId: req.user.id,
          exerciseId: req.params.id
        }
      }
    })

    res.json({ notes: note?.notes || '' })
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
    let exercisesPath = path.join(__dirname, '../../../data/exercises.json')
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
