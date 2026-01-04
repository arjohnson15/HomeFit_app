import prisma from '../lib/prisma.js'
import notificationService from './notifications.js'

class FollowNotificationService {
  constructor() {
    this.io = null
  }

  setSocketIO(io) {
    this.io = io
  }

  // Notify followers when a user completes a workout
  async notifyWorkoutCompleted(userId, workoutData) {
    const { workoutName, duration, exerciseCount } = workoutData

    try {
      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, username: true }
      })

      if (!user) return

      // Get followers who want workout notifications
      const followers = await prisma.friendFollow.findMany({
        where: {
          followedId: userId,
          notifyWorkouts: true
        },
        include: {
          follower: {
            include: { settings: true }
          }
        }
      })

      for (const follow of followers) {
        const follower = follow.follower
        // Check if follower has social notifications enabled
        if (!follower.settings?.socialNotifications) continue

        const title = `${user.name} completed a workout!`
        const durationMin = Math.round(duration / 60)
        const body = `${workoutName} - ${durationMin} min, ${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`

        // Create in-app notification
        const notification = await prisma.inAppNotification.create({
          data: {
            userId: follower.id,
            type: 'FRIEND_WORKOUT_COMPLETED',
            title,
            body,
            data: {
              friendId: userId,
              friendName: user.name,
              workoutName,
              duration,
              exerciseCount
            }
          }
        })

        // Send real-time via Socket.io
        if (this.io) {
          this.io.to(`user-${follower.id}`).emit('notification:new', notification)
        }

        // Send push notification
        await notificationService.sendPush(follower.id, title, body, {
          url: `/friend/${userId}`
        })
      }

      console.log(`Notified ${followers.length} followers of workout completion for user ${userId}`)
    } catch (error) {
      console.error('Error notifying followers of workout:', error)
    }
  }

  // Notify followers when a user unlocks an achievement
  async notifyAchievementUnlocked(userId, achievement) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, username: true }
      })

      if (!user) return

      const followers = await prisma.friendFollow.findMany({
        where: {
          followedId: userId,
          notifyAchievements: true
        },
        include: {
          follower: {
            include: { settings: true }
          }
        }
      })

      for (const follow of followers) {
        const follower = follow.follower
        if (!follower.settings?.socialNotifications) continue

        const title = `${user.name} unlocked an achievement!`
        const body = `${achievement.icon || ''} ${achievement.name}`.trim()

        const notification = await prisma.inAppNotification.create({
          data: {
            userId: follower.id,
            type: 'FRIEND_ACHIEVEMENT_UNLOCKED',
            title,
            body,
            data: {
              friendId: userId,
              friendName: user.name,
              achievementId: achievement.id,
              achievementName: achievement.name,
              achievementIcon: achievement.icon,
              achievementRarity: achievement.rarity
            }
          }
        })

        if (this.io) {
          this.io.to(`user-${follower.id}`).emit('notification:new', notification)
        }

        await notificationService.sendPush(follower.id, title, body, {
          url: `/friend/${userId}`
        })
      }

      console.log(`Notified ${followers.length} followers of achievement for user ${userId}`)
    } catch (error) {
      console.error('Error notifying followers of achievement:', error)
    }
  }

  // Notify followers when a user hits a streak milestone
  async notifyStreakMilestone(userId, streak) {
    // Only notify for significant milestones
    const milestones = [7, 30, 90, 180, 365]
    if (!milestones.includes(streak) && streak < 90) return

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, username: true }
      })

      if (!user) return

      const followers = await prisma.friendFollow.findMany({
        where: {
          followedId: userId,
          notifyStreaks: true
        },
        include: {
          follower: {
            include: { settings: true }
          }
        }
      })

      // Determine milestone description
      let milestoneText = `${streak} day streak!`
      if (streak === 7) milestoneText = 'Week Warrior - 7 day streak!'
      else if (streak === 30) milestoneText = 'Monthly Master - 30 day streak!'
      else if (streak === 90) milestoneText = 'Quarterly Champion - 90 day streak!'
      else if (streak === 180) milestoneText = '6 Month Legend - 180 day streak!'
      else if (streak === 365) milestoneText = 'Year of Gains - 365 day streak!'

      for (const follow of followers) {
        const follower = follow.follower
        if (!follower.settings?.socialNotifications) continue

        const title = `${user.name} hit a streak milestone!`
        const body = milestoneText

        const notification = await prisma.inAppNotification.create({
          data: {
            userId: follower.id,
            type: 'FRIEND_STREAK_MILESTONE',
            title,
            body,
            data: {
              friendId: userId,
              friendName: user.name,
              streak,
              milestoneText
            }
          }
        })

        if (this.io) {
          this.io.to(`user-${follower.id}`).emit('notification:new', notification)
        }

        await notificationService.sendPush(follower.id, title, body, {
          url: `/friend/${userId}`
        })
      }

      console.log(`Notified ${followers.length} followers of streak milestone for user ${userId}`)
    } catch (error) {
      console.error('Error notifying followers of streak:', error)
    }
  }
}

const followNotificationService = new FollowNotificationService()
export default followNotificationService
