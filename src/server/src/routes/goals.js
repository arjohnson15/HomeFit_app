import express from 'express'
import prisma from '../lib/prisma.js'
import achievementService from '../services/achievements.js'

const router = express.Router()

// GET /api/goals - Get user's goals
router.get('/', async (req, res, next) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.user.id },
      include: {
        progressLogs: {
          orderBy: { date: 'desc' },
          take: 10
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ goals })
  } catch (error) {
    next(error)
  }
})

// GET /api/goals/:id - Get single goal with full progress history
router.get('/:id', async (req, res, next) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      include: {
        progressLogs: {
          orderBy: { date: 'asc' }
        }
      }
    })

    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' })
    }

    res.json({ goal })
  } catch (error) {
    next(error)
  }
})

// POST /api/goals - Create new goal
router.post('/', async (req, res, next) => {
  try {
    const {
      type,
      targetValue,
      startValue,
      targetDate,
      exerciseId,
      exerciseName,
      isPublic
    } = req.body

    if (!type || targetValue === undefined || startValue === undefined) {
      return res.status(400).json({ message: 'Type, targetValue, and startValue are required' })
    }

    const goal = await prisma.goal.create({
      data: {
        userId: req.user.id,
        type,
        targetValue,
        startValue,
        currentValue: startValue,
        targetDate: targetDate ? new Date(targetDate) : null,
        exerciseId: exerciseId || null,
        exerciseName: exerciseName || null,
        isPublic: isPublic !== false
      }
    })

    // Create initial progress log
    await prisma.goalProgress.create({
      data: {
        goalId: goal.id,
        value: startValue,
        source: 'MANUAL',
        notes: 'Goal created'
      }
    })

    res.status(201).json({ goal })
  } catch (error) {
    next(error)
  }
})

// PUT /api/goals/:id - Update goal
router.put('/:id', async (req, res, next) => {
  try {
    const { targetValue, targetDate, isPublic, isCompleted } = req.body

    // Verify ownership
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    })

    if (!existing) {
      return res.status(404).json({ message: 'Goal not found' })
    }

    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        targetValue: targetValue !== undefined ? targetValue : existing.targetValue,
        targetDate: targetDate !== undefined ? (targetDate ? new Date(targetDate) : null) : existing.targetDate,
        isPublic: isPublic !== undefined ? isPublic : existing.isPublic,
        isCompleted: isCompleted !== undefined ? isCompleted : existing.isCompleted,
        completedAt: isCompleted && !existing.isCompleted ? new Date() : existing.completedAt
      }
    })

    res.json({ goal })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/goals/:id - Delete goal
router.delete('/:id', async (req, res, next) => {
  try {
    // Verify ownership
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    })

    if (!existing) {
      return res.status(404).json({ message: 'Goal not found' })
    }

    await prisma.goal.delete({
      where: { id: req.params.id }
    })

    res.json({ message: 'Goal deleted' })
  } catch (error) {
    next(error)
  }
})

// POST /api/goals/:id/progress - Log manual progress
router.post('/:id/progress', async (req, res, next) => {
  try {
    const { value, notes } = req.body

    if (value === undefined) {
      return res.status(400).json({ message: 'Value is required' })
    }

    // Verify ownership
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    })

    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' })
    }

    // Create progress log
    const progress = await prisma.goalProgress.create({
      data: {
        goalId: goal.id,
        value,
        source: 'MANUAL',
        notes: notes || null
      }
    })

    // Check if goal will be completed
    const willBeCompleted = checkGoalCompletion(goal.type, value, goal.targetValue, goal.startValue)
    const justCompleted = willBeCompleted && !goal.isCompleted

    // Update current value on goal
    const updatedGoal = await prisma.goal.update({
      where: { id: goal.id },
      data: {
        currentValue: value,
        isCompleted: willBeCompleted,
        completedAt: justCompleted ? new Date() : goal.completedAt
      }
    })

    // Check achievements if goal was just completed
    let newAchievements = []
    if (justCompleted) {
      newAchievements = await achievementService.checkAchievements(req.user.id, {
        goalCompleted: true,
        goalType: goal.type
      })
    }

    res.json({ progress, goal: updatedGoal, newAchievements })
  } catch (error) {
    next(error)
  }
})

// GET /api/goals/public/:userId - Get friend's public goals
router.get('/public/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params
    const requesterId = req.user.id

    // Check if users are friends (unless viewing own)
    if (userId !== requesterId) {
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
    }

    const goals = await prisma.goal.findMany({
      where: {
        userId,
        isPublic: true
      },
      select: {
        id: true,
        type: true,
        targetValue: true,
        currentValue: true,
        startValue: true,
        startDate: true,
        targetDate: true,
        exerciseName: true,
        isCompleted: true,
        completedAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ goals })
  } catch (error) {
    next(error)
  }
})

// Helper function to check if goal is completed
function checkGoalCompletion(type, currentValue, targetValue, startValue) {
  switch (type) {
    case 'WEIGHT_LOSS':
      // Goal is complete when current weight is at or below target
      return currentValue <= targetValue
    case 'WEIGHT_GAIN':
      // Goal is complete when current weight is at or above target
      return currentValue >= targetValue
    case 'EXERCISE_STRENGTH':
    case 'CARDIO_DISTANCE':
    case 'MONTHLY_WORKOUTS':
    case 'YEARLY_WORKOUTS':
      // Goal is complete when current value reaches target (higher is better)
      return currentValue >= targetValue
    case 'CARDIO_TIME':
      // For time goals (like mile time), lower is better
      return currentValue <= targetValue
    default:
      return false
  }
}

export default router
