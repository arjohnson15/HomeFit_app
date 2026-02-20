import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

// Throttle timezone updates - only persist once per user per 10 minutes
const _tzCache = new Map()
const TZ_THROTTLE_MS = 10 * 60 * 1000

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Get user from database
    // Note: Don't select 'settings: true' here as it may include fields not yet migrated
    // Routes that need settings should fetch them explicitly
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        trainingStyle: true,
        avatarUrl: true
      }
    })

    if (!user) {
      return res.status(401).json({ message: 'User not found' })
    }

    req.user = user

    // Persist timezone from X-Timezone header (throttled, fire-and-forget)
    const tz = req.headers['x-timezone']
    if (tz && user.id) {
      const cacheKey = `${user.id}:${tz}`
      const lastSaved = _tzCache.get(cacheKey)
      if (!lastSaved || Date.now() - lastSaved > TZ_THROTTLE_MS) {
        _tzCache.set(cacheKey, Date.now())
        prisma.userSettings.upsert({
          where: { userId: user.id },
          update: { timezone: tz },
          create: { userId: user.id, timezone: tz }
        }).catch(() => {})
      }
    }

    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' })
    }
    return res.status(403).json({ message: 'Invalid token' })
  }
}

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Admin access required' })
  }
  next()
}

export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return next()
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        trainingStyle: true,
        avatarUrl: true
      }
    })
    req.user = user
  } catch {
    // Token invalid, but that's ok for optional auth
  }

  next()
}
