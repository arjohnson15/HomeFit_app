// Workout Reminder Scheduler
// Handles cron jobs for workout reminders, streak alerts, and achievement teases
// All jobs run hourly and check each user's local timezone before sending
import cron from 'node-cron'
import prisma from '../lib/prisma.js'
import workoutReminderService from './workoutReminders.js'

// Get the current hour in a user's timezone (returns 0-23)
function getLocalHour(timezone) {
  try {
    const hour = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    }).format(new Date()))
    return hour
  } catch {
    return null
  }
}

class ReminderScheduler {
  constructor() {
    this.hourlyJob = null
    this.cacheCleanupJob = null
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) return

    console.log('[ReminderScheduler] Initializing...')

    try {
      // Check if database is ready
      const tablesExist = await this.checkTablesExist()
      if (!tablesExist) {
        console.log('[ReminderScheduler] Database tables not ready, skipping initialization')
        return
      }

      // Initialize the reminder service
      await workoutReminderService.initialize()

      // Single hourly job that processes all notification types
      // Each type checks the user's local timezone before sending
      this.hourlyJob = cron.schedule('0 * * * *', async () => {
        console.log('[ReminderScheduler] Running hourly notification check...')
        try {
          await this.processTimezoneAwareNotifications()
        } catch (error) {
          console.error('[ReminderScheduler] Hourly check failed:', error)
        }
      })

      // Schedule AI message cache cleanup daily at 3am UTC
      this.cacheCleanupJob = cron.schedule('0 3 * * *', async () => {
        console.log('[ReminderScheduler] Running AI cache cleanup...')
        try {
          await workoutReminderService.cleanupExpiredCache()
        } catch (error) {
          console.error('[ReminderScheduler] Cache cleanup failed:', error)
        }
      })

      this.initialized = true
      console.log('[ReminderScheduler] Initialized successfully')
      console.log('[ReminderScheduler] Scheduled jobs:')
      console.log('  - Hourly check: Every hour at :00 (timezone-aware)')
      console.log('    Daily reminders: At user\'s preferred time (default 9 AM local)')
      console.log('    Streak alerts: 6-10 PM local')
      console.log('    Achievement teases: 5-7 PM local')
      console.log('    Social motivation: 4-6 PM local')
      console.log('  - AI cache cleanup: 3:00 AM UTC')
    } catch (error) {
      console.error('[ReminderScheduler] Initialization failed:', error)
    }
  }

  // Process all notification types, respecting each user's timezone
  async processTimezoneAwareNotifications() {
    // Get all users with reminders enabled and their timezone
    const users = await prisma.user.findMany({
      where: {
        active: true,
        settings: {
          workoutReminders: true,
          reminderFrequency: { not: 'off' }
        }
      },
      include: {
        settings: {
          select: {
            timezone: true,
            reminderTime: true,
            workoutReminders: true
          }
        }
      }
    })

    let remindersSent = 0
    let streaksSent = 0
    let teasesSent = 0
    let socialSent = 0

    for (const user of users) {
      const tz = user.settings?.timezone || 'America/Chicago' // Fallback to Central
      const localHour = getLocalHour(tz)
      if (localHour === null) continue

      // Parse user's preferred reminder time (default "09:00")
      const preferredHour = parseInt((user.settings?.reminderTime || '09:00').split(':')[0])

      // Daily reminders: at user's preferred hour
      if (localHour === preferredHour) {
        try {
          const result = await workoutReminderService.sendReminder(user.id)
          if (result.sent) remindersSent++
        } catch (e) {
          console.error(`[ReminderScheduler] Reminder error for ${user.id}:`, e)
        }
      }

      // Streak alerts: 6-10 PM local (one per day, deduped in service)
      if (localHour >= 18 && localHour <= 22) {
        // Only process at 6 PM local (first eligible hour) to avoid repeated attempts
        if (localHour === 18) {
          // Handled in batch below
        }
      }

      // Achievement teases: 5 PM local
      // Social motivation: 4 PM local
    }

    // Batch process streak alerts, achievement teases, social motivation
    // These functions have their own per-user dedup, so safe to call once per hour
    // They iterate all eligible users internally
    const utcHour = new Date().getUTCHours()

    // Run streak alerts every 2 hours to catch different timezone windows
    if (utcHour % 2 === 0) {
      try {
        streaksSent = await workoutReminderService.checkStreakAlerts()
      } catch (e) {
        console.error('[ReminderScheduler] Streak alerts error:', e)
      }
    }

    // Run achievement teases every 3 hours
    if (utcHour % 3 === 0) {
      try {
        teasesSent = await workoutReminderService.checkAchievementTeases()
      } catch (e) {
        console.error('[ReminderScheduler] Achievement teases error:', e)
      }
    }

    // Run social motivation every 3 hours (offset by 1)
    if (utcHour % 3 === 1) {
      try {
        socialSent = await workoutReminderService.checkSocialMotivation()
      } catch (e) {
        console.error('[ReminderScheduler] Social motivation error:', e)
      }
    }

    if (remindersSent || streaksSent || teasesSent || socialSent) {
      console.log(`[ReminderScheduler] Sent: ${remindersSent} reminders, ${streaksSent} streak alerts, ${teasesSent} achievement teases, ${socialSent} social`)
    }
  }

  async checkTablesExist() {
    try {
      await prisma.$queryRaw`SELECT 1 FROM reminder_logs LIMIT 1`
      return true
    } catch (error) {
      return false
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      initialized: this.initialized,
      hourlyJobActive: this.hourlyJob?.running || false,
      cacheCleanupJobActive: this.cacheCleanupJob?.running || false
    }
  }

  // Manually trigger jobs (for testing or admin use)
  async triggerDailyReminders() {
    console.log('[ReminderScheduler] Manually triggering daily reminders...')
    return await workoutReminderService.processDailyReminders()
  }

  async triggerStreakAlerts() {
    console.log('[ReminderScheduler] Manually triggering streak alerts...')
    return await workoutReminderService.checkStreakAlerts()
  }

  async triggerAchievementTeases() {
    console.log('[ReminderScheduler] Manually triggering achievement teases...')
    return await workoutReminderService.checkAchievementTeases()
  }

  async triggerSocialMotivation() {
    console.log('[ReminderScheduler] Manually triggering social motivation...')
    return await workoutReminderService.checkSocialMotivation()
  }

  // Shutdown scheduler
  shutdown() {
    console.log('[ReminderScheduler] Shutting down...')
    if (this.hourlyJob) this.hourlyJob.stop()
    if (this.cacheCleanupJob) this.cacheCleanupJob.stop()
    this.initialized = false
  }
}

const reminderScheduler = new ReminderScheduler()
export default reminderScheduler
