import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'

// Validate required environment variables at startup
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL']
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL: ${envVar} environment variable is required`)
    process.exit(1)
  }
}

// Routes
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import exerciseRoutes from './routes/exercises.js'
import workoutRoutes from './routes/workouts.js'
import scheduleRoutes from './routes/schedules.js'
import socialRoutes from './routes/social.js'
import adminRoutes from './routes/admin.js'
import notificationRoutes from './routes/notifications.js'
import aiRoutes from './routes/ai.js'
import nutritionRoutes from './routes/nutrition.js'
import achievementRoutes from './routes/achievements.js'
import feedbackRoutes from './routes/feedback.js'
import backupRoutes from './routes/backup.js'
import goalRoutes from './routes/goals.js'

// Services
import backupScheduler from './services/scheduler.js'
import followNotificationService from './services/followNotifications.js'

// Middleware
import { errorHandler } from './middleware/errorHandler.js'
import { authenticateToken } from './middleware/auth.js'
import jwt from 'jsonwebtoken'

// Utils
import logger from './utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
})

// Initialize follow notification service with socket.io
followNotificationService.setSocketIO(io)

// Trust proxy for production behind nginx/docker
app.set('trust proxy', 1)

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, configure properly in production
  crossOriginResourcePolicy: { policy: 'cross-origin' } // Allow images to load cross-origin
}))

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}))

// Request logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Serve exercise images as static files
const exerciseImagesPath = path.join(__dirname, '../../../exercises-db/exercises')
app.use('/api/exercise-images', express.static(exerciseImagesPath, {
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=604800')
  }
}))

// Serve uploaded files (avatars, etc.)
const uploadsPath = path.join(__dirname, '../uploads')
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400')
  }
}))

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '0.1.0'
  })
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', authenticateToken, userRoutes)
app.use('/api/exercises', authenticateToken, exerciseRoutes)
app.use('/api/workouts', authenticateToken, workoutRoutes)
app.use('/api/schedules', authenticateToken, scheduleRoutes)
app.use('/api/social', authenticateToken, socialRoutes)
app.use('/api/admin', authenticateToken, adminRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/ai', authenticateToken, aiRoutes)
app.use('/api/nutrition', authenticateToken, nutritionRoutes)
app.use('/api/achievements', authenticateToken, achievementRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/backup', authenticateToken, backupRoutes)
app.use('/api/goals', authenticateToken, goalRoutes)

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // In Docker container, public is at /app/public, in dev it's at ../../public
  const publicPath = process.env.PUBLIC_PATH || path.join(__dirname, '../public')
  app.use(express.static(publicPath))

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'))
  })
}

// Error handling
app.use(errorHandler)

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  if (!token) {
    // Allow connection but mark as unauthenticated
    socket.userId = null
    return next()
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.userId = decoded.userId
    next()
  } catch (err) {
    logger.warn(`Socket auth failed: ${err.message}`)
    socket.userId = null
    next()
  }
})

// Socket.io for real-time features
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id} (userId: ${socket.userId || 'anonymous'})`)

  // Auto-join user's personal room if authenticated
  if (socket.userId) {
    socket.join(`user-${socket.userId}`)
    logger.info(`User ${socket.userId} auto-joined their room`)
  }

  // Manual join for user room (legacy support)
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`)
    logger.info(`User ${userId} joined their room`)
  })

  // Real-time workout together
  socket.on('join-workout-session', (sessionId) => {
    socket.join(`workout-${sessionId}`)
    logger.info(`Socket ${socket.id} joined workout session ${sessionId}`)
  })

  socket.on('workout-update', (data) => {
    socket.to(`workout-${data.sessionId}`).emit('workout-update', data)
  })

  // ============================================
  // Real-time workout sync between browser tabs/devices
  // ============================================

  // Workout started - broadcast to all user's sessions
  socket.on('workout:start', (data) => {
    try {
      if (!socket.userId) return
      // Broadcast to all OTHER tabs/devices for this user
      socket.to(`user-${socket.userId}`).emit('workout:started', {
        sessionId: data.sessionId,
        startTime: data.startTime,
        workoutName: data.workoutName
      })
      logger.info(`User ${socket.userId} started workout ${data.sessionId}`)
    } catch (error) {
      logger.error('Error in workout:start handler:', error)
    }
  })

  // Workout paused/resumed - sync across all sessions
  socket.on('workout:pause', (data) => {
    try {
      if (!socket.userId) return
      socket.to(`user-${socket.userId}`).emit('workout:paused', {
        sessionId: data.sessionId,
        isPaused: data.isPaused,
        elapsedTime: data.elapsedTime,
        pausedAt: data.pausedAt
      })
      logger.info(`User ${socket.userId} ${data.isPaused ? 'paused' : 'resumed'} workout`)
    } catch (error) {
      logger.error('Error in workout:pause handler:', error)
    }
  })

  // Rest timer started/updated - sync across all sessions
  socket.on('workout:rest-timer', (data) => {
    try {
      if (!socket.userId) return
      socket.to(`user-${socket.userId}`).emit('workout:rest-timer-sync', {
        sessionId: data.sessionId,
        restTimer: data.restTimer,
        restTimerRunning: data.restTimerRunning,
        showRestTimer: data.showRestTimer
      })
    } catch (error) {
      logger.error('Error in workout:rest-timer handler:', error)
    }
  })

  // Exercise/set logged - sync across all sessions
  socket.on('workout:set-logged', (data) => {
    try {
      if (!socket.userId) return
      socket.to(`user-${socket.userId}`).emit('workout:set-logged-sync', {
        sessionId: data.sessionId,
        exerciseId: data.exerciseId,
        setData: data.setData,
        exerciseLogs: data.exerciseLogs
      })
      logger.info(`User ${socket.userId} logged set for exercise ${data.exerciseId}`)
    } catch (error) {
      logger.error('Error in workout:set-logged handler:', error)
    }
  })

  // Workout ended - sync across all sessions
  socket.on('workout:end', (data) => {
    try {
      if (!socket.userId) return
      socket.to(`user-${socket.userId}`).emit('workout:ended', {
        sessionId: data.sessionId,
        endTime: data.endTime
      })
      logger.info(`User ${socket.userId} ended workout ${data.sessionId}`)
    } catch (error) {
      logger.error('Error in workout:end handler:', error)
    }
  })

  // Workout canceled - sync across all sessions
  socket.on('workout:cancel', (data) => {
    try {
      if (!socket.userId) return
      socket.to(`user-${socket.userId}`).emit('workout:canceled', {
        sessionId: data.sessionId
      })
      logger.info(`User ${socket.userId} canceled workout ${data.sessionId}`)
    } catch (error) {
      logger.error('Error in workout:cancel handler:', error)
    }
  })

  // Timer sync request - for periodic sync to keep all tabs in sync
  socket.on('workout:timer-sync', (data) => {
    try {
      if (!socket.userId) return
      socket.to(`user-${socket.userId}`).emit('workout:timer-update', {
        sessionId: data.sessionId,
        elapsedTime: data.elapsedTime,
        isPaused: data.isPaused
      })
    } catch (error) {
      logger.error('Error in workout:timer-sync handler:', error)
    }
  })

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`)
  })
})

// Make io accessible to routes
app.set('io', io)

// Start server
const PORT = process.env.PORT || 3000
httpServer.listen(PORT, async () => {
  logger.info(`HomeFit server running on port ${PORT}`)
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)

  // Initialize backup scheduler
  try {
    await backupScheduler.initialize()
    logger.info('Backup scheduler initialized')
  } catch (error) {
    logger.error('Failed to initialize backup scheduler:', error)
  }
})

export { app, io }
