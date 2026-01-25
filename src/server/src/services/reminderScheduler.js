// Workout Reminder Scheduler
// Handles cron jobs for workout reminders, streak alerts, and achievement teases
import cron from 'node-cron'
import prisma from '../lib/prisma.js'
import workoutReminderService from './workoutReminders.js'

class ReminderScheduler {
  constructor() {
    this.dailyReminderJob = null
    this.streakAlertJob = null
    this.achievementTeaseJob = null
    this.socialMotivationJob = null
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

      // Schedule daily workout reminders at 9am
      // Users can set their preferred time, but we batch process at 9am for now
      this.dailyReminderJob = cron.schedule('0 9 * * *', async () => {
        console.log('[ReminderScheduler] Running daily reminders...')
        try {
          const result = await workoutReminderService.processDailyReminders()
          console.log(`[ReminderScheduler] Daily reminders: ${result.sent} sent, ${result.skipped} skipped`)
        } catch (error) {
          console.error('[ReminderScheduler] Daily reminders failed:', error)
        }
      })

      // Schedule streak alerts hourly between 6pm-11pm (when people are likely home)
      // Runs at :30 past each hour to spread out load
      this.streakAlertJob = cron.schedule('30 18-23 * * *', async () => {
        console.log('[ReminderScheduler] Running streak alerts...')
        try {
          const count = await workoutReminderService.checkStreakAlerts()
          console.log(`[ReminderScheduler] Streak alerts: ${count} sent`)
        } catch (error) {
          console.error('[ReminderScheduler] Streak alerts failed:', error)
        }
      })

      // Schedule achievement teases daily at 7pm
      this.achievementTeaseJob = cron.schedule('0 19 * * *', async () => {
        console.log('[ReminderScheduler] Running achievement teases...')
        try {
          const count = await workoutReminderService.checkAchievementTeases()
          console.log(`[ReminderScheduler] Achievement teases: ${count} sent`)
        } catch (error) {
          console.error('[ReminderScheduler] Achievement teases failed:', error)
        }
      })

      // Schedule social motivation at 5pm (after work hours)
      this.socialMotivationJob = cron.schedule('0 17 * * *', async () => {
        console.log('[ReminderScheduler] Running social motivation...')
        try {
          const count = await workoutReminderService.checkSocialMotivation()
          console.log(`[ReminderScheduler] Social motivation: ${count} sent`)
        } catch (error) {
          console.error('[ReminderScheduler] Social motivation failed:', error)
        }
      })

      // Schedule AI message cache cleanup daily at 3am
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
      console.log('  - Daily reminders: 9:00 AM')
      console.log('  - Streak alerts: Hourly 6:30-11:30 PM')
      console.log('  - Achievement teases: 7:00 PM')
      console.log('  - Social motivation: 5:00 PM')
      console.log('  - AI cache cleanup: 3:00 AM')
    } catch (error) {
      console.error('[ReminderScheduler] Initialization failed:', error)
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
      dailyReminderJobActive: this.dailyReminderJob?.running || false,
      streakAlertJobActive: this.streakAlertJob?.running || false,
      achievementTeaseJobActive: this.achievementTeaseJob?.running || false,
      socialMotivationJobActive: this.socialMotivationJob?.running || false,
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
    if (this.dailyReminderJob) this.dailyReminderJob.stop()
    if (this.streakAlertJob) this.streakAlertJob.stop()
    if (this.achievementTeaseJob) this.achievementTeaseJob.stop()
    if (this.socialMotivationJob) this.socialMotivationJob.stop()
    if (this.cacheCleanupJob) this.cacheCleanupJob.stop()
    this.initialized = false
  }
}

const reminderScheduler = new ReminderScheduler()
export default reminderScheduler
