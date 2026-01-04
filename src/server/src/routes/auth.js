import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { body, validationResult } from 'express-validator'
import prisma from '../lib/prisma.js'
import { authenticateToken } from '../middleware/auth.js'
import notificationService from '../services/notifications.js'

const router = express.Router()

// Validation middleware
const validateSignup = [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('password').isLength({ min: 8 }),
  body('name').isLength({ min: 1, max: 100 }).trim()
]

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
]

// Generate short-lived access token (15 minutes)
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  )
}

// Generate long-lived refresh token (1 year)
const generateRefreshToken = async (userId, deviceInfo = null) => {
  const token = crypto.randomBytes(64).toString('hex')
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      deviceInfo,
      expiresAt
    }
  })

  return token
}

// POST /api/auth/signup
router.post('/signup', validateSignup, async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() })
    }

    const { email, username, password, name, shareWorkouts } = req.body

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    })

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username'
      return res.status(409).json({ message: `This ${field} is already registered` })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        name,
        settings: {
          create: {
            shareWorkouts: shareWorkouts === true
          }
        }
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        trainingStyle: true,
        createdAt: true
      }
    })

    const deviceInfo = req.headers['user-agent'] || null
    const token = generateAccessToken(user.id)
    const refreshToken = await generateRefreshToken(user.id, deviceInfo)

    res.status(201).json({
      message: 'Account created successfully',
      user,
      token,
      refreshToken
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/login
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() })
    }

    const { email, password } = req.body

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        password: true,
        role: true,
        trainingStyle: true
      }
    })

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const deviceInfo = req.headers['user-agent'] || null
    const token = generateAccessToken(user.id)
    const refreshToken = await generateRefreshToken(user.id, deviceInfo)

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token,
      refreshToken
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/refresh - Get new access token using refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' })
    }

    // Find the refresh token in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
            role: true,
            trainingStyle: true
          }
        }
      }
    })

    // Check if token exists and is not expired
    if (!storedToken || storedToken.expiresAt < new Date()) {
      // Clean up expired token if it exists
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } })
      }
      return res.status(401).json({ message: 'Invalid or expired refresh token' })
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(storedToken.userId)

    res.json({
      token: newAccessToken,
      user: storedToken.user
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/logout - Invalidate refresh token
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    if (refreshToken) {
      // Delete the refresh token from database
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      })
    }

    res.json({ message: 'Logged out successfully' })
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res, next) => {
  try {
    const { email } = req.body

    const user = await prisma.user.findUnique({
      where: { email }
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If an account exists, a reset link will be sent' })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    // Save token to database
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExp }
    })

    // Get app settings for branding
    const settings = await prisma.appSettings.findFirst()
    const appName = settings?.appName || 'HomeFit'

    // Build reset URL (assumes frontend runs on same host or configured URL)
    const baseUrl = process.env.APP_URL || 'http://localhost:5173'
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`

    // Send email
    await notificationService.loadSettings()
    const emailSent = await notificationService.sendEmail(
      user.email,
      `${appName} - Reset Your Password`,
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0a84ff;">Reset Your Password</h2>
        <p>Hi ${user.name},</p>
        <p>We received a request to reset your password for your ${appName} account.</p>
        <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #0a84ff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">This email was sent from ${appName}.</p>
      </div>
      `
    )

    if (!emailSent) {
      console.error('Failed to send password reset email to:', user.email)
    }

    res.json({ message: 'If an account exists, a reset link will be sent' })
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', [
  body('token').exists(),
  body('password').isLength({ min: 8 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' })
    }

    const { token, password } = req.body

    // Find user with valid token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExp: {
          gt: new Date()
        }
      }
    })

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset link. Please request a new one.' })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12)

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExp: null
      }
    })

    res.json({ message: 'Password has been reset successfully. You can now log in.' })
  } catch (error) {
    next(error)
  }
})

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, async (req, res) => {
  res.json({ user: req.user })
})

// PATCH /api/auth/profile - Update profile
router.patch('/profile', authenticateToken, async (req, res, next) => {
  try {
    const { name, trainingStyle } = req.body

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(trainingStyle && { trainingStyle })
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        trainingStyle: true
      }
    })

    res.json({ user })
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, [
  body('currentPassword').exists(),
  body('newPassword').isLength({ min: 8 })
], async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    })

    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12)

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    })

    res.json({ message: 'Password changed successfully' })
  } catch (error) {
    next(error)
  }
})

export default router
