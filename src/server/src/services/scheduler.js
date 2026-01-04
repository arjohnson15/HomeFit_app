import cron from 'node-cron'
import prisma from '../lib/prisma.js'
import backupService from './backup.js'

class BackupScheduler {
  constructor() {
    this.dailyJob = null
    this.weeklyJob = null
    this.cleanupJob = null
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) return

    console.log('[BackupScheduler] Initializing...')

    try {
      // Check if database tables exist (migrations may not have run yet)
      const tablesExist = await this.checkTablesExist()
      if (!tablesExist) {
        console.log('[BackupScheduler] Database tables not ready, skipping initialization')
        console.log('[BackupScheduler] Run "npx prisma db push" or "npx prisma migrate deploy" to set up the database')
        return
      }

      // Get current schedule settings
      const schedule = await backupService.getSchedule()

      // Set up cron jobs based on schedule
      this.updateJobs(schedule)

      // Set up daily cleanup job at 4am
      this.cleanupJob = cron.schedule('0 4 * * *', async () => {
        console.log('[BackupScheduler] Running backup cleanup...')
        try {
          const count = await backupService.cleanupExpiredBackups()
          console.log(`[BackupScheduler] Cleaned up ${count} expired backups`)
        } catch (error) {
          console.error('[BackupScheduler] Cleanup failed:', error)
        }
      })

      this.initialized = true
      console.log('[BackupScheduler] Initialized successfully')
    } catch (error) {
      // Handle case where tables don't exist yet (first-time deployment)
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.log('[BackupScheduler] Database tables not ready, skipping initialization')
        console.log('[BackupScheduler] Run "npx prisma db push" to set up the database')
      } else {
        console.error('[BackupScheduler] Initialization failed:', error)
      }
    }
  }

  async checkTablesExist() {
    try {
      // Try a simple query to check if the table exists
      await prisma.$queryRaw`SELECT 1 FROM backup_schedules LIMIT 1`
      return true
    } catch (error) {
      return false
    }
  }

  // Update cron jobs based on schedule settings
  updateJobs(schedule) {
    // Stop existing jobs
    if (this.dailyJob) {
      this.dailyJob.stop()
      this.dailyJob = null
    }
    if (this.weeklyJob) {
      this.weeklyJob.stop()
      this.weeklyJob = null
    }

    // Set up daily backup
    if (schedule.dailyEnabled) {
      const [hour, minute] = schedule.dailyTime.split(':').map(Number)
      const cronExpression = `${minute} ${hour} * * *`

      console.log(`[BackupScheduler] Daily backup scheduled at ${schedule.dailyTime}`)

      this.dailyJob = cron.schedule(cronExpression, async () => {
        await this.runScheduledBackup('daily')
      })
    }

    // Set up weekly backup
    if (schedule.weeklyEnabled) {
      const [hour, minute] = schedule.weeklyTime.split(':').map(Number)
      const cronExpression = `${minute} ${hour} * * ${schedule.weeklyDay}`

      console.log(`[BackupScheduler] Weekly backup scheduled on day ${schedule.weeklyDay} at ${schedule.weeklyTime}`)

      this.weeklyJob = cron.schedule(cronExpression, async () => {
        await this.runScheduledBackup('weekly')
      })
    }
  }

  // Run a scheduled backup
  async runScheduledBackup(type) {
    console.log(`[BackupScheduler] Running scheduled ${type} backup...`)

    try {
      // Get current schedule for retention settings
      const schedule = await backupService.getSchedule()
      const retention = type === 'daily' ? schedule.dailyRetention : schedule.weeklyRetention

      // Create the backup
      const backup = await backupService.createFullBackup(null, true, type)

      // Set expiration date based on retention
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + retention)

      await prisma.backup.update({
        where: { id: backup.id },
        data: { expiresAt }
      })

      // Update last run time
      const updateField = type === 'daily' ? 'lastDailyRun' : 'lastWeeklyRun'
      await prisma.backupSchedule.update({
        where: { id: '1' },
        data: { [updateField]: new Date() }
      })

      console.log(`[BackupScheduler] Scheduled ${type} backup completed: ${backup.filename}`)
      return backup
    } catch (error) {
      console.error(`[BackupScheduler] Scheduled ${type} backup failed:`, error)
      throw error
    }
  }

  // Manually trigger a backup run
  async manualRun(type = 'daily') {
    return this.runScheduledBackup(type)
  }

  // Reload schedule from database
  async reload() {
    console.log('[BackupScheduler] Reloading schedule...')
    const schedule = await backupService.getSchedule()
    this.updateJobs(schedule)
  }

  // Get scheduler status
  getStatus() {
    return {
      initialized: this.initialized,
      dailyJobActive: this.dailyJob?.running || false,
      weeklyJobActive: this.weeklyJob?.running || false,
      cleanupJobActive: this.cleanupJob?.running || false
    }
  }

  // Shutdown scheduler
  shutdown() {
    console.log('[BackupScheduler] Shutting down...')
    if (this.dailyJob) this.dailyJob.stop()
    if (this.weeklyJob) this.weeklyJob.stop()
    if (this.cleanupJob) this.cleanupJob.stop()
    this.initialized = false
  }
}

const backupScheduler = new BackupScheduler()
export default backupScheduler
