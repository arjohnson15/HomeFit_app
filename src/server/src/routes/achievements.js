import express from 'express'
import achievementService from '../services/achievements.js'

const router = express.Router()

// GET /api/achievements - Get user's achievements with progress
router.get('/', async (req, res, next) => {
  try {
    const achievements = await achievementService.getUserAchievements(req.user.id)

    // Group by category
    const grouped = achievements.reduce((acc, achievement) => {
      if (!acc[achievement.category]) {
        acc[achievement.category] = []
      }
      acc[achievement.category].push(achievement)
      return acc
    }, {})

    // Calculate summary
    const unlocked = achievements.filter(a => a.isUnlocked).length
    const total = achievements.length
    const totalPoints = achievements.filter(a => a.isUnlocked).reduce((sum, a) => sum + a.points, 0)

    res.json({
      achievements: grouped,
      allAchievements: achievements,
      summary: { unlocked, total, totalPoints }
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/achievements/recent - Get recently unlocked achievements
router.get('/recent', async (req, res, next) => {
  try {
    const { limit = 5 } = req.query
    const recent = await achievementService.getRecentAchievements(req.user.id, parseInt(limit))

    res.json({
      recent: recent.map(ua => ({
        id: ua.achievement.id,
        name: ua.achievement.name,
        description: ua.achievement.description,
        icon: ua.achievement.icon,
        rarity: ua.achievement.rarity,
        points: ua.achievement.points,
        unlockedAt: ua.unlockedAt
      }))
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/achievements/stats - Get user's stats summary
router.get('/stats', async (req, res, next) => {
  try {
    const summary = await achievementService.getUserStatsSummary(req.user.id)
    res.json(summary)
  } catch (error) {
    next(error)
  }
})

// POST /api/achievements/check - Manually trigger achievement check (useful for testing)
router.post('/check', async (req, res, next) => {
  try {
    const newlyUnlocked = await achievementService.checkAchievements(req.user.id, {})
    res.json({
      newlyUnlocked: newlyUnlocked.map(ua => ({
        id: ua.achievement.id,
        name: ua.achievement.name,
        description: ua.achievement.description,
        icon: ua.achievement.icon,
        rarity: ua.achievement.rarity,
        points: ua.achievement.points
      }))
    })
  } catch (error) {
    next(error)
  }
})

export default router
