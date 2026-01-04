import prisma from '../lib/prisma.js'
import notificationService from './notifications.js'
import followNotificationService from './followNotifications.js'

// Default achievements to seed
const DEFAULT_ACHIEVEMENTS = [
  // Workout Milestones
  { name: 'First Steps', description: 'Complete your first workout', icon: '🎯', category: 'WORKOUT', metricType: 'TOTAL_WORKOUTS', threshold: 1, rarity: 'COMMON', points: 10, sortOrder: 1 },
  { name: 'Getting Started', description: 'Complete 10 workouts', icon: '💪', category: 'WORKOUT', metricType: 'TOTAL_WORKOUTS', threshold: 10, rarity: 'COMMON', points: 25, sortOrder: 2 },
  { name: 'Committed', description: 'Complete 50 workouts', icon: '🏋️', category: 'WORKOUT', metricType: 'TOTAL_WORKOUTS', threshold: 50, rarity: 'UNCOMMON', points: 50, sortOrder: 3 },
  { name: 'Century Club', description: 'Complete 100 workouts', icon: '💯', category: 'WORKOUT', metricType: 'TOTAL_WORKOUTS', threshold: 100, rarity: 'RARE', points: 100, sortOrder: 4 },
  { name: 'Iron Will', description: 'Complete 500 workouts', icon: '🏆', category: 'WORKOUT', metricType: 'TOTAL_WORKOUTS', threshold: 500, rarity: 'LEGENDARY', points: 500, sortOrder: 5 },

  // Streak Milestones
  { name: 'Week Warrior', description: 'Maintain a 7-day workout streak', icon: '🔥', category: 'STREAK', metricType: 'CURRENT_STREAK', threshold: 7, rarity: 'COMMON', points: 25, sortOrder: 1 },
  { name: 'Monthly Master', description: 'Maintain a 30-day workout streak', icon: '⚡', category: 'STREAK', metricType: 'LONGEST_STREAK', threshold: 30, rarity: 'RARE', points: 100, sortOrder: 2 },
  { name: 'Quarterly Champion', description: 'Achieve a 90-day workout streak', icon: '🌟', category: 'STREAK', metricType: 'LONGEST_STREAK', threshold: 90, rarity: 'EPIC', points: 250, sortOrder: 3 },
  { name: 'Year of Gains', description: 'Achieve a 365-day workout streak', icon: '👑', category: 'STREAK', metricType: 'LONGEST_STREAK', threshold: 365, rarity: 'LEGENDARY', points: 1000, sortOrder: 4 },

  // PR Milestones
  { name: 'PR Beginner', description: 'Set your first personal record', icon: '📈', category: 'PR', metricType: 'TOTAL_PRS', threshold: 1, rarity: 'COMMON', points: 10, sortOrder: 1 },
  { name: 'PR Hunter', description: 'Set 10 personal records', icon: '🎖️', category: 'PR', metricType: 'TOTAL_PRS', threshold: 10, rarity: 'UNCOMMON', points: 50, sortOrder: 2 },
  { name: 'PR Machine', description: 'Set 50 personal records', icon: '🥇', category: 'PR', metricType: 'TOTAL_PRS', threshold: 50, rarity: 'RARE', points: 150, sortOrder: 3 },

  // Time-Based
  { name: 'Hour One', description: 'Log 1 hour of total workout time', icon: '⏱️', category: 'TIME', metricType: 'TOTAL_WORKOUT_HOURS', threshold: 1, rarity: 'COMMON', points: 10, sortOrder: 1 },
  { name: 'Ten Hours', description: 'Log 10 hours of total workout time', icon: '⏰', category: 'TIME', metricType: 'TOTAL_WORKOUT_HOURS', threshold: 10, rarity: 'UNCOMMON', points: 50, sortOrder: 2 },
  { name: 'Fifty Hours', description: 'Log 50 hours of total workout time', icon: '🕐', category: 'TIME', metricType: 'TOTAL_WORKOUT_HOURS', threshold: 50, rarity: 'RARE', points: 150, sortOrder: 3 },
  { name: 'Century Hours', description: 'Log 100 hours of total workout time', icon: '⌛', category: 'TIME', metricType: 'TOTAL_WORKOUT_HOURS', threshold: 100, rarity: 'EPIC', points: 300, sortOrder: 4 },

  // Nutrition
  { name: 'First Bite', description: 'Log your first meal', icon: '🍽️', category: 'NUTRITION', metricType: 'TOTAL_MEALS_LOGGED', threshold: 1, rarity: 'COMMON', points: 10, sortOrder: 1 },
  { name: 'Food Tracker', description: 'Log 50 meals', icon: '📋', category: 'NUTRITION', metricType: 'TOTAL_MEALS_LOGGED', threshold: 50, rarity: 'UNCOMMON', points: 50, sortOrder: 2 },
  { name: 'Nutrition Ninja', description: 'Log 200 meals', icon: '🥗', category: 'NUTRITION', metricType: 'TOTAL_MEALS_LOGGED', threshold: 200, rarity: 'RARE', points: 150, sortOrder: 3 },

  // Social
  { name: 'First Friend', description: 'Add your first friend', icon: '🤝', category: 'SOCIAL', metricType: 'TOTAL_FRIENDS', threshold: 1, rarity: 'COMMON', points: 10, sortOrder: 1 },
  { name: 'Social Butterfly', description: 'Have 10 friends', icon: '🦋', category: 'SOCIAL', metricType: 'TOTAL_FRIENDS', threshold: 10, rarity: 'UNCOMMON', points: 50, sortOrder: 2 }
]

class AchievementService {
  // Seed default achievements
  async seedDefaultAchievements() {
    let count = 0
    for (const achievement of DEFAULT_ACHIEVEMENTS) {
      const existing = await prisma.achievement.findFirst({
        where: {
          name: achievement.name,
          isDefault: true
        }
      })

      if (!existing) {
        await prisma.achievement.create({
          data: {
            ...achievement,
            isDefault: true
          }
        })
        count++
      }
    }
    return count
  }

  // Check and update achievements for a user after an action
  async checkAchievements(userId, context = {}) {
    try {
      // Get or create user stats
      let userStats = await this.getOrCreateUserStats(userId)

      // Update stats based on context
      userStats = await this.updateUserStats(userId, userStats, context)

      // Get all active achievements
      const achievements = await prisma.achievement.findMany({
        where: { isActive: true }
      })

      // Check each achievement
      const newlyUnlocked = []

      for (const achievement of achievements) {
        const result = await this.checkSingleAchievement(userId, achievement, userStats)
        if (result?.justUnlocked) {
          newlyUnlocked.push(result)
        }
      }

      // Send notifications for newly unlocked achievements
      for (const ua of newlyUnlocked) {
        await this.notifyAchievementUnlock(userId, ua)
      }

      return newlyUnlocked
    } catch (error) {
      console.error('Error checking achievements:', error)
      return []
    }
  }

  async getOrCreateUserStats(userId) {
    let stats = await prisma.userStats.findUnique({
      where: { userId }
    })

    if (!stats) {
      // Calculate initial stats from existing data
      stats = await this.calculateInitialStats(userId)
    }

    return stats
  }

  async calculateInitialStats(userId) {
    // Get workout stats
    const workoutAgg = await prisma.workoutSession.aggregate({
      where: { userId, endTime: { not: null } },
      _count: true,
      _sum: { duration: true }
    })

    // Get PR count
    const prCount = await prisma.set.count({
      where: {
        isPR: true,
        log: {
          session: { userId }
        }
      }
    })

    // Get meal log count
    const mealCount = await prisma.foodLogEntry.count({
      where: { userId }
    })

    // Get friend count
    const friendCount = await prisma.friendship.count({
      where: {
        OR: [
          { userId, status: 'ACCEPTED' },
          { friendId: userId, status: 'ACCEPTED' }
        ]
      }
    })

    // Calculate streak
    const { currentStreak, longestStreak, lastWorkoutDate } = await this.calculateStreaks(userId)

    // Create stats record
    return prisma.userStats.create({
      data: {
        userId,
        totalWorkouts: workoutAgg._count || 0,
        totalWorkoutSeconds: workoutAgg._sum.duration || 0,
        totalPRs: prCount,
        totalMealsLogged: mealCount,
        totalFriends: friendCount,
        currentStreak,
        longestStreak,
        lastWorkoutDate
      }
    })
  }

  async calculateStreaks(userId) {
    const workouts = await prisma.workoutSession.findMany({
      where: { userId, endTime: { not: null } },
      orderBy: { date: 'desc' },
      select: { date: true }
    })

    if (workouts.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastWorkoutDate: null }
    }

    // Get unique workout dates (normalized to start of day)
    const uniqueDates = [...new Set(workouts.map(w => {
      const d = new Date(w.date)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }))].sort((a, b) => b - a) // Sort descending

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTime = today.getTime()

    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 1
    let prevDate = null

    for (let i = 0; i < uniqueDates.length; i++) {
      const dateTime = uniqueDates[i]

      if (i === 0) {
        // Check if most recent workout is today or yesterday
        const daysSinceWorkout = Math.floor((todayTime - dateTime) / (1000 * 60 * 60 * 24))
        if (daysSinceWorkout <= 1) {
          currentStreak = 1
          prevDate = dateTime
        } else {
          // Streak is broken
          longestStreak = Math.max(longestStreak, 1)
          break
        }
      } else {
        // Check if this date is consecutive (1 day before previous)
        const dayDiff = Math.floor((prevDate - dateTime) / (1000 * 60 * 60 * 24))
        if (dayDiff === 1) {
          tempStreak++
          currentStreak = tempStreak
          prevDate = dateTime
        } else {
          // Streak broken
          break
        }
      }
    }

    longestStreak = Math.max(currentStreak, longestStreak)

    // Also check for longest historical streak (full pass)
    tempStreak = 1
    for (let i = 1; i < uniqueDates.length; i++) {
      const dayDiff = Math.floor((uniqueDates[i - 1] - uniqueDates[i]) / (1000 * 60 * 60 * 24))
      if (dayDiff === 1) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        tempStreak = 1
      }
    }

    return {
      currentStreak,
      longestStreak,
      lastWorkoutDate: workouts[0]?.date || null
    }
  }

  async updateUserStats(userId, currentStats, context) {
    const updates = {}

    if (context.workoutCompleted) {
      updates.totalWorkouts = { increment: 1 }
      if (context.duration) {
        updates.totalWorkoutSeconds = { increment: context.duration }
      }
      updates.lastWorkoutDate = new Date()

      // Recalculate streak
      const { currentStreak, longestStreak } = await this.calculateStreaks(userId)
      updates.currentStreak = currentStreak
      updates.longestStreak = Math.max(longestStreak, currentStats.longestStreak)

      // Check for streak milestone and notify followers
      const streakMilestones = [7, 30, 90, 180, 365]
      if (streakMilestones.includes(currentStreak) && currentStreak > (currentStats.currentStreak || 0)) {
        followNotificationService.notifyStreakMilestone(userId, currentStreak)
      }
    }

    if (context.prSet) {
      updates.totalPRs = { increment: context.prCount || 1 }
    }

    if (context.mealLogged) {
      updates.totalMealsLogged = { increment: 1 }
    }

    if (context.friendAdded) {
      updates.totalFriends = { increment: 1 }
    }

    if (context.friendRemoved) {
      updates.totalFriends = { decrement: 1 }
    }

    // Goal completions
    if (context.goalCompleted) {
      updates.totalGoalsCompleted = { increment: 1 }

      // Track specific goal type completions
      if (context.goalType === 'WEIGHT_LOSS' || context.goalType === 'WEIGHT_GAIN') {
        updates.weightGoalsCompleted = { increment: 1 }
      } else if (context.goalType === 'EXERCISE_STRENGTH') {
        updates.strengthGoalsCompleted = { increment: 1 }
      } else if (context.goalType === 'CARDIO_TIME' || context.goalType === 'CARDIO_DISTANCE') {
        updates.cardioGoalsCompleted = { increment: 1 }
      }
    }

    if (Object.keys(updates).length > 0) {
      return prisma.userStats.update({
        where: { userId },
        data: updates
      })
    }

    return currentStats
  }

  async checkSingleAchievement(userId, achievement, userStats) {
    // Get or create user achievement record
    let userAchievement = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: { userId, achievementId: achievement.id }
      },
      include: { achievement: true }
    })

    // Already unlocked, skip
    if (userAchievement?.isUnlocked) {
      return userAchievement
    }

    // Calculate current progress based on metric type
    const progress = this.getProgressForMetric(achievement.metricType, userStats)

    // Check if threshold met
    const shouldUnlock = progress >= achievement.threshold

    if (!userAchievement) {
      userAchievement = await prisma.userAchievement.create({
        data: {
          userId,
          achievementId: achievement.id,
          currentProgress: progress,
          isUnlocked: shouldUnlock,
          unlockedAt: shouldUnlock ? new Date() : null
        },
        include: { achievement: true }
      })

      if (shouldUnlock) {
        userAchievement.justUnlocked = true
      }
    } else if (shouldUnlock && !userAchievement.isUnlocked) {
      userAchievement = await prisma.userAchievement.update({
        where: { id: userAchievement.id },
        data: {
          currentProgress: progress,
          isUnlocked: true,
          unlockedAt: new Date()
        },
        include: { achievement: true }
      })
      userAchievement.justUnlocked = true
    } else {
      // Update progress only
      userAchievement = await prisma.userAchievement.update({
        where: { id: userAchievement.id },
        data: { currentProgress: progress },
        include: { achievement: true }
      })
    }

    return userAchievement
  }

  getProgressForMetric(metricType, userStats) {
    switch (metricType) {
      case 'TOTAL_WORKOUTS':
        return userStats.totalWorkouts || 0
      case 'CURRENT_STREAK':
        return userStats.currentStreak || 0
      case 'LONGEST_STREAK':
        return userStats.longestStreak || 0
      case 'TOTAL_PRS':
        return userStats.totalPRs || 0
      case 'TOTAL_WORKOUT_HOURS':
        return Math.floor((userStats.totalWorkoutSeconds || 0) / 3600)
      case 'TOTAL_MEALS_LOGGED':
        return userStats.totalMealsLogged || 0
      case 'CALORIE_GOAL_STREAK':
        return userStats.calorieGoalStreak || 0
      case 'TOTAL_FRIENDS':
        return userStats.totalFriends || 0
      case 'TOTAL_GOALS_COMPLETED':
        return userStats.totalGoalsCompleted || 0
      case 'WEIGHT_GOALS_COMPLETED':
        return userStats.weightGoalsCompleted || 0
      case 'STRENGTH_GOALS_COMPLETED':
        return userStats.strengthGoalsCompleted || 0
      case 'CARDIO_GOALS_COMPLETED':
        return userStats.cardioGoalsCompleted || 0
      default:
        return 0
    }
  }

  async notifyAchievementUnlock(userId, userAchievement) {
    if (userAchievement.notificationSent) return

    try {
      // Load notification service settings
      await notificationService.loadSettings()

      await notificationService.sendAchievement(userId, {
        name: userAchievement.achievement.name,
        description: userAchievement.achievement.description,
        icon: userAchievement.achievement.icon
      })

      // Notify followers of achievement unlock
      followNotificationService.notifyAchievementUnlocked(userId, {
        id: userAchievement.achievement.id,
        name: userAchievement.achievement.name,
        icon: userAchievement.achievement.icon,
        rarity: userAchievement.achievement.rarity
      })

      await prisma.userAchievement.update({
        where: { id: userAchievement.id },
        data: { notificationSent: true }
      })
    } catch (error) {
      console.error('Failed to send achievement notification:', error)
    }
  }

  // Get all achievements for a user with progress
  async getUserAchievements(userId) {
    const achievements = await prisma.achievement.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }]
    })

    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId }
    })

    const userStats = await this.getOrCreateUserStats(userId)

    // Map achievements with user progress
    return achievements.map(achievement => {
      const userAchievement = userAchievements.find(ua => ua.achievementId === achievement.id)
      const progress = this.getProgressForMetric(achievement.metricType, userStats)

      return {
        ...achievement,
        currentProgress: progress,
        isUnlocked: userAchievement?.isUnlocked || false,
        unlockedAt: userAchievement?.unlockedAt || null,
        progressPercent: Math.min(100, Math.round((progress / achievement.threshold) * 100))
      }
    })
  }

  // Get recently unlocked achievements
  async getRecentAchievements(userId, limit = 5) {
    return prisma.userAchievement.findMany({
      where: { userId, isUnlocked: true },
      orderBy: { unlockedAt: 'desc' },
      take: limit,
      include: { achievement: true }
    })
  }

  // Get user stats summary
  async getUserStatsSummary(userId) {
    const stats = await this.getOrCreateUserStats(userId)
    const achievements = await this.getUserAchievements(userId)

    const unlocked = achievements.filter(a => a.isUnlocked)
    const totalPoints = unlocked.reduce((sum, a) => sum + a.points, 0)

    return {
      stats,
      achievementSummary: {
        unlocked: unlocked.length,
        total: achievements.length,
        totalPoints
      }
    }
  }
}

const achievementService = new AchievementService()
export default achievementService
export { DEFAULT_ACHIEVEMENTS }
