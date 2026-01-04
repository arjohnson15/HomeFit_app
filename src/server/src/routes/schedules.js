import express from 'express'
import prisma from '../lib/prisma.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import OpenAI from 'openai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Helper to get user's AI configuration
async function getUserAIConfig(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { openaiApiKey: true }
  })

  const appSettings = await prisma.appSettings.findUnique({
    where: { id: '1' }
  })

  let apiKey = null

  if (user?.openaiApiKey) {
    apiKey = user.openaiApiKey
  } else if (appSettings?.globalOpenaiEnabled && appSettings?.globalOpenaiApiKey) {
    apiKey = appSettings.globalOpenaiApiKey
  }

  return { apiKey }
}

// Generate AI warmup suggestions
async function generateAIWarmups(apiKey, muscleGroups, exerciseNames) {
  try {
    const openai = new OpenAI({ apiKey })

    const prompt = `Generate 5 warmup exercises for someone about to work out these muscle groups: ${muscleGroups.join(', ')}.
Their exercises today include: ${exerciseNames.join(', ')}.

Return ONLY a JSON array with exactly 5 warmup exercises. Each exercise should have:
- name: exercise name
- duration: time in seconds (for timed exercises) OR null
- sets: number of sets (if applicable) OR null
- reps: number of reps per set (if applicable) OR null
- description: brief 5-10 word instruction on how to do it

Example format:
[{"name": "Arm Circles", "duration": 30, "sets": null, "reps": null, "description": "Large circles forward then backward"}]

Focus on dynamic stretches and activation exercises, not cardio. Return ONLY the JSON array, no other text.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    })

    const content = response.choices[0].message.content.trim()
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return null
  } catch (error) {
    console.error('AI warmup generation error:', error.message)
    return null
  }
}

// Generate AI cooldown suggestions
async function generateAICooldowns(apiKey, muscleGroups, exerciseNames) {
  try {
    const openai = new OpenAI({ apiKey })

    const prompt = `Generate 5 cooldown stretches for someone who just worked out these muscle groups: ${muscleGroups.join(', ')}.
Their exercises were: ${exerciseNames.join(', ')}.

Return ONLY a JSON array with exactly 5 cooldown stretches. Each should have:
- name: stretch name
- duration: hold time in seconds
- sides: number of sides if applicable (2 for left/right stretches) OR null
- description: brief 5-10 word instruction on how to do it

Example format:
[{"name": "Chest Doorway Stretch", "duration": 30, "sides": 2, "description": "Lean into doorway with arm at 90 degrees"}]

Focus on static stretches for recovery. Return ONLY the JSON array, no other text.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    })

    const content = response.choices[0].message.content.trim()
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return null
  } catch (error) {
    console.error('AI cooldown generation error:', error.message)
    return null
  }
}

// Load warmup/cooldown mappings
let warmupCooldownMappings = null
const loadMappings = () => {
  if (!warmupCooldownMappings) {
    // Production Docker uses /app/server-data/, dev uses relative path
    const prodPath = '/app/server-data/warmup-cooldown-mappings.json'
    const devPath = path.join(__dirname, '../../data/warmup-cooldown-mappings.json')
    const mappingsPath = fs.existsSync(prodPath) ? prodPath : devPath
    warmupCooldownMappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'))
  }
  return warmupCooldownMappings
}

// Simple in-memory cache for warmup/cooldown suggestions
// Key format: `${type}-${userId}-${date}-${workoutHash}`
const suggestionCache = new Map()

// Clean up old cache entries (entries from previous days)
const cleanupCache = () => {
  const today = new Date().toISOString().split('T')[0]
  for (const [key, value] of suggestionCache.entries()) {
    if (!key.includes(today)) {
      suggestionCache.delete(key)
    }
  }
}

// Generate a simple hash from workout IDs to detect changes
const getWorkoutHash = (workoutIds) => {
  if (!workoutIds || workoutIds.length === 0) return 'none'
  return workoutIds.sort().join('-')
}

// Get cached suggestions or null if not cached/expired
const getCachedSuggestions = (type, userId, workoutHash) => {
  const today = new Date().toISOString().split('T')[0]
  const cacheKey = `${type}-${userId}-${today}-${workoutHash}`
  return suggestionCache.get(cacheKey) || null
}

// Store suggestions in cache
const setCachedSuggestions = (type, userId, workoutHash, data) => {
  const today = new Date().toISOString().split('T')[0]
  const cacheKey = `${type}-${userId}-${today}-${workoutHash}`
  suggestionCache.set(cacheKey, data)
  // Cleanup old entries periodically
  if (suggestionCache.size > 100) {
    cleanupCache()
  }
}

// GET /api/schedules/weekly - Get weekly schedule
router.get('/weekly', async (req, res, next) => {
  try {
    const schedules = await prisma.weeklySchedule.findMany({
      where: { userId: req.user.id },
      include: {
        exercises: true
      },
      orderBy: { dayOfWeek: 'asc' }
    })

    res.json({ schedules })
  } catch (error) {
    next(error)
  }
})

// PUT /api/schedules/weekly/:day - Set schedule for a day
router.put('/weekly/:day', async (req, res, next) => {
  try {
    const dayOfWeek = parseInt(req.params.day)
    const { name, exercises } = req.body

    // Upsert the schedule
    const schedule = await prisma.weeklySchedule.upsert({
      where: {
        userId_dayOfWeek: {
          userId: req.user.id,
          dayOfWeek
        }
      },
      update: {
        name,
        exercises: {
          deleteMany: {},
          create: exercises.map((e, i) => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            sets: e.sets,
            reps: e.reps,
            order: i
          }))
        }
      },
      create: {
        userId: req.user.id,
        dayOfWeek,
        name,
        exercises: {
          create: exercises.map((e, i) => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            sets: e.sets,
            reps: e.reps,
            order: i
          }))
        }
      },
      include: {
        exercises: true
      }
    })

    res.json({ schedule })
  } catch (error) {
    next(error)
  }
})

// GET /api/schedules/calendar - Get calendar events
router.get('/calendar', async (req, res, next) => {
  try {
    // Support both start/end and startDate/endDate for backwards compatibility
    const startDate = req.query.start || req.query.startDate
    const endDate = req.query.end || req.query.endDate

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' })
    }

    const events = await prisma.calendarWorkout.findMany({
      where: {
        userId: req.user.id,
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        exercises: true
      },
      orderBy: { date: 'asc' }
    })

    res.json({ events })
  } catch (error) {
    next(error)
  }
})

// POST /api/schedules/calendar - Create calendar event
router.post('/calendar', async (req, res, next) => {
  try {
    const { date, name, exercises } = req.body

    const event = await prisma.calendarWorkout.create({
      data: {
        userId: req.user.id,
        date: new Date(date),
        name,
        exercises: {
          create: exercises.map((e, i) => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            sets: e.sets,
            reps: e.reps,
            order: i
          }))
        }
      },
      include: {
        exercises: true
      }
    })

    res.status(201).json({ event })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/schedules/calendar/:id
router.delete('/calendar/:id', async (req, res, next) => {
  try {
    await prisma.calendarWorkout.delete({
      where: { id: req.params.id }
    })

    res.json({ message: 'Event deleted' })
  } catch (error) {
    next(error)
  }
})

// GET /api/schedules/today - Get today's workout
router.get('/today', async (req, res, next) => {
  try {
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday

    // Check for calendar override first
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))

    const calendarWorkout = await prisma.calendarWorkout.findFirst({
      where: {
        userId: req.user.id,
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        exercises: true
      }
    })

    // Get weekly schedule (needed for rest day check even if calendar override exists)
    const weeklySchedule = await prisma.weeklySchedule.findFirst({
      where: {
        userId: req.user.id,
        dayOfWeek
      },
      include: {
        exercises: true
      }
    })

    const isRestDay = weeklySchedule?.isRestDay || false

    // Get recurring workouts for today
    const allRecurring = await prisma.recurringWorkout.findMany({
      where: {
        userId: req.user.id,
        isActive: true
      },
      include: {
        exercises: {
          orderBy: { order: 'asc' }
        }
      }
    })

    // Filter recurring workouts that apply today
    const todayRecurring = allRecurring.filter(rw => {
      // Skip if it's a rest day and this workout skips rest days
      if (isRestDay && rw.skipRestDays) {
        return false
      }

      switch (rw.type) {
        case 'DAILY':
          return true

        case 'SPECIFIC_DAYS':
          return rw.daysOfWeek.includes(dayOfWeek)

        case 'EVERY_X_DAYS':
          if (!rw.intervalDays) return false
          const startDate = new Date(rw.startDate)
          const diffTime = Math.abs(today - startDate)
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
          return diffDays % rw.intervalDays === 0

        default:
          return false
      }
    })

    if (calendarWorkout) {
      return res.json({
        workout: calendarWorkout,
        source: 'calendar',
        isRestDay,
        recurringWorkouts: todayRecurring
      })
    }

    res.json({
      workout: weeklySchedule,
      source: weeklySchedule ? 'weekly' : 'none',
      isRestDay,
      recurringWorkouts: todayRecurring
    })
  } catch (error) {
    next(error)
  }
})

// ===========================================
// Recurring Workouts
// ===========================================

// GET /api/schedules/recurring - Get all recurring workouts
router.get('/recurring', async (req, res, next) => {
  try {
    const recurringWorkouts = await prisma.recurringWorkout.findMany({
      where: { userId: req.user.id },
      include: {
        exercises: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ recurringWorkouts })
  } catch (error) {
    next(error)
  }
})

// POST /api/schedules/recurring - Create recurring workout
router.post('/recurring', async (req, res, next) => {
  try {
    const { name, type, intervalDays, daysOfWeek, skipRestDays, exercises } = req.body

    const recurringWorkout = await prisma.recurringWorkout.create({
      data: {
        userId: req.user.id,
        name,
        type: type || 'SPECIFIC_DAYS',
        intervalDays: intervalDays || null,
        daysOfWeek: daysOfWeek || [],
        skipRestDays: skipRestDays !== false,
        exercises: {
          create: (exercises || []).map((e, i) => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            sets: e.sets || 3,
            reps: e.reps || '8-12',
            duration: e.duration || null,
            distance: e.distance || null,
            restSeconds: e.restSeconds || null,
            notes: e.notes || null,
            order: i
          }))
        }
      },
      include: {
        exercises: {
          orderBy: { order: 'asc' }
        }
      }
    })

    res.status(201).json({ recurringWorkout })
  } catch (error) {
    next(error)
  }
})

// PUT /api/schedules/recurring/:id - Update recurring workout
router.put('/recurring/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, type, intervalDays, daysOfWeek, skipRestDays, isActive, exercises } = req.body

    // Verify ownership
    const existing = await prisma.recurringWorkout.findFirst({
      where: { id, userId: req.user.id }
    })

    if (!existing) {
      return res.status(404).json({ message: 'Recurring workout not found' })
    }

    const recurringWorkout = await prisma.recurringWorkout.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        type: type !== undefined ? type : existing.type,
        intervalDays: intervalDays !== undefined ? intervalDays : existing.intervalDays,
        daysOfWeek: daysOfWeek !== undefined ? daysOfWeek : existing.daysOfWeek,
        skipRestDays: skipRestDays !== undefined ? skipRestDays : existing.skipRestDays,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        exercises: exercises ? {
          deleteMany: {},
          create: exercises.map((e, i) => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            sets: e.sets || 3,
            reps: e.reps || '8-12',
            duration: e.duration || null,
            distance: e.distance || null,
            restSeconds: e.restSeconds || null,
            notes: e.notes || null,
            order: i
          }))
        } : undefined
      },
      include: {
        exercises: {
          orderBy: { order: 'asc' }
        }
      }
    })

    res.json({ recurringWorkout })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/schedules/recurring/:id - Delete recurring workout
router.delete('/recurring/:id', async (req, res, next) => {
  try {
    const { id } = req.params

    // Verify ownership
    const existing = await prisma.recurringWorkout.findFirst({
      where: { id, userId: req.user.id }
    })

    if (!existing) {
      return res.status(404).json({ message: 'Recurring workout not found' })
    }

    await prisma.recurringWorkout.delete({
      where: { id }
    })

    res.json({ message: 'Recurring workout deleted' })
  } catch (error) {
    next(error)
  }
})

// POST /api/schedules/recurring/:id/complete - Mark recurring workout as completed for today
router.post('/recurring/:id/complete', async (req, res, next) => {
  try {
    const { id } = req.params

    const recurringWorkout = await prisma.recurringWorkout.update({
      where: { id },
      data: {
        lastCompletedDate: new Date()
      }
    })

    res.json({ recurringWorkout })
  } catch (error) {
    next(error)
  }
})

// GET /api/schedules/recurring/today - Get recurring workouts for today
router.get('/recurring/today', async (req, res, next) => {
  try {
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday

    // Get all active recurring workouts
    const allRecurring = await prisma.recurringWorkout.findMany({
      where: {
        userId: req.user.id,
        isActive: true
      },
      include: {
        exercises: {
          orderBy: { order: 'asc' }
        }
      }
    })

    // Check if today is a rest day (for skipRestDays logic)
    const weeklySchedule = await prisma.weeklySchedule.findFirst({
      where: {
        userId: req.user.id,
        dayOfWeek
      }
    })
    const isRestDay = weeklySchedule?.isRestDay || false

    // Filter recurring workouts that apply today
    const todayRecurring = allRecurring.filter(rw => {
      // Skip if it's a rest day and this workout skips rest days
      if (isRestDay && rw.skipRestDays) {
        return false
      }

      switch (rw.type) {
        case 'DAILY':
          return true

        case 'SPECIFIC_DAYS':
          return rw.daysOfWeek.includes(dayOfWeek)

        case 'EVERY_X_DAYS':
          if (!rw.intervalDays) return false
          // Calculate if today is an interval day
          const startDate = new Date(rw.startDate)
          const diffTime = Math.abs(today - startDate)
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
          return diffDays % rw.intervalDays === 0

        default:
          return false
      }
    })

    res.json({ recurringWorkouts: todayRecurring, isRestDay })
  } catch (error) {
    next(error)
  }
})

// ===========================================
// Warmup & Cooldown Suggestions
// ===========================================

// GET /api/schedules/warmup-suggestions - Get warmup suggestions for today's workout
router.get('/warmup-suggestions', async (req, res, next) => {
  try {
    const mappings = loadMappings()

    // Get user settings
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id }
    })

    // Check if warmup suggestions are enabled
    if (settings && !settings.showWarmupSuggestions) {
      return res.json({ warmups: [], tip: null, enabled: false, defaultOn: false })
    }

    // Get the default toggle state
    const defaultOn = settings?.warmupDefaultOn ?? true

    // Get today's workout to determine muscle groups
    const today = new Date()
    const dayOfWeek = today.getDay()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))

    // Check for calendar override first
    let workout = await prisma.calendarWorkout.findFirst({
      where: {
        userId: req.user.id,
        date: { gte: startOfDay, lte: endOfDay }
      },
      include: { exercises: true }
    })

    // Fall back to weekly schedule
    if (!workout) {
      workout = await prisma.weeklySchedule.findFirst({
        where: { userId: req.user.id, dayOfWeek },
        include: { exercises: true }
      })
    }

    if (!workout || !workout.exercises || workout.exercises.length === 0) {
      // Return general warmup for no specific workout
      return res.json({
        warmups: mappings.generalWarmup.mobility.slice(0, 5),
        tip: mappings.tips.warmup.find(t => t.muscle === 'general'),
        enabled: true,
        defaultOn,
        muscleGroups: []
      })
    }

    // Generate workout hash for caching (based on workout ID)
    const workoutHash = getWorkoutHash([workout.id])

    // Check cache first - return cached warmups if available
    const cached = getCachedSuggestions('warmup', req.user.id, workoutHash)
    if (cached) {
      return res.json(cached)
    }

    // Load exercise data to get muscle groups
    const exercisesPath = process.env.NODE_ENV === 'production'
      ? path.join(__dirname, '../../data/exercises.json')
      : path.join(__dirname, '../../../../exercises-db/dist/exercises.json')

    let exerciseData = []
    try {
      exerciseData = JSON.parse(fs.readFileSync(exercisesPath, 'utf-8'))
    } catch (e) {
      // Fallback if file not found
    }

    // Get unique muscle groups from today's exercises
    const muscleGroups = new Set()
    const exerciseNames = []
    workout.exercises.forEach(ex => {
      exerciseNames.push(ex.exerciseName)
      const fullExercise = exerciseData.find(e => e.id === ex.exerciseId)
      if (fullExercise) {
        (fullExercise.primaryMuscles || []).forEach(m => muscleGroups.add(m.toLowerCase()))
      }
    })

    const muscleGroupsArray = Array.from(muscleGroups)
    let warmups = []
    let isAI = false

    // Check if user wants AI-generated suggestions
    if (settings?.useAiForWarmups) {
      const aiConfig = await getUserAIConfig(req.user.id)
      if (aiConfig.apiKey && muscleGroupsArray.length > 0) {
        const aiWarmups = await generateAIWarmups(aiConfig.apiKey, muscleGroupsArray, exerciseNames)
        if (aiWarmups && aiWarmups.length > 0) {
          warmups = aiWarmups
          isAI = true
        }
      }
    }

    // Fall back to standard suggestions if AI not used or failed
    if (warmups.length === 0) {
      const seenNames = new Set()

      // Add muscle-specific warmups (no cardio - user can schedule that separately)
      muscleGroups.forEach(muscle => {
        const muscleWarmups = mappings.muscleGroups[muscle]?.warmups || []
        muscleWarmups.forEach(w => {
          if (!seenNames.has(w.name) && warmups.length < 5) {
            warmups.push({ ...w, targetMuscle: muscle })
            seenNames.add(w.name)
          }
        })
      })

      // If no muscle-specific warmups, add general mobility
      if (warmups.length === 0) {
        warmups.push(...mappings.generalWarmup.mobility.slice(0, 5))
      }
    }

    // Get relevant tip (not already dismissed today)
    const dismissedToday = settings?.dismissedTipsToday || []
    const lastDismissDate = settings?.lastTipDismissDate

    // Reset dismissals if it's a new day
    const isNewDay = !lastDismissDate ||
      new Date(lastDismissDate).toDateString() !== new Date().toDateString()

    const availableTips = mappings.tips.warmup.filter(t =>
      (isNewDay || !dismissedToday.includes(t.id)) &&
      (t.muscle === 'general' || muscleGroups.has(t.muscle))
    )

    const tip = availableTips.length > 0
      ? availableTips[Math.floor(Math.random() * availableTips.length)]
      : null

    const response = {
      warmups,
      tip,
      enabled: true,
      defaultOn,
      muscleGroups: muscleGroupsArray,
      isAI
    }

    // Cache the response for this workout
    setCachedSuggestions('warmup', req.user.id, workoutHash, response)

    res.json(response)
  } catch (error) {
    next(error)
  }
})

// GET /api/schedules/cooldown-suggestions - Get cooldown suggestions for today's workout
router.get('/cooldown-suggestions', async (req, res, next) => {
  try {
    const mappings = loadMappings()

    // Get user settings
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id }
    })

    // Check if cooldown suggestions are enabled
    if (settings && !settings.showCooldownSuggestions) {
      return res.json({ cooldowns: [], tip: null, enabled: false, defaultOn: false })
    }

    // Get the default toggle state
    const defaultOn = settings?.cooldownDefaultOn ?? true

    // Get today's workout to determine muscle groups
    const today = new Date()
    const dayOfWeek = today.getDay()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))

    // Check for calendar override first
    let workout = await prisma.calendarWorkout.findFirst({
      where: {
        userId: req.user.id,
        date: { gte: startOfDay, lte: endOfDay }
      },
      include: { exercises: true }
    })

    // Fall back to weekly schedule
    if (!workout) {
      workout = await prisma.weeklySchedule.findFirst({
        where: { userId: req.user.id, dayOfWeek },
        include: { exercises: true }
      })
    }

    if (!workout || !workout.exercises || workout.exercises.length === 0) {
      // Return general cooldown for no specific workout
      return res.json({
        cooldowns: mappings.generalCooldown,
        tip: mappings.tips.cooldown.find(t => t.muscle === 'general'),
        enabled: true,
        defaultOn,
        muscleGroups: []
      })
    }

    // Generate workout hash for caching
    const workoutHash = getWorkoutHash([workout.id])

    // Check cache first
    const cached = getCachedSuggestions('cooldown', req.user.id, workoutHash)
    if (cached) {
      return res.json(cached)
    }

    // Load exercise data to get muscle groups
    const exercisesPath = process.env.NODE_ENV === 'production'
      ? path.join(__dirname, '../../data/exercises.json')
      : path.join(__dirname, '../../../../exercises-db/dist/exercises.json')

    let exerciseData = []
    try {
      exerciseData = JSON.parse(fs.readFileSync(exercisesPath, 'utf-8'))
    } catch (e) {
      // Fallback if file not found
    }

    // Get unique muscle groups from today's exercises
    const muscleGroups = new Set()
    const exerciseNames = []
    workout.exercises.forEach(ex => {
      exerciseNames.push(ex.exerciseName)
      const fullExercise = exerciseData.find(e => e.id === ex.exerciseId)
      if (fullExercise) {
        (fullExercise.primaryMuscles || []).forEach(m => muscleGroups.add(m.toLowerCase()))
      }
    })

    const muscleGroupsArray = Array.from(muscleGroups)
    let cooldowns = []
    let isAI = false

    // Check if user wants AI-generated suggestions
    if (settings?.useAiForWarmups) { // Same setting controls both warmup and cooldown AI
      const aiConfig = await getUserAIConfig(req.user.id)
      if (aiConfig.apiKey && muscleGroupsArray.length > 0) {
        const aiCooldowns = await generateAICooldowns(aiConfig.apiKey, muscleGroupsArray, exerciseNames)
        if (aiCooldowns && aiCooldowns.length > 0) {
          cooldowns = aiCooldowns
          isAI = true
        }
      }
    }

    // Fall back to standard suggestions if AI not used or failed
    if (cooldowns.length === 0) {
      const seenNames = new Set()

      // Add muscle-specific cooldowns
      muscleGroups.forEach(muscle => {
        const muscleCooldowns = mappings.muscleGroups[muscle]?.cooldowns || []
        muscleCooldowns.forEach(c => {
          if (!seenNames.has(c.name) && cooldowns.length < 5) {
            cooldowns.push({ ...c, targetMuscle: muscle })
            seenNames.add(c.name)
          }
        })
      })

      // If no muscle-specific cooldowns, add general
      if (cooldowns.length === 0) {
        mappings.generalCooldown.slice(0, 3).forEach(c => {
          cooldowns.push(c)
        })
      }
    }

    // Get relevant tip
    const dismissedToday = settings?.dismissedTipsToday || []
    const lastDismissDate = settings?.lastTipDismissDate
    const isNewDay = !lastDismissDate ||
      new Date(lastDismissDate).toDateString() !== new Date().toDateString()

    const availableTips = mappings.tips.cooldown.filter(t =>
      (isNewDay || !dismissedToday.includes(t.id)) &&
      (t.muscle === 'general' || muscleGroups.has(t.muscle))
    )

    const tip = availableTips.length > 0
      ? availableTips[Math.floor(Math.random() * availableTips.length)]
      : null

    const response = {
      cooldowns,
      tip,
      enabled: true,
      defaultOn,
      muscleGroups: muscleGroupsArray,
      isAI
    }

    // Cache the response for this workout
    setCachedSuggestions('cooldown', req.user.id, workoutHash, response)

    res.json(response)
  } catch (error) {
    next(error)
  }
})

// POST /api/schedules/dismiss-tip - Dismiss a tip for today
router.post('/dismiss-tip', async (req, res, next) => {
  try {
    const { tipId } = req.body

    if (!tipId) {
      return res.status(400).json({ message: 'tipId is required' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get current settings
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id }
    })

    // Check if we need to reset dismissals (new day)
    const lastDismissDate = settings?.lastTipDismissDate
    const isNewDay = !lastDismissDate ||
      new Date(lastDismissDate).toDateString() !== today.toDateString()

    const currentDismissed = isNewDay ? [] : (settings?.dismissedTipsToday || [])

    // Add new tip to dismissed list
    const updatedDismissed = [...new Set([...currentDismissed, tipId])]

    await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: {
        dismissedTipsToday: updatedDismissed,
        lastTipDismissDate: today
      },
      create: {
        userId: req.user.id,
        dismissedTipsToday: updatedDismissed,
        lastTipDismissDate: today
      }
    })

    res.json({ success: true, dismissedTips: updatedDismissed })
  } catch (error) {
    next(error)
  }
})

// GET /api/schedules/warmup-settings - Get warmup/cooldown settings
router.get('/warmup-settings', async (req, res, next) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id },
      select: {
        showWarmupSuggestions: true,
        showCooldownSuggestions: true,
        warmupDefaultOn: true,
        cooldownDefaultOn: true,
        useAiForWarmups: true,
        showDailyTips: true,
        showWeightTracking: true,
        weightTrackingDefaultOn: true
      }
    })

    res.json({
      showWarmupSuggestions: settings?.showWarmupSuggestions ?? true,
      showCooldownSuggestions: settings?.showCooldownSuggestions ?? true,
      warmupDefaultOn: settings?.warmupDefaultOn ?? true,
      cooldownDefaultOn: settings?.cooldownDefaultOn ?? true,
      useAiForWarmups: settings?.useAiForWarmups ?? false,
      showDailyTips: settings?.showDailyTips ?? true,
      showWeightTracking: settings?.showWeightTracking ?? false,
      weightTrackingDefaultOn: settings?.weightTrackingDefaultOn ?? true
    })
  } catch (error) {
    next(error)
  }
})

// PUT /api/schedules/warmup-settings - Update warmup/cooldown settings
router.put('/warmup-settings', async (req, res, next) => {
  try {
    const { showWarmupSuggestions, showCooldownSuggestions, warmupDefaultOn, cooldownDefaultOn, useAiForWarmups, showDailyTips, showWeightTracking, weightTrackingDefaultOn } = req.body

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: {
        showWarmupSuggestions: showWarmupSuggestions !== undefined ? showWarmupSuggestions : undefined,
        showCooldownSuggestions: showCooldownSuggestions !== undefined ? showCooldownSuggestions : undefined,
        warmupDefaultOn: warmupDefaultOn !== undefined ? warmupDefaultOn : undefined,
        cooldownDefaultOn: cooldownDefaultOn !== undefined ? cooldownDefaultOn : undefined,
        useAiForWarmups: useAiForWarmups !== undefined ? useAiForWarmups : undefined,
        showDailyTips: showDailyTips !== undefined ? showDailyTips : undefined,
        showWeightTracking: showWeightTracking !== undefined ? showWeightTracking : undefined,
        weightTrackingDefaultOn: weightTrackingDefaultOn !== undefined ? weightTrackingDefaultOn : undefined
      },
      create: {
        userId: req.user.id,
        showWarmupSuggestions: showWarmupSuggestions ?? true,
        showCooldownSuggestions: showCooldownSuggestions ?? true,
        warmupDefaultOn: warmupDefaultOn ?? true,
        cooldownDefaultOn: cooldownDefaultOn ?? true,
        useAiForWarmups: useAiForWarmups ?? false,
        showDailyTips: showDailyTips ?? true,
        showWeightTracking: showWeightTracking ?? false,
        weightTrackingDefaultOn: weightTrackingDefaultOn ?? true
      }
    })

    res.json({
      showWarmupSuggestions: settings.showWarmupSuggestions,
      showCooldownSuggestions: settings.showCooldownSuggestions,
      warmupDefaultOn: settings.warmupDefaultOn,
      cooldownDefaultOn: settings.cooldownDefaultOn,
      useAiForWarmups: settings.useAiForWarmups,
      showDailyTips: settings.showDailyTips,
      showWeightTracking: settings.showWeightTracking,
      weightTrackingDefaultOn: settings.weightTrackingDefaultOn
    })
  } catch (error) {
    next(error)
  }
})

export default router
