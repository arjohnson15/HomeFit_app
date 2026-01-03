import express from 'express'
import { PrismaClient } from '@prisma/client'
import achievementService from '../services/achievements.js'

const router = express.Router()
const prisma = new PrismaClient()

// GET /api/social/search - Search for users to add as friends
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query

    if (!q || q.trim().length < 2) {
      return res.json({ users: [] })
    }

    const query = q.trim().toLowerCase()

    // Get existing friendships (to exclude already connected users)
    const existingFriendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: req.user.id },
          { friendId: req.user.id }
        ]
      },
      select: {
        userId: true,
        friendId: true,
        status: true
      }
    })

    // Build list of user IDs to exclude
    const excludeIds = new Set([req.user.id])
    existingFriendships.forEach(f => {
      // Exclude users with any friendship status (pending, accepted, rejected, blocked)
      if (f.userId === req.user.id) {
        excludeIds.add(f.friendId)
      } else {
        excludeIds.add(f.userId)
      }
    })

    // Search for users
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            id: { notIn: Array.from(excludeIds) }
          },
          {
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } }
            ]
          },
          {
            // Only show users who are searchable (PUBLIC or FRIENDS_ONLY)
            settings: {
              profileVisibility: { in: ['PUBLIC', 'FRIENDS_ONLY'] }
            }
          }
        ]
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        settings: {
          select: {
            profileVisibility: true
          }
        }
      },
      take: 20
    })

    // Format response - include visibility info for UI
    const formattedUsers = users.map(u => ({
      id: u.id,
      name: u.name,
      username: u.username,
      avatarUrl: u.avatarUrl,
      requiresApproval: u.settings?.profileVisibility === 'FRIENDS_ONLY'
    }))

    res.json({ users: formattedUsers })
  } catch (error) {
    next(error)
  }
})

// GET /api/social/my-stats - Get current user's personal stats
router.get('/my-stats', async (req, res, next) => {
  try {
    const userId = req.user.id

    // Get workouts this week
    const startOfWeek = new Date()
    startOfWeek.setHours(0, 0, 0, 0)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()) // Sunday

    const thisWeekWorkouts = await prisma.workoutSession.count({
      where: {
        userId,
        endTime: { not: null },
        startTime: { gte: startOfWeek }
      }
    })

    // Get user stats (streak and PRs)
    let userStats = await prisma.userStats.findUnique({
      where: { userId }
    })

    // If no stats exist, calculate streak from workout history
    let streak = userStats?.currentStreak || 0
    let totalPRs = userStats?.totalPRs || 0

    if (!userStats) {
      // Calculate streak manually with rest day tolerance
      const workouts = await prisma.workoutSession.findMany({
        where: {
          userId,
          endTime: { not: null }
        },
        select: { startTime: true },
        orderBy: { startTime: 'desc' }
      })

      if (workouts.length > 0) {
        const workoutDates = workouts.map(w => new Date(w.startTime).toDateString())
        streak = calculateStreakWithRestDays(workoutDates)
      }

      // Count total PRs
      totalPRs = await prisma.setLog.count({
        where: {
          isPR: true,
          exerciseLog: {
            session: { userId }
          }
        }
      })
    }

    res.json({
      thisWeek: thisWeekWorkouts,
      streak,
      totalPRs
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/social/friends
router.get('/friends', async (req, res, next) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: req.user.id, status: 'ACCEPTED' },
          { friendId: req.user.id, status: 'ACCEPTED' }
        ]
      },
      include: {
        user: {
          select: { id: true, name: true, username: true }
        },
        friend: {
          select: { id: true, name: true, username: true }
        }
      }
    })

    // Extract friend info
    const friends = friendships.map(f => {
      return f.userId === req.user.id ? f.friend : f.user
    })

    res.json({ friends })
  } catch (error) {
    next(error)
  }
})

// GET /api/social/requests
router.get('/requests', async (req, res, next) => {
  try {
    const requests = await prisma.friendship.findMany({
      where: {
        friendId: req.user.id,
        status: 'PENDING'
      },
      include: {
        user: {
          select: { id: true, name: true, username: true }
        }
      }
    })

    res.json({ requests })
  } catch (error) {
    next(error)
  }
})

// POST /api/social/request - Send friend request
router.post('/request', async (req, res, next) => {
  try {
    const { identifier, userId } = req.body // Can accept userId directly or email/username

    // Find user by ID or identifier
    let friend
    if (userId) {
      friend = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          settings: {
            select: { profileVisibility: true }
          }
        }
      })
    } else if (identifier) {
      friend = await prisma.user.findFirst({
        where: {
          OR: [
            { email: identifier },
            { username: identifier }
          ]
        },
        include: {
          settings: {
            select: { profileVisibility: true }
          }
        }
      })
    }

    if (!friend) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (friend.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot add yourself' })
    }

    // Check if user's profile allows friend requests
    const visibility = friend.settings?.profileVisibility || 'PUBLIC'
    if (visibility === 'PRIVATE') {
      return res.status(403).json({ message: 'This user does not accept friend requests' })
    }

    // Check existing friendship
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: req.user.id, friendId: friend.id },
          { userId: friend.id, friendId: req.user.id }
        ]
      }
    })

    if (existing) {
      if (existing.status === 'BLOCKED') {
        return res.status(403).json({ message: 'Unable to send friend request' })
      }
      return res.status(409).json({ message: 'Friend request already exists' })
    }

    // Determine status based on visibility
    // PUBLIC = auto-accept (instant follow)
    // FRIENDS_ONLY = requires approval (pending)
    const status = visibility === 'PUBLIC' ? 'ACCEPTED' : 'PENDING'

    const friendship = await prisma.friendship.create({
      data: {
        userId: req.user.id,
        friendId: friend.id,
        status
      }
    })

    // Notify friend via socket
    const io = req.app.get('io')
    if (status === 'PENDING') {
      io.to(`user-${friend.id}`).emit('friend-request', {
        from: req.user
      })
    } else {
      // For auto-accepted, notify both parties
      io.to(`user-${friend.id}`).emit('new-friend', {
        friend: req.user
      })
    }

    // Check achievements when friend is added (auto-accepted)
    let newAchievements = []
    if (status === 'ACCEPTED') {
      newAchievements = await achievementService.checkAchievements(req.user.id, {
        friendAdded: true
      })
    }

    res.status(201).json({
      friendship,
      autoAccepted: status === 'ACCEPTED',
      message: status === 'ACCEPTED'
        ? `You are now following ${friend.name}`
        : `Friend request sent to ${friend.name}`,
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

// PATCH /api/social/request/:id - Accept/reject request
router.patch('/request/:id', async (req, res, next) => {
  try {
    const { status } = req.body // 'ACCEPTED' or 'REJECTED'

    const friendship = await prisma.friendship.update({
      where: { id: req.params.id },
      data: { status }
    })

    // Check achievements when friend request is accepted
    let newAchievements = []
    if (status === 'ACCEPTED') {
      newAchievements = await achievementService.checkAchievements(req.user.id, {
        friendAdded: true
      })
    }

    res.json({
      friendship,
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

// DELETE /api/social/friend/:id - Remove friend
router.delete('/friend/:id', async (req, res, next) => {
  try {
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: req.user.id, friendId: req.params.id },
          { userId: req.params.id, friendId: req.user.id }
        ]
      }
    })

    // Update user stats to track friend removal
    await achievementService.checkAchievements(req.user.id, {
      friendRemoved: true
    })

    res.json({ message: 'Friend removed' })
  } catch (error) {
    next(error)
  }
})

// GET /api/social/friends/today - Friends who worked out today
router.get('/friends/today', async (req, res, next) => {
  try {
    // Get friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: req.user.id, status: 'ACCEPTED' },
          { friendId: req.user.id, status: 'ACCEPTED' }
        ]
      }
    })

    const friendIds = friendships.map(f =>
      f.userId === req.user.id ? f.friendId : f.userId
    )

    if (friendIds.length === 0) {
      return res.json({ friends: [] })
    }

    // Get today's date range
    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))

    // Find friends who completed workouts today
    const workoutsToday = await prisma.workoutSession.findMany({
      where: {
        userId: { in: friendIds },
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      select: {
        userId: true,
        user: {
          select: { id: true, name: true, username: true }
        }
      },
      distinct: ['userId']
    })

    const friends = workoutsToday.map(w => w.user)
    res.json({ friends })
  } catch (error) {
    next(error)
  }
})

// GET /api/social/friends/prs - Friends who hit PRs today
router.get('/friends/prs', async (req, res, next) => {
  try {
    // Get friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: req.user.id, status: 'ACCEPTED' },
          { friendId: req.user.id, status: 'ACCEPTED' }
        ]
      }
    })

    const friendIds = friendships.map(f =>
      f.userId === req.user.id ? f.friendId : f.userId
    )

    if (friendIds.length === 0) {
      return res.json({ prs: [] })
    }

    // Get today's date range
    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))

    // Find PRs from today
    const prsToday = await prisma.personalRecord.findMany({
      where: {
        userId: { in: friendIds },
        achievedAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        user: {
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: { achievedAt: 'desc' },
      take: 10
    })

    const prs = prsToday.map(pr => ({
      id: pr.id,
      user: pr.user,
      exerciseName: pr.exerciseName,
      weight: pr.weight,
      reps: pr.reps,
      achievedAt: pr.achievedAt
    }))

    res.json({ prs })
  } catch (error) {
    next(error)
  }
})

// GET /api/social/friends/streaks - Top friend streaks
router.get('/friends/streaks', async (req, res, next) => {
  try {
    // Get friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: req.user.id, status: 'ACCEPTED' },
          { friendId: req.user.id, status: 'ACCEPTED' }
        ]
      }
    })

    const friendIds = friendships.map(f =>
      f.userId === req.user.id ? f.friendId : f.userId
    )

    if (friendIds.length === 0) {
      return res.json({ streaks: [] })
    }

    // Get all workouts for friends to calculate streaks
    const workouts = await prisma.workoutSession.findMany({
      where: { userId: { in: friendIds } },
      select: { userId: true, date: true },
      orderBy: { date: 'desc' }
    })

    // Calculate streaks for each friend
    const streakMap = new Map()
    friendIds.forEach(id => streakMap.set(id, 0))

    friendIds.forEach(friendId => {
      const friendWorkouts = workouts
        .filter(w => w.userId === friendId)
        .map(w => new Date(w.date).toDateString())

      const uniqueDates = [...new Set(friendWorkouts)]
      let streak = 0
      const today = new Date()

      for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today)
        checkDate.setDate(checkDate.getDate() - i)
        const dateStr = checkDate.toDateString()

        if (uniqueDates.includes(dateStr)) {
          streak++
        } else if (i > 0) {
          break
        }
      }

      streakMap.set(friendId, streak)
    })

    // Get user info
    const users = await prisma.user.findMany({
      where: { id: { in: friendIds } },
      select: { id: true, name: true, username: true }
    })

    const streaks = users
      .map(user => ({
        ...user,
        streak: streakMap.get(user.id) || 0
      }))
      .filter(u => u.streak > 0)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 5)

    res.json({ streaks })
  } catch (error) {
    next(error)
  }
})

// GET /api/social/friends/achievements - Recent friend milestone achievements
router.get('/friends/achievements', async (req, res, next) => {
  try {
    // Get friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: req.user.id, status: 'ACCEPTED' },
          { friendId: req.user.id, status: 'ACCEPTED' }
        ]
      }
    })

    const friendIds = friendships.map(f =>
      f.userId === req.user.id ? f.friendId : f.userId
    )

    if (friendIds.length === 0) {
      return res.json({ achievements: [] })
    }

    // Get workout counts and PR counts for each friend
    const [workoutCounts, prCounts, users] = await Promise.all([
      prisma.workoutSession.groupBy({
        by: ['userId'],
        where: { userId: { in: friendIds } },
        _count: true
      }),
      prisma.personalRecord.groupBy({
        by: ['userId'],
        where: { userId: { in: friendIds } },
        _count: true
      }),
      prisma.user.findMany({
        where: { id: { in: friendIds } },
        select: { id: true, name: true, username: true }
      })
    ])

    // Calculate streaks (simplified)
    const workouts = await prisma.workoutSession.findMany({
      where: { userId: { in: friendIds } },
      select: { userId: true, date: true },
      orderBy: { date: 'desc' }
    })

    const streakMap = new Map()
    friendIds.forEach(friendId => {
      const friendWorkouts = workouts
        .filter(w => w.userId === friendId)
        .map(w => new Date(w.date).toDateString())
      const uniqueDates = [...new Set(friendWorkouts)]
      let streak = 0
      const today = new Date()
      for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today)
        checkDate.setDate(checkDate.getDate() - i)
        if (uniqueDates.includes(checkDate.toDateString())) {
          streak++
        } else if (i > 0) {
          break
        }
      }
      streakMap.set(friendId, streak)
    })

    // Define milestones
    const milestones = [
      { id: 'first_workout', name: 'First Workout', threshold: 1, type: 'workouts', icon: '🎯' },
      { id: 'getting_started', name: 'Getting Started', threshold: 10, type: 'workouts', icon: '🚀' },
      { id: 'committed', name: 'Committed', threshold: 50, type: 'workouts', icon: '💪' },
      { id: 'century_club', name: 'Century Club', threshold: 100, type: 'workouts', icon: '🏅' },
      { id: 'week_warrior', name: 'Week Warrior', threshold: 7, type: 'streak', icon: '🔥' },
      { id: 'monthly_master', name: 'Monthly Master', threshold: 30, type: 'streak', icon: '⚡' },
      { id: 'pr_machine', name: 'PR Machine', threshold: 10, type: 'prs', icon: '🏆' }
    ]

    // Calculate achievements for each friend
    const achievements = []
    users.forEach(user => {
      const workoutCount = workoutCounts.find(w => w.userId === user.id)?._count || 0
      const prCount = prCounts.find(p => p.userId === user.id)?._count || 0
      const streak = streakMap.get(user.id) || 0

      milestones.forEach(milestone => {
        let achieved = false
        if (milestone.type === 'workouts' && workoutCount >= milestone.threshold) {
          achieved = true
        } else if (milestone.type === 'streak' && streak >= milestone.threshold) {
          achieved = true
        } else if (milestone.type === 'prs' && prCount >= milestone.threshold) {
          achieved = true
        }

        if (achieved) {
          achievements.push({
            user,
            milestone: milestone.name,
            icon: milestone.icon,
            // Priority for sorting (higher thresholds = more impressive)
            priority: milestone.threshold
          })
        }
      })
    })

    // Sort by priority (most impressive first) and take top achievements
    const topAchievements = achievements
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5)

    res.json({ achievements: topAchievements })
  } catch (error) {
    next(error)
  }
})

// Helper: Calculate streak with rest day tolerance
// Rules: Max 2 consecutive rest days AND max 2 rest days per rolling 7-day week
function calculateStreakWithRestDays(workoutDates) {
  if (workoutDates.length === 0) return 0

  const uniqueDates = [...new Set(workoutDates)].sort((a, b) => new Date(b) - new Date(a))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let streak = 0
  let consecutiveRestDays = 0
  let weekRestDays = [] // Track rest days in rolling 7-day window

  for (let i = 0; i <= 365; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)
    const dateStr = checkDate.toDateString()

    // Clean up rest days older than 7 days from current check date
    weekRestDays = weekRestDays.filter(d => {
      const daysDiff = (checkDate - new Date(d)) / (1000 * 60 * 60 * 24)
      return daysDiff >= 0 && daysDiff < 7
    })

    if (uniqueDates.includes(dateStr)) {
      streak++
      consecutiveRestDays = 0
    } else if (streak > 0) {
      consecutiveRestDays++
      weekRestDays.push(dateStr)

      // Break streak if more than 2 consecutive rest days
      if (consecutiveRestDays > 2) {
        break
      }

      // Break streak if more than 2 rest days in the rolling week
      if (weekRestDays.length > 2) {
        break
      }
    }
  }

  return streak
}

// Helper: Get date range based on period
function getDateRange(period) {
  const now = new Date()
  let startDate = new Date(0)
  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case 'year':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      break
  }
  return startDate
}

// GET /api/social/leaderboard/global - App-wide leaderboard
router.get('/leaderboard/global', async (req, res, next) => {
  try {
    const { category = 'workouts', metric = 'count', period = 'week', limit = 10 } = req.query
    const startDate = getDateRange(period)

    // Get users who show on leaderboard
    const eligibleUsers = await prisma.user.findMany({
      where: {
        settings: {
          showOnLeaderboard: true
        }
      },
      select: { id: true, name: true, username: true }
    })

    const userIds = eligibleUsers.map(u => u.id)
    let leaderboard = []
    let userRank = 0

    if (category === 'workouts') {
      if (metric === 'time') {
        // Total workout time
        const workoutTimes = await prisma.workoutSession.groupBy({
          by: ['userId'],
          where: {
            userId: { in: userIds },
            date: { gte: startDate },
            duration: { not: null }
          },
          _sum: { duration: true }
        })

        leaderboard = eligibleUsers
          .map(user => ({
            ...user,
            totalSeconds: workoutTimes.find(w => w.userId === user.id)?._sum?.duration || 0,
            isCurrentUser: user.id === req.user.id
          }))
          .sort((a, b) => b.totalSeconds - a.totalSeconds)
          .slice(0, parseInt(limit))

        const allRanked = eligibleUsers
          .map(user => ({
            id: user.id,
            value: workoutTimes.find(w => w.userId === user.id)?._sum?.duration || 0
          }))
          .sort((a, b) => b.value - a.value)
        userRank = allRanked.findIndex(u => u.id === req.user.id) + 1
      } else {
        // Workout count
        const workoutCounts = await prisma.workoutSession.groupBy({
          by: ['userId'],
          where: {
            userId: { in: userIds },
            date: { gte: startDate }
          },
          _count: true
        })

        leaderboard = eligibleUsers
          .map(user => ({
            ...user,
            workoutCount: workoutCounts.find(w => w.userId === user.id)?._count || 0,
            isCurrentUser: user.id === req.user.id
          }))
          .sort((a, b) => b.workoutCount - a.workoutCount)
          .slice(0, parseInt(limit))

        const allRanked = eligibleUsers
          .map(user => ({
            id: user.id,
            value: workoutCounts.find(w => w.userId === user.id)?._count || 0
          }))
          .sort((a, b) => b.value - a.value)
        userRank = allRanked.findIndex(u => u.id === req.user.id) + 1
      }
    } else if (category === 'streak') {
      // Streak leaderboard with rest day tolerance
      const workouts = await prisma.workoutSession.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, date: true },
        orderBy: { date: 'desc' }
      })

      const streakMap = new Map()
      userIds.forEach(userId => {
        const userWorkouts = workouts
          .filter(w => w.userId === userId)
          .map(w => new Date(w.date).toDateString())
        streakMap.set(userId, calculateStreakWithRestDays(userWorkouts))
      })

      leaderboard = eligibleUsers
        .map(user => ({
          ...user,
          streak: streakMap.get(user.id) || 0,
          isCurrentUser: user.id === req.user.id
        }))
        .sort((a, b) => b.streak - a.streak)
        .slice(0, parseInt(limit))

      const allRanked = eligibleUsers
        .map(user => ({
          id: user.id,
          value: streakMap.get(user.id) || 0
        }))
        .sort((a, b) => b.value - a.value)
      userRank = allRanked.findIndex(u => u.id === req.user.id) + 1

    } else if (category === 'running' || category === 'cycling') {
      // Cardio leaderboards - look for cardio exercises in workout sessions
      const cardioType = category === 'running' ? 'Running' : 'Cycling'

      // Get cardio exercises from workout sessions
      const cardioLogs = await prisma.exerciseLog.findMany({
        where: {
          session: {
            userId: { in: userIds },
            date: { gte: startDate }
          },
          exercise: {
            name: { contains: cardioType, mode: 'insensitive' }
          }
        },
        include: {
          session: { select: { userId: true } },
          sets: true
        }
      })

      // Aggregate by user - distance in miles and time in minutes
      const userStats = new Map()
      userIds.forEach(id => userStats.set(id, { miles: 0, totalMinutes: 0 }))

      cardioLogs.forEach(log => {
        const userId = log.session.userId
        const stats = userStats.get(userId)
        log.sets.forEach(set => {
          // Assume distance stored in 'distance' field (miles) and time in 'time' field (seconds)
          if (set.distance) stats.miles += set.distance
          if (set.time) stats.totalMinutes += set.time / 60
        })
      })

      if (metric === 'pace') {
        // Average pace (minutes per mile) - lower is better
        leaderboard = eligibleUsers
          .map(user => {
            const stats = userStats.get(user.id)
            const avgPace = stats.miles > 0 ? (stats.totalMinutes / stats.miles).toFixed(1) : null
            return {
              ...user,
              avgPace,
              miles: stats.miles.toFixed(1),
              isCurrentUser: user.id === req.user.id
            }
          })
          .filter(u => u.avgPace !== null)
          .sort((a, b) => parseFloat(a.avgPace) - parseFloat(b.avgPace)) // Lower pace is better
          .slice(0, parseInt(limit))

        userRank = leaderboard.findIndex(u => u.id === req.user.id) + 1
      } else {
        // Total miles
        leaderboard = eligibleUsers
          .map(user => {
            const stats = userStats.get(user.id)
            return {
              ...user,
              miles: stats.miles.toFixed(1),
              isCurrentUser: user.id === req.user.id
            }
          })
          .sort((a, b) => parseFloat(b.miles) - parseFloat(a.miles))
          .slice(0, parseInt(limit))

        const allRanked = eligibleUsers
          .map(user => ({
            id: user.id,
            value: userStats.get(user.id)?.miles || 0
          }))
          .sort((a, b) => b.value - a.value)
        userRank = allRanked.findIndex(u => u.id === req.user.id) + 1
      }
    }

    res.json({ leaderboard, userRank, category, metric, period })
  } catch (error) {
    next(error)
  }
})

// GET /api/social/leaderboard/friends - Friends-only leaderboard
router.get('/leaderboard/friends', async (req, res, next) => {
  try {
    const { category = 'workouts', metric = 'count', period = 'week', limit = 10 } = req.query
    const startDate = getDateRange(period)

    // Get friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: req.user.id, status: 'ACCEPTED' },
          { friendId: req.user.id, status: 'ACCEPTED' }
        ]
      }
    })

    const friendIds = friendships.map(f =>
      f.userId === req.user.id ? f.friendId : f.userId
    )
    friendIds.push(req.user.id) // Include current user

    const users = await prisma.user.findMany({
      where: { id: { in: friendIds } },
      select: { id: true, name: true, username: true }
    })

    let leaderboard = []
    let userRank = 0

    if (category === 'workouts') {
      if (metric === 'time') {
        const workoutTimes = await prisma.workoutSession.groupBy({
          by: ['userId'],
          where: {
            userId: { in: friendIds },
            date: { gte: startDate },
            duration: { not: null }
          },
          _sum: { duration: true }
        })

        leaderboard = users
          .map(user => ({
            ...user,
            totalSeconds: workoutTimes.find(w => w.userId === user.id)?._sum?.duration || 0,
            isCurrentUser: user.id === req.user.id
          }))
          .sort((a, b) => b.totalSeconds - a.totalSeconds)
          .slice(0, parseInt(limit))
      } else {
        const workoutCounts = await prisma.workoutSession.groupBy({
          by: ['userId'],
          where: {
            userId: { in: friendIds },
            date: { gte: startDate }
          },
          _count: true
        })

        leaderboard = users
          .map(user => ({
            ...user,
            workoutCount: workoutCounts.find(w => w.userId === user.id)?._count || 0,
            isCurrentUser: user.id === req.user.id
          }))
          .sort((a, b) => b.workoutCount - a.workoutCount)
          .slice(0, parseInt(limit))
      }
    } else if (category === 'streak') {
      const workouts = await prisma.workoutSession.findMany({
        where: { userId: { in: friendIds } },
        select: { userId: true, date: true },
        orderBy: { date: 'desc' }
      })

      const streakMap = new Map()
      friendIds.forEach(userId => {
        const userWorkouts = workouts
          .filter(w => w.userId === userId)
          .map(w => new Date(w.date).toDateString())
        streakMap.set(userId, calculateStreakWithRestDays(userWorkouts))
      })

      leaderboard = users
        .map(user => ({
          ...user,
          streak: streakMap.get(user.id) || 0,
          isCurrentUser: user.id === req.user.id
        }))
        .sort((a, b) => b.streak - a.streak)
        .slice(0, parseInt(limit))

    } else if (category === 'running' || category === 'cycling') {
      const cardioType = category === 'running' ? 'Running' : 'Cycling'

      const cardioLogs = await prisma.exerciseLog.findMany({
        where: {
          session: {
            userId: { in: friendIds },
            date: { gte: startDate }
          },
          exercise: {
            name: { contains: cardioType, mode: 'insensitive' }
          }
        },
        include: {
          session: { select: { userId: true } },
          sets: true
        }
      })

      const userStats = new Map()
      friendIds.forEach(id => userStats.set(id, { miles: 0, totalMinutes: 0 }))

      cardioLogs.forEach(log => {
        const userId = log.session.userId
        const stats = userStats.get(userId)
        log.sets.forEach(set => {
          if (set.distance) stats.miles += set.distance
          if (set.time) stats.totalMinutes += set.time / 60
        })
      })

      if (metric === 'pace') {
        leaderboard = users
          .map(user => {
            const stats = userStats.get(user.id)
            const avgPace = stats.miles > 0 ? (stats.totalMinutes / stats.miles).toFixed(1) : null
            return {
              ...user,
              avgPace,
              miles: stats.miles.toFixed(1),
              isCurrentUser: user.id === req.user.id
            }
          })
          .filter(u => u.avgPace !== null)
          .sort((a, b) => parseFloat(a.avgPace) - parseFloat(b.avgPace))
          .slice(0, parseInt(limit))
      } else {
        leaderboard = users
          .map(user => {
            const stats = userStats.get(user.id)
            return {
              ...user,
              miles: stats.miles.toFixed(1),
              isCurrentUser: user.id === req.user.id
            }
          })
          .sort((a, b) => parseFloat(b.miles) - parseFloat(a.miles))
          .slice(0, parseInt(limit))
      }
    }

    // Calculate user rank
    userRank = leaderboard.findIndex(u => u.id === req.user.id) + 1

    res.json({ leaderboard, userRank, category, metric, period })
  } catch (error) {
    next(error)
  }
})

// GET /api/social/leaderboard
router.get('/leaderboard', async (req, res, next) => {
  try {
    const { period = 'week' } = req.query

    // Get friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: req.user.id, status: 'ACCEPTED' },
          { friendId: req.user.id, status: 'ACCEPTED' }
        ]
      }
    })

    const friendIds = friendships.map(f =>
      f.userId === req.user.id ? f.friendId : f.userId
    )
    friendIds.push(req.user.id)

    // Calculate date range
    const now = new Date()
    let startDate
    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7))
        break
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1))
        break
      default:
        startDate = new Date(0)
    }

    // Get workout counts
    const stats = await prisma.workoutSession.groupBy({
      by: ['userId'],
      where: {
        userId: { in: friendIds },
        date: { gte: startDate }
      },
      _count: true
    })

    // Get user info
    const users = await prisma.user.findMany({
      where: { id: { in: friendIds } },
      select: { id: true, name: true, username: true }
    })

    const leaderboard = users.map(user => ({
      ...user,
      workouts: stats.find(s => s.userId === user.id)?._count || 0,
      isCurrentUser: user.id === req.user.id
    })).sort((a, b) => b.workouts - a.workouts)

    res.json({ leaderboard })
  } catch (error) {
    next(error)
  }
})

export default router
