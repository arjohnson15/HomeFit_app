import express from 'express'
import { body, validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth.js'
import logger from '../utils/logger.js'
import notificationService from '../services/notifications.js'

const router = express.Router()
const prisma = new PrismaClient()

// Helper function to send feedback notifications to admins
async function sendFeedbackNotifications(type, title, severity = null) {
  try {
    const settings = await prisma.appSettings.findFirst()
    if (!settings) return

    const typeLabel = type === 'BUG' ? 'Bug Report' : 'Feature Suggestion'
    const severityText = severity ? ` (${severity.toUpperCase()})` : ''

    // Send email notification
    if (settings.feedbackEmailEnabled && settings.feedbackEmail) {
      const subject = `New ${typeLabel}${severityText}: ${title}`
      const html = `
        <h2>New ${typeLabel} Submitted</h2>
        <p><strong>Title:</strong> ${title}</p>
        ${severity ? `<p><strong>Severity:</strong> ${severity}</p>` : ''}
        <p><a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/feedback">View in Admin Panel</a></p>
      `
      await notificationService.sendEmail(settings.feedbackEmail, subject, html)
      logger.info(`Feedback notification email sent to ${settings.feedbackEmail}`)
    }

    // Send push notifications to all admins
    if (settings.feedbackPushEnabled) {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true }
      })

      for (const admin of admins) {
        await notificationService.sendPush(
          admin.id,
          `New ${typeLabel}${severityText}`,
          title,
          { url: '/admin/feedback' }
        )
      }
      logger.info(`Feedback push notifications sent to ${admins.length} admins`)
    }
  } catch (error) {
    logger.error('Error sending feedback notifications:', error)
    // Don't throw - notifications are non-critical
  }
}

// Validation for feature suggestions
const validateFeature = [
  body('title').isLength({ min: 1, max: 100 }).trim().withMessage('Title is required (max 100 characters)'),
  body('category').isIn(['workout', 'nutrition', 'social', 'tracking', 'ui', 'other']).withMessage('Valid category is required'),
  body('description').isLength({ min: 1, max: 1000 }).trim().withMessage('Description is required (max 1000 characters)'),
  body('useCase').optional().isLength({ max: 500 }).trim()
]

// Validation for bug reports
const validateBug = [
  body('title').isLength({ min: 1, max: 100 }).trim().withMessage('Title is required (max 100 characters)'),
  body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Valid severity is required'),
  body('description').isLength({ min: 1, max: 1000 }).trim().withMessage('Description is required (max 1000 characters)'),
  body('page').optional().isLength({ max: 50 }).trim(),
  body('steps').optional().isLength({ max: 500 }).trim(),
  body('expected').optional().isLength({ max: 500 }).trim(),
  body('userAgent').optional().isLength({ max: 500 }),
  body('url').optional().isLength({ max: 500 })
]

// POST /api/feedback/feature - Submit a feature suggestion
router.post('/feature', authenticateToken, validateFeature, async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg })
    }

    const { title, category, description, useCase } = req.body

    const feedback = await prisma.feedback.create({
      data: {
        userId: req.user.userId,
        type: 'FEATURE',
        title,
        category,
        description,
        useCase: useCase || null
      }
    })

    logger.info(`Feature suggestion submitted by user ${req.user.userId}: ${title}`)

    // Send notifications to admins (async, don't wait)
    sendFeedbackNotifications('FEATURE', title)

    res.status(201).json({
      message: 'Feature suggestion submitted successfully',
      id: feedback.id
    })
  } catch (error) {
    logger.error('Error submitting feature suggestion:', error)
    next(error)
  }
})

// POST /api/feedback/bug - Submit a bug report
router.post('/bug', authenticateToken, validateBug, async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg })
    }

    const { title, severity, description, page, steps, expected, userAgent, url } = req.body

    const feedback = await prisma.feedback.create({
      data: {
        userId: req.user.userId,
        type: 'BUG',
        title,
        severity,
        description,
        page: page || null,
        steps: steps || null,
        expected: expected || null,
        userAgent: userAgent || null,
        url: url || null
      }
    })

    logger.info(`Bug report submitted by user ${req.user.userId}: ${title} (${severity})`)

    // Send notifications to admins (async, don't wait)
    sendFeedbackNotifications('BUG', title, severity)

    res.status(201).json({
      message: 'Bug report submitted successfully',
      id: feedback.id
    })
  } catch (error) {
    logger.error('Error submitting bug report:', error)
    next(error)
  }
})

// GET /api/feedback/my - Get user's own feedback submissions
router.get('/my', authenticateToken, async (req, res, next) => {
  try {
    const feedback = await prisma.feedback.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        category: true,
        severity: true,
        createdAt: true
      }
    })

    res.json(feedback)
  } catch (error) {
    logger.error('Error fetching user feedback:', error)
    next(error)
  }
})

export default router
