import express from 'express'
import prisma from '../lib/prisma.js'
import achievementService from '../services/achievements.js'
import followNotificationService from '../services/followNotifications.js'
import { autoLogCardioDistance, ensurePassiveMarathon } from './marathons.js'

const router = express.Router()

// GET /api/workouts/today/completed - Get today's completed workouts
router.get('/today/completed', async (req, res, next) => {
  try {
    // Use client's local day boundaries (UTC timestamps) to avoid timezone mismatch
    // Client sends from/to as ISO strings representing midnight-to-midnight in their timezone
    let dayStart, dayEnd
    if (req.query.from && req.query.to) {
      dayStart = new Date(req.query.from)
      dayEnd = new Date(req.query.to)
    } else {
      dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
    }

    const workouts = await prisma.workoutSession.findMany({
      where: {
        userId: req.user.id,
        startTime: {
          gte: dayStart,
          lt: dayEnd
        },
        endTime: { not: null } // Only completed workouts
      },
      include: {
        exerciseLogs: {
          include: {
            sets: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    })

    // Calculate summary stats for today
    const totalDuration = workouts.reduce((sum, w) => sum + (w.duration || 0), 0)
    const totalSets = workouts.reduce((sum, w) =>
      sum + w.exerciseLogs.reduce((s, l) => s + l.sets.length, 0), 0)
    const totalExercises = workouts.reduce((sum, w) => sum + w.exerciseLogs.length, 0)
    const prsToday = workouts.reduce((sum, w) =>
      sum + w.exerciseLogs.reduce((s, l) =>
        s + l.sets.filter(set => set.isPR).length, 0), 0)

    res.json({
      workouts,
      summary: {
        count: workouts.length,
        totalDuration,
        totalSets,
        totalExercises,
        prsToday
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/workouts/exercise/:exerciseId/history - Get exercise history (last 5 sessions)
router.get('/exercise/:exerciseId/history', async (req, res, next) => {
  try {
    const { exerciseId } = req.params
    const { limit = 5 } = req.query

    // Get all sessions where this exercise was logged, with sets
    const exerciseLogs = await prisma.exerciseLog.findMany({
      where: {
        exerciseId,
        session: {
          userId: req.user.id,
          endTime: { not: null } // Only completed sessions
        }
      },
      include: {
        sets: {
          orderBy: { setNumber: 'asc' }
        },
        session: {
          select: {
            id: true,
            date: true,
            name: true
          }
        }
      },
      orderBy: {
        session: { date: 'desc' }
      },
      take: parseInt(limit)
    })

    // Get PR for this exercise (best weight x reps)
    const allSets = await prisma.set.findMany({
      where: {
        log: {
          exerciseId,
          session: {
            userId: req.user.id
          }
        }
      },
      orderBy: [
        { weight: 'desc' },
        { reps: 'desc' }
      ]
    })

    // Calculate PR (highest weight with valid reps, or most reps if bodyweight)
    let pr = null
    if (allSets.length > 0) {
      // For weighted exercises, PR is highest weight
      const weightedSets = allSets.filter(s => s.weight && s.weight > 0)
      if (weightedSets.length > 0) {
        pr = {
          weight: weightedSets[0].weight,
          reps: weightedSets[0].reps,
          date: weightedSets[0].createdAt
        }
      } else {
        // For bodyweight, PR is most reps
        const maxReps = allSets.reduce((max, s) =>
          (s.reps || 0) > (max?.reps || 0) ? s : max, null)
        if (maxReps) {
          pr = {
            weight: 0,
            reps: maxReps.reps,
            date: maxReps.createdAt
          }
        }
      }
    }

    res.json({
      history: exerciseLogs,
      pr,
      lastSession: exerciseLogs[0] || null
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/workouts/active - Get current active (in-progress) workout
router.get('/active', async (req, res, next) => {
  try {
    // Find workout that has started but not ended
    // startTime is always set (required field), so just check endTime is null
    const activeWorkout = await prisma.workoutSession.findFirst({
      where: {
        userId: req.user.id,
        endTime: null
      },
      include: {
        exerciseLogs: {
          include: {
            sets: true
          }
        }
      },
      orderBy: { startTime: 'desc' }
    })

    res.json({ activeWorkout })
  } catch (error) {
    next(error)
  }
})

// POST /api/workouts/:id/pause - Toggle pause state
router.post('/:id/pause', async (req, res, next) => {
  try {
    const workout = await prisma.workoutSession.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    })

    if (!workout) {
      return res.status(404).json({ message: 'Workout not found' })
    }

    if (workout.endTime) {
      return res.status(400).json({ message: 'Workout already ended' })
    }

    let updatedWorkout
    if (workout.pausedAt) {
      // Currently paused - resume
      const pausedAt = new Date(workout.pausedAt)
      const now = new Date()
      const pausedDuration = Math.floor((now - pausedAt) / 1000)

      updatedWorkout = await prisma.workoutSession.update({
        where: { id: req.params.id },
        data: {
          pausedAt: null,
          totalPausedTime: workout.totalPausedTime + pausedDuration
        }
      })
    } else {
      // Currently running - pause
      updatedWorkout = await prisma.workoutSession.update({
        where: { id: req.params.id },
        data: {
          pausedAt: new Date()
        }
      })
    }

    res.json({
      workout: updatedWorkout,
      isPaused: !!updatedWorkout.pausedAt
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/workouts/:id/rest - Set or clear rest timer
router.post('/:id/rest', async (req, res, next) => {
  try {
    const { duration } = req.body // duration in seconds, or 0/null to clear

    const workout = await prisma.workoutSession.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    })

    if (!workout) {
      return res.status(404).json({ message: 'Workout not found' })
    }

    if (workout.endTime) {
      return res.status(400).json({ message: 'Workout already ended' })
    }

    let restTimerEndAt = null
    if (duration && duration > 0) {
      restTimerEndAt = new Date(Date.now() + duration * 1000)
    }

    const updatedWorkout = await prisma.workoutSession.update({
      where: { id: req.params.id },
      data: { restTimerEndAt }
    })

    res.json({
      workout: updatedWorkout,
      restTimerEndAt: updatedWorkout.restTimerEndAt
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/workouts/cleanup-orphaned - Delete any orphaned active workouts
router.post('/cleanup-orphaned', async (req, res, next) => {
  try {
    // Find all workouts that have no endTime (orphaned/stuck active workouts)
    const orphanedWorkouts = await prisma.workoutSession.findMany({
      where: {
        userId: req.user.id,
        endTime: null
      },
      select: { id: true }
    })

    if (orphanedWorkouts.length > 0) {
      // Delete all orphaned workouts
      await prisma.workoutSession.deleteMany({
        where: {
          id: { in: orphanedWorkouts.map(w => w.id) },
          userId: req.user.id
        }
      })
    }

    res.json({
      cleaned: orphanedWorkouts.length,
      message: `Cleaned up ${orphanedWorkouts.length} orphaned workout(s)`
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/workouts/stats/prs - Get user's total PR count
router.get('/stats/prs', async (req, res, next) => {
  try {
    const prCount = await prisma.set.count({
      where: {
        isPR: true,
        log: {
          session: {
            userId: req.user.id
          }
        }
      }
    })

    res.json({ prCount })
  } catch (error) {
    next(error)
  }
})

// GET /api/workouts - Get workout history
router.get('/', async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, startDate, endDate } = req.query

    const where = { userId: req.user.id }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    const workouts = await prisma.workoutSession.findMany({
      where,
      include: {
        exerciseLogs: {
          include: {
            sets: true
          }
        }
      },
      orderBy: { date: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    })

    const total = await prisma.workoutSession.count({ where })

    res.json({ workouts, total })
  } catch (error) {
    next(error)
  }
})

// GET /api/workouts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const workout = await prisma.workoutSession.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      include: {
        exerciseLogs: {
          include: {
            sets: true
          }
        }
      }
    })

    if (!workout) {
      return res.status(404).json({ message: 'Workout not found' })
    }

    res.json({ workout })
  } catch (error) {
    next(error)
  }
})

// POST /api/workouts - Start a new workout
router.post('/', async (req, res, next) => {
  try {
    const { name, scheduledWorkoutId } = req.body

    const workout = await prisma.workoutSession.create({
      data: {
        userId: req.user.id,
        name: name || 'Workout',
        date: new Date(),
        startTime: new Date(),
        scheduledWorkoutId
      }
    })

    res.status(201).json({ workout })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/workouts/:id - Update workout (end, add notes, name, duration, etc)
router.patch('/:id', async (req, res, next) => {
  try {
    const { endTime, notes, rating, name, duration } = req.body

    // Get current workout to check if it's being completed
    const currentWorkout = await prisma.workoutSession.findUnique({
      where: { id: req.params.id },
      select: { userId: true, startTime: true, endTime: true }
    })

    const isBeingCompleted = endTime && !currentWorkout?.endTime

    const workout = await prisma.workoutSession.update({
      where: { id: req.params.id },
      data: {
        ...(endTime && {
          endTime: new Date(endTime),
          duration: Math.floor((new Date(endTime) - new Date(currentWorkout?.startTime || req.body.startTime)) / 1000)
        }),
        ...(notes !== undefined && { notes }),
        ...(rating !== undefined && { rating }),
        ...(name !== undefined && { name }),
        ...(duration !== undefined && !endTime && { duration }) // Allow direct duration edit if not setting endTime
      }
    })

    // Check achievements when workout is completed
    let newAchievements = []
    if (isBeingCompleted && currentWorkout?.userId) {
      newAchievements = await achievementService.checkAchievements(currentWorkout.userId, {
        workoutCompleted: true,
        duration: workout.duration || 0
      })

      // Auto-track workout goals (MONTHLY_WORKOUTS and YEARLY_WORKOUTS)
      await updateWorkoutGoals(currentWorkout.userId)

      // Notify followers of workout completion
      const exerciseCount = await prisma.exerciseLog.count({
        where: { sessionId: workout.id }
      })
      followNotificationService.notifyWorkoutCompleted(currentWorkout.userId, {
        workoutName: workout.name,
        duration: workout.duration || 0,
        exerciseCount
      })

      // Auto-log cardio distance to marathons (Across America + any active enrolled marathons)
      try {
        await ensurePassiveMarathon(currentWorkout.userId)
        const exerciseLogs = await prisma.exerciseLog.findMany({
          where: { sessionId: workout.id },
          include: { sets: { where: { distance: { gt: 0 } } } }
        })
        let totalDistance = 0
        let totalCardioDuration = 0
        for (const log of exerciseLogs) {
          for (const set of log.sets) {
            totalDistance += set.distance || 0
            totalCardioDuration += set.duration || 0
          }
        }
        if (totalDistance > 0) {
          await autoLogCardioDistance(currentWorkout.userId, totalDistance, totalCardioDuration, workout.id)
        }
      } catch (marathonErr) {
        console.error('Marathon auto-log error (non-fatal):', marathonErr)
      }
    }

    res.json({
      workout,
      newAchievements: newAchievements.map(ua => ({
        id: ua.achievement.id,
        name: ua.achievement.name,
        description: ua.achievement.description,
        icon: ua.achievement.icon,
        rarity: ua.achievement.rarity,
        points: ua.achievement.points
      }))
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/workouts/:id/exercises - Log an exercise
router.post('/:id/exercises', async (req, res, next) => {
  try {
    const { exerciseId, exerciseName } = req.body

    const exerciseLog = await prisma.exerciseLog.create({
      data: {
        sessionId: req.params.id,
        exerciseId,
        exerciseName
      }
    })

    res.status(201).json({ exerciseLog })
  } catch (error) {
    next(error)
  }
})

// POST /api/workouts/:id/exercises/:logId/sets - Log a set (with auto PR detection)
router.post('/:id/exercises/:logId/sets', async (req, res, next) => {
  try {
    const { reps, weight, duration, notes, rpe, setNumber } = req.body

    // Get the exercise log to find the exerciseId
    const exerciseLog = await prisma.exerciseLog.findUnique({
      where: { id: req.params.logId },
      include: {
        session: {
          select: { userId: true }
        }
      }
    })

    if (!exerciseLog) {
      return res.status(404).json({ message: 'Exercise log not found' })
    }

    // Check for PR using estimated 1RM (Epley formula) with 10-set minimum
    let isPR = false
    let estimated1RM = null

    // Helper: Calculate estimated 1RM using Epley formula
    const calculate1RM = (w, r) => {
      if (!w || w <= 0 || !r || r <= 0) return 0
      // Epley formula: 1RM = weight × (1 + reps/30)
      // Cap at 10 reps for formula accuracy (higher reps are less reliable for 1RM estimation)
      const effectiveReps = Math.min(r, 10)
      return w * (1 + effectiveReps / 30)
    }

    if (weight && weight > 0 && reps && reps > 0) {
      // For weighted exercises, check if this beats the best estimated 1RM

      // First, count total sets for this exercise to enforce 10-set minimum
      const setCount = await prisma.set.count({
        where: {
          log: {
            exerciseId: exerciseLog.exerciseId,
            session: {
              userId: exerciseLog.session.userId
            }
          },
          weight: { gt: 0 },
          reps: { gt: 0 }
        }
      })

      // Only check for PR if user has logged at least 10 sets for this exercise
      if (setCount >= 10) {
        // Get all previous sets to find best estimated 1RM
        const previousSets = await prisma.set.findMany({
          where: {
            log: {
              exerciseId: exerciseLog.exerciseId,
              session: {
                userId: exerciseLog.session.userId
              }
            },
            weight: { gt: 0 },
            reps: { gt: 0 }
          },
          select: { weight: true, reps: true }
        })

        // Calculate best previous 1RM
        let bestPrevious1RM = 0
        previousSets.forEach(s => {
          const est1RM = calculate1RM(s.weight, s.reps)
          if (est1RM > bestPrevious1RM) {
            bestPrevious1RM = est1RM
          }
        })

        // Calculate current set's estimated 1RM
        estimated1RM = calculate1RM(weight, reps)

        // It's a PR if current 1RM beats the previous best
        if (estimated1RM > bestPrevious1RM) {
          isPR = true
        }
      }
    } else if (reps && reps > 0 && (!weight || weight === 0)) {
      // For bodyweight exercises, check if this is the most reps ever

      // First, count total sets for this exercise to enforce 10-set minimum
      const setCount = await prisma.set.count({
        where: {
          log: {
            exerciseId: exerciseLog.exerciseId,
            session: {
              userId: exerciseLog.session.userId
            }
          },
          OR: [
            { weight: null },
            { weight: { lte: 0 } }
          ],
          reps: { gt: 0 }
        }
      })

      // Only check for PR if user has logged at least 10 sets for this exercise
      if (setCount >= 10) {
        const previousBest = await prisma.set.findFirst({
          where: {
            log: {
              exerciseId: exerciseLog.exerciseId,
              session: {
                userId: exerciseLog.session.userId
              }
            },
            OR: [
              { weight: null },
              { weight: { lte: 0 } }
            ]
          },
          orderBy: { reps: 'desc' }
        })

        if (!previousBest || reps > previousBest.reps) {
          isPR = true
        }
      }
    }

    // Cardio PR tracking (distance and/or duration based)
    const { distance } = req.body
    let cardioPRType = null // 'pace', 'distance', or null

    if (distance && distance > 0 && duration && duration > 0) {
      // Cardio exercise with both distance and time - check for best pace and longest distance

      // Count cardio sets for this exercise (10-set minimum)
      const cardioSetCount = await prisma.set.count({
        where: {
          log: {
            exerciseId: exerciseLog.exerciseId,
            session: {
              userId: exerciseLog.session.userId
            }
          },
          distance: { gt: 0 },
          duration: { gt: 0 }
        }
      })

      if (cardioSetCount >= 10) {
        // Get all previous cardio sets
        const previousCardioSets = await prisma.set.findMany({
          where: {
            log: {
              exerciseId: exerciseLog.exerciseId,
              session: {
                userId: exerciseLog.session.userId
              }
            },
            distance: { gt: 0 },
            duration: { gt: 0 }
          },
          select: { distance: true, duration: true }
        })

        // Calculate current pace (minutes per mile/km)
        const currentPace = duration / 60 / distance // minutes per unit

        // Find best previous pace (lowest is better)
        let bestPreviousPace = Infinity
        let longestPreviousDistance = 0

        previousCardioSets.forEach(s => {
          const pace = s.duration / 60 / s.distance
          if (pace < bestPreviousPace) {
            bestPreviousPace = pace
          }
          if (s.distance > longestPreviousDistance) {
            longestPreviousDistance = s.distance
          }
        })

        // Check for pace PR (faster pace = lower number)
        if (currentPace < bestPreviousPace) {
          isPR = true
          cardioPRType = 'pace'
        }
        // Check for distance PR (longer distance)
        else if (distance > longestPreviousDistance) {
          isPR = true
          cardioPRType = 'distance'
        }
      }
    } else if (distance && distance > 0 && (!duration || duration === 0)) {
      // Distance-only cardio (like total miles logged) - check for longest distance

      const cardioSetCount = await prisma.set.count({
        where: {
          log: {
            exerciseId: exerciseLog.exerciseId,
            session: {
              userId: exerciseLog.session.userId
            }
          },
          distance: { gt: 0 }
        }
      })

      if (cardioSetCount >= 10) {
        const previousBest = await prisma.set.findFirst({
          where: {
            log: {
              exerciseId: exerciseLog.exerciseId,
              session: {
                userId: exerciseLog.session.userId
              }
            },
            distance: { gt: 0 }
          },
          orderBy: { distance: 'desc' }
        })

        if (!previousBest || distance > previousBest.distance) {
          isPR = true
          cardioPRType = 'distance'
        }
      }
    }

    const set = await prisma.set.create({
      data: {
        logId: req.params.logId,
        setNumber: setNumber || 1,
        reps,
        weight,
        duration,
        distance,
        notes,
        rpe,
        isPR,
        completed: true
      }
    })

    // Check achievements when a PR is set
    let newAchievements = []
    if (isPR && exerciseLog.session.userId) {
      newAchievements = await achievementService.checkAchievements(exerciseLog.session.userId, {
        prSet: true,
        prCount: 1
      })
    }

    // Determine PR type for frontend display
    let prType = null
    if (isPR) {
      if (cardioPRType) {
        prType = cardioPRType // 'pace' or 'distance'
      } else if (estimated1RM) {
        prType = 'strength' // Weighted exercise with 1RM calculation
      } else {
        prType = 'bodyweight' // Bodyweight exercise (reps only)
      }
    }

    res.status(201).json({
      set,
      isPR,
      prType,
      estimated1RM: estimated1RM ? Math.round(estimated1RM * 10) / 10 : null, // Round to 1 decimal
      newAchievements: newAchievements.map(ua => ({
        id: ua.achievement.id,
        name: ua.achievement.name,
        description: ua.achievement.description,
        icon: ua.achievement.icon,
        rarity: ua.achievement.rarity,
        points: ua.achievement.points
      }))
    })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/workouts/:id/exercises/:logId/difficulty - Update difficulty rating
router.patch('/:id/exercises/:logId/difficulty', async (req, res, next) => {
  try {
    const { difficultyRating } = req.body

    if (difficultyRating < 1 || difficultyRating > 5) {
      return res.status(400).json({ message: 'Difficulty rating must be 1-5' })
    }

    const exerciseLog = await prisma.exerciseLog.update({
      where: { id: req.params.logId },
      data: { difficultyRating }
    })

    res.json({ exerciseLog })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/workouts/:id/exercises/:logId - Update exercise log (notes, difficulty)
router.patch('/:id/exercises/:logId', async (req, res, next) => {
  try {
    const { notes, difficultyRating } = req.body

    // Verify workout belongs to user
    const exerciseLog = await prisma.exerciseLog.findFirst({
      where: {
        id: req.params.logId,
        session: {
          id: req.params.id,
          userId: req.user.id
        }
      }
    })

    if (!exerciseLog) {
      return res.status(404).json({ message: 'Exercise log not found' })
    }

    const updateData = {}
    if (notes !== undefined) updateData.notes = notes
    if (difficultyRating !== undefined) {
      if (difficultyRating < 1 || difficultyRating > 5) {
        return res.status(400).json({ message: 'Difficulty rating must be 1-5' })
      }
      updateData.difficultyRating = difficultyRating
    }

    const updatedLog = await prisma.exerciseLog.update({
      where: { id: req.params.logId },
      data: updateData,
      include: { sets: true }
    })

    res.json({ exerciseLog: updatedLog })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/workouts/:id/exercises/:logId/sets/:setId - Update a set
router.patch('/:id/exercises/:logId/sets/:setId', async (req, res, next) => {
  try {
    const { weight, reps, duration, distance, rpe, notes } = req.body

    // Verify set belongs to user's workout
    const set = await prisma.set.findFirst({
      where: {
        id: req.params.setId,
        log: {
          id: req.params.logId,
          session: {
            id: req.params.id,
            userId: req.user.id
          }
        }
      }
    })

    if (!set) {
      return res.status(404).json({ message: 'Set not found' })
    }

    const updateData = {}
    if (weight !== undefined) updateData.weight = weight
    if (reps !== undefined) updateData.reps = reps
    if (duration !== undefined) updateData.duration = duration
    if (distance !== undefined) updateData.distance = distance
    if (rpe !== undefined) {
      if (rpe < 1 || rpe > 10) {
        return res.status(400).json({ message: 'RPE must be 1-10' })
      }
      updateData.rpe = rpe
    }
    if (notes !== undefined) updateData.notes = notes

    const updatedSet = await prisma.set.update({
      where: { id: req.params.setId },
      data: updateData
    })

    res.json({ set: updatedSet })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/workouts/:id/exercises/:logId/sets/:setId - Delete a set
router.delete('/:id/exercises/:logId/sets/:setId', async (req, res, next) => {
  try {
    // Verify set belongs to user's workout
    const set = await prisma.set.findFirst({
      where: {
        id: req.params.setId,
        log: {
          id: req.params.logId,
          session: {
            id: req.params.id,
            userId: req.user.id
          }
        }
      }
    })

    if (!set) {
      return res.status(404).json({ message: 'Set not found' })
    }

    await prisma.set.delete({
      where: { id: req.params.setId }
    })

    // Renumber remaining sets
    const remainingSets = await prisma.set.findMany({
      where: { logId: req.params.logId },
      orderBy: { setNumber: 'asc' }
    })

    for (let i = 0; i < remainingSets.length; i++) {
      if (remainingSets[i].setNumber !== i + 1) {
        await prisma.set.update({
          where: { id: remainingSets[i].id },
          data: { setNumber: i + 1 }
        })
      }
    }

    res.json({ message: 'Set deleted' })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/workouts/:id/exercises/:logId - Delete an exercise log
router.delete('/:id/exercises/:logId', async (req, res, next) => {
  try {
    // Verify exercise log belongs to user's workout
    const exerciseLog = await prisma.exerciseLog.findFirst({
      where: {
        id: req.params.logId,
        session: {
          id: req.params.id,
          userId: req.user.id
        }
      }
    })

    if (!exerciseLog) {
      return res.status(404).json({ message: 'Exercise log not found' })
    }

    // Delete will cascade to sets due to Prisma schema
    await prisma.exerciseLog.delete({
      where: { id: req.params.logId }
    })

    res.json({ message: 'Exercise deleted' })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/workouts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.workoutSession.delete({
      where: { id: req.params.id }
    })

    res.json({ message: 'Workout deleted' })
  } catch (error) {
    next(error)
  }
})

// Helper function to auto-track MONTHLY_WORKOUTS and YEARLY_WORKOUTS goals
async function updateWorkoutGoals(userId) {
  try {
    // Get all active workout goals for this user
    const workoutGoals = await prisma.goal.findMany({
      where: {
        userId,
        type: { in: ['MONTHLY_WORKOUTS', 'YEARLY_WORKOUTS'] },
        isCompleted: false
      }
    })

    if (workoutGoals.length === 0) return

    const now = new Date()

    for (const goal of workoutGoals) {
      let startOfPeriod, endOfPeriod

      if (goal.type === 'MONTHLY_WORKOUTS') {
        // Get first and last day of current month
        startOfPeriod = new Date(now.getFullYear(), now.getMonth(), 1)
        endOfPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      } else {
        // YEARLY_WORKOUTS - Get first and last day of current year
        startOfPeriod = new Date(now.getFullYear(), 0, 1)
        endOfPeriod = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
      }

      // Count completed workouts in the period
      const workoutCount = await prisma.workoutSession.count({
        where: {
          userId,
          endTime: {
            gte: startOfPeriod,
            lte: endOfPeriod
          }
        }
      })

      // Update the goal's current value
      const isCompleted = workoutCount >= goal.targetValue
      const justCompleted = isCompleted && !goal.isCompleted

      await prisma.goal.update({
        where: { id: goal.id },
        data: {
          currentValue: workoutCount,
          isCompleted,
          completedAt: justCompleted ? new Date() : goal.completedAt
        }
      })

      // Log progress
      await prisma.goalProgress.create({
        data: {
          goalId: goal.id,
          value: workoutCount,
          source: 'AUTO_WORKOUT_LOG'
        }
      })

      // Check achievements if goal just completed
      // Note: workout goals don't trigger goal achievements since they're recurring
    }
  } catch (error) {
    console.error('Error updating workout goals:', error)
  }
}

export default router
