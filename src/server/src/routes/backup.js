import express from 'express'
import multer from 'multer'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import backupService from '../services/backup.js'
import backupScheduler from '../services/scheduler.js'

const router = express.Router()

// Configure multer for backup file uploads
const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true)
    } else {
      cb(new Error('Only JSON files are allowed'))
    }
  }
})

// =============================================
// USER BACKUP ENDPOINTS (Authenticated users)
// =============================================

// GET /api/backup/user/export - Export current user's data
router.get('/user/export', async (req, res, next) => {
  try {
    const { backup, data } = await backupService.createUserBackup(req.user.id)

    // Set headers for download
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`)

    res.json(data)
  } catch (error) {
    next(error)
  }
})

// POST /api/backup/user/import - Import user data from backup
router.post('/user/import', upload.single('backup'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file provided' })
    }

    // Parse the uploaded JSON file
    let backupData
    try {
      backupData = JSON.parse(req.file.buffer.toString())
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON file' })
    }

    // Validate backup type
    if (backupData.type !== 'USER_DATA') {
      return res.status(400).json({ error: 'Invalid backup type. Expected USER_DATA backup.' })
    }

    // Get import options from request body
    const options = {
      mergeMode: req.body.mergeMode || 'replace',
      includeWorkouts: req.body.includeWorkouts !== 'false',
      includeNutrition: req.body.includeNutrition !== 'false',
      includeSchedules: req.body.includeSchedules !== 'false',
      includeSettings: req.body.includeSettings !== 'false'
    }

    const results = await backupService.importUserData(req.user.id, backupData, options)

    res.json({
      message: 'Import completed',
      results
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/backup/user/history - List user's previous backups
router.get('/user/history', async (req, res, next) => {
  try {
    const backups = await backupService.listUserBackups(req.user.id)
    res.json({ backups })
  } catch (error) {
    next(error)
  }
})

// GET /api/backup/user/:id/download - Download a user backup
router.get('/user/:id/download', async (req, res, next) => {
  try {
    const backup = await backupService.getBackup(req.params.id)

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' })
    }

    // Check ownership
    if (backup.userId !== req.user.id && backup.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Read and send file
    const data = backupService.readBackupFile(backup)

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`)
    res.json(data)
  } catch (error) {
    next(error)
  }
})

// DELETE /api/backup/user/:id - Delete a user backup
router.delete('/user/:id', async (req, res, next) => {
  try {
    const backup = await backupService.getBackup(req.params.id)

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' })
    }

    // Check ownership
    if (backup.userId !== req.user.id && backup.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await backupService.deleteBackup(req.params.id)

    res.json({ message: 'Backup deleted' })
  } catch (error) {
    next(error)
  }
})

// =============================================
// ADMIN BACKUP ENDPOINTS
// =============================================

// POST /api/backup/admin/full - Create full system backup
router.post('/admin/full', requireAdmin, async (req, res, next) => {
  try {
    const backup = await backupService.createFullBackup(req.user.id)
    res.json({
      message: 'Full system backup created',
      backup
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/backup/admin/settings - Backup all settings
router.post('/admin/settings', requireAdmin, async (req, res, next) => {
  try {
    const backup = await backupService.createSettingsBackup(req.user.id)
    res.json({
      message: 'Settings backup created',
      backup
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/backup/admin/list - List all system backups
router.get('/admin/list', requireAdmin, async (req, res, next) => {
  try {
    const { type, status, limit = 50, offset = 0 } = req.query

    const result = await backupService.listAllBackups({
      type,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})

// GET /api/backup/admin/stats - Get backup storage stats
router.get('/admin/stats', requireAdmin, async (req, res, next) => {
  try {
    const stats = await backupService.getStorageStats()
    const schedulerStatus = backupScheduler.getStatus()

    res.json({
      storage: stats,
      scheduler: schedulerStatus
    })
  } catch (error) {
    next(error)
  }
})

// =============================================
// SCHEDULED BACKUP CONFIGURATION
// (Must be defined BEFORE :id wildcard routes)
// =============================================

// GET /api/backup/admin/schedule - Get backup schedule settings
router.get('/admin/schedule', requireAdmin, async (req, res, next) => {
  try {
    const schedule = await backupService.getSchedule()
    res.json({ schedule })
  } catch (error) {
    next(error)
  }
})

// PUT /api/backup/admin/schedule - Update backup schedule
router.put('/admin/schedule', requireAdmin, async (req, res, next) => {
  try {
    const {
      dailyEnabled,
      dailyTime,
      dailyRetention,
      weeklyEnabled,
      weeklyDay,
      weeklyTime,
      weeklyRetention
    } = req.body

    const updateData = {}
    if (dailyEnabled !== undefined) updateData.dailyEnabled = dailyEnabled
    if (dailyTime) updateData.dailyTime = dailyTime
    if (dailyRetention) updateData.dailyRetention = parseInt(dailyRetention)
    if (weeklyEnabled !== undefined) updateData.weeklyEnabled = weeklyEnabled
    if (weeklyDay !== undefined) updateData.weeklyDay = parseInt(weeklyDay)
    if (weeklyTime) updateData.weeklyTime = weeklyTime
    if (weeklyRetention) updateData.weeklyRetention = parseInt(weeklyRetention)

    const schedule = await backupService.updateSchedule(updateData)

    // Reload the scheduler with new settings
    await backupScheduler.reload()

    res.json({
      message: 'Schedule updated',
      schedule
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/backup/admin/schedule/run - Manually trigger scheduled backup
router.post('/admin/schedule/run', requireAdmin, async (req, res, next) => {
  try {
    const { type = 'daily' } = req.body

    const backup = await backupScheduler.manualRun(type)

    res.json({
      message: `Manual ${type} backup created`,
      backup
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/backup/admin/cleanup - Manually run backup cleanup
router.post('/admin/cleanup', requireAdmin, async (req, res, next) => {
  try {
    const count = await backupService.cleanupExpiredBackups()
    res.json({
      message: `Cleaned up ${count} expired backups`
    })
  } catch (error) {
    next(error)
  }
})

// =============================================
// ADMIN BACKUP BY ID ENDPOINTS (wildcard routes last)
// =============================================

// GET /api/backup/admin/:id - Get backup details
router.get('/admin/:id', requireAdmin, async (req, res, next) => {
  try {
    const backup = await backupService.getBackup(req.params.id)

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' })
    }

    res.json({ backup })
  } catch (error) {
    next(error)
  }
})

// GET /api/backup/admin/:id/download - Download backup file
router.get('/admin/:id/download', requireAdmin, async (req, res, next) => {
  try {
    const backup = await backupService.getBackup(req.params.id)

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' })
    }

    const data = backupService.readBackupFile(backup)

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`)
    res.json(data)
  } catch (error) {
    next(error)
  }
})

// POST /api/backup/admin/:id/restore - Restore from backup
router.post('/admin/:id/restore', requireAdmin, async (req, res, next) => {
  try {
    const backup = await backupService.getBackup(req.params.id)

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' })
    }

    if (backup.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot restore from incomplete backup' })
    }

    // Read backup data
    const backupData = backupService.readBackupFile(backup)

    // For now, only support restoring settings
    if (backup.type === 'SETTINGS') {
      // Restore app settings
      if (backupData.data.appSettings) {
        const { id, createdAt, updatedAt, ...settingsData } = backupData.data.appSettings
        await prisma.appSettings.upsert({
          where: { id: '1' },
          update: settingsData,
          create: { id: '1', ...settingsData }
        })
      }

      res.json({ message: 'Settings restored successfully' })
    } else if (backup.type === 'USER_DATA' && backup.userId) {
      // Restore user data
      const results = await backupService.importUserData(backup.userId, backupData, {
        mergeMode: 'replace'
      })

      res.json({
        message: 'User data restored',
        results
      })
    } else {
      // Full system restore is more complex - show warning
      res.status(400).json({
        error: 'Full system restore is not supported through the API. Please use database restore tools.'
      })
    }
  } catch (error) {
    next(error)
  }
})

// DELETE /api/backup/admin/:id - Delete backup
router.delete('/admin/:id', requireAdmin, async (req, res, next) => {
  try {
    await backupService.deleteBackup(req.params.id)
    res.json({ message: 'Backup deleted' })
  } catch (error) {
    next(error)
  }
})

export default router
