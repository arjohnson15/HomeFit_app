// Workout Reminder Service - Fun AI-powered workout reminders
import prisma from '../lib/prisma.js'
import notificationService from './notifications.js'
import {
  PERSONALITIES,
  getReminderMessage,
  getStreakAlertMessage,
  getAchievementTeaseMessage,
  getSocialMessage,
  getRandomJoke
} from '../data/reminderMessages.js'

class WorkoutReminderService {
  constructor() {
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) return

    // Load notification service settings
    await notificationService.loadSettings()
    this.initialized = true
    console.log('[WorkoutReminders] Service initialized')
  }

  // Get AI configuration for a user (for AI-generated messages)
  async getUserAIConfig(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { openaiApiKey: true }
    })

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId }
    })

    const appSettings = await prisma.appSettings.findFirst()

    // Check if user has their own OpenAI key
    if (user?.openaiApiKey) {
      return {
        apiKey: user.openaiApiKey,
        model: userSettings?.aiModel || 'gpt-4o-mini'
      }
    }

    // Fall back to global OpenAI settings
    if (appSettings?.globalOpenaiEnabled && appSettings.globalOpenaiApiKey) {
      return {
        apiKey: appSettings.globalOpenaiApiKey,
        model: userSettings?.aiModel || 'gpt-4o-mini'
      }
    }

    return null
  }

  // Generate AI-powered reminder message
  async generateAIMessage(userId, context) {
    const aiConfig = await this.getUserAIConfig(userId)
    if (!aiConfig) return null

    const { personality, daysInactive, userName, streak, trainingStyle, recentPRs } = context

    const personalityInfo = PERSONALITIES[personality] || PERSONALITIES.supportive

    const systemPrompt = `You are a fitness coach with a "${personalityInfo.name}" personality (${personalityInfo.description}).
Generate a workout reminder message for ${userName}.

Context:
- Days since last workout: ${daysInactive}
- Current streak: ${streak || 0} days
- Training style: ${trainingStyle || 'General'}
${recentPRs ? `- Recent PRs: ${recentPRs}` : ''}

Guidelines:
- Keep the message under 200 characters for push notifications
- Match the ${personalityInfo.name} personality style exactly
- Reference their specific situation (days off, streak, etc.)
- Be creative and fun, but motivating
- Don't use generic phrases - make it personal and memorable`

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Generate a workout reminder message.' }
          ],
          max_tokens: 100,
          temperature: 0.9 // Higher creativity for fun messages
        })
      })

      if (!response.ok) {
        console.error('[WorkoutReminders] AI request failed:', response.status)
        return null
      }

      const data = await response.json()
      return data.choices?.[0]?.message?.content?.trim() || null
    } catch (error) {
      console.error('[WorkoutReminders] AI generation error:', error)
      return null
    }
  }

  // Get user's reminder context
  async getUserReminderContext(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        settings: true,
        stats: true
      }
    })

    if (!user || !user.settings) return null

    // Calculate days since last workout
    let daysInactive = 0
    if (user.stats?.lastWorkoutDate) {
      const lastWorkout = new Date(user.stats.lastWorkoutDate)
      const now = new Date()
      daysInactive = Math.floor((now - lastWorkout) / (1000 * 60 * 60 * 24))
    } else {
      // No workouts ever - check account age
      const accountAge = Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24))
      daysInactive = Math.min(accountAge, 7) // Cap at 7 for new users
    }

    return {
      user,
      settings: user.settings,
      stats: user.stats,
      daysInactive,
      userName: user.name?.split(' ')[0] || 'friend',
      streak: user.stats?.currentStreak || 0,
      trainingStyle: user.trainingStyle
    }
  }

  // Check if user should receive a reminder today
  async shouldSendReminder(userId) {
    const context = await this.getUserReminderContext(userId)
    if (!context) return { shouldSend: false, reason: 'User not found' }

    const { settings, daysInactive } = context

    // Check if reminders are enabled
    if (!settings.workoutReminders) {
      return { shouldSend: false, reason: 'Reminders disabled' }
    }

    if (settings.reminderFrequency === 'off') {
      return { shouldSend: false, reason: 'Reminder frequency off' }
    }

    // Check if user has been inactive long enough
    if (daysInactive < settings.reminderDaysInactive) {
      return { shouldSend: false, reason: 'Not inactive long enough' }
    }

    // Check if we already sent a reminder today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existingReminder = await prisma.reminderLog.findFirst({
      where: {
        userId,
        type: 'workout_reminder',
        sentAt: { gte: today }
      }
    })

    if (existingReminder) {
      return { shouldSend: false, reason: 'Already sent today' }
    }

    return { shouldSend: true, context }
  }

  // Send a workout reminder to a user
  async sendReminder(userId, forceTemplate = false) {
    const checkResult = await this.shouldSendReminder(userId)

    if (!checkResult.shouldSend) {
      console.log(`[WorkoutReminders] Skipping user ${userId}: ${checkResult.reason}`)
      return { sent: false, reason: checkResult.reason }
    }

    const { context } = checkResult
    const { settings, daysInactive, userName, streak, trainingStyle } = context
    const personality = settings.reminderPersonality || 'supportive'

    let message = null
    let usedAI = false

    // Try AI message first if enabled and not forcing template
    if (settings.enableFunnyReminders && !forceTemplate) {
      message = await this.generateAIMessage(userId, {
        personality,
        daysInactive,
        userName,
        streak,
        trainingStyle
      })
      usedAI = !!message
    }

    // Fall back to template message
    if (!message) {
      message = getReminderMessage(personality, daysInactive, userName)
    }

    // Add a random joke for dad_jokes personality
    if (personality === 'dad_jokes' && Math.random() > 0.5) {
      message += '\n\n' + getRandomJoke()
    }

    const personalityInfo = PERSONALITIES[personality] || PERSONALITIES.supportive
    const title = `${personalityInfo.emoji} ${personalityInfo.name} Says...`

    // Send notification through all channels
    const result = await notificationService.notifyUser(userId, {
      title,
      body: message,
      html: this.generateEmailHTML(title, message, personality),
      url: '/today'
    })

    // Log the reminder
    const channelsSent = []
    if (result.email) channelsSent.push('email')
    if (result.sms) channelsSent.push('sms')
    if (result.push) channelsSent.push('push')

    if (channelsSent.length > 0) {
      await prisma.reminderLog.create({
        data: {
          userId,
          type: 'workout_reminder',
          message,
          channel: channelsSent.join(','),
          personality
        }
      })
    }

    console.log(`[WorkoutReminders] Sent reminder to ${userId} via ${channelsSent.join(', ') || 'none'} (AI: ${usedAI})`)

    return {
      sent: channelsSent.length > 0,
      channels: channelsSent,
      message,
      usedAI
    }
  }

  // Check and send streak alerts
  async checkStreakAlerts() {
    console.log('[WorkoutReminders] Checking streak alerts...')

    // Find users with active streaks who haven't worked out today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const usersWithStreaks = await prisma.userStats.findMany({
      where: {
        currentStreak: { gte: 3 }, // Only alert for streaks of 3+ days
        lastWorkoutDate: {
          lt: today // Haven't worked out today
        }
      },
      include: {
        user: {
          include: {
            settings: true
          }
        }
      }
    })

    let alertsSent = 0

    for (const stats of usersWithStreaks) {
      const user = stats.user
      if (!user.settings?.enableStreakAlerts) continue

      // Check if we already sent a streak alert today
      const existingAlert = await prisma.reminderLog.findFirst({
        where: {
          userId: user.id,
          type: 'streak_alert',
          sentAt: { gte: today }
        }
      })

      if (existingAlert) continue

      const personality = user.settings.reminderPersonality || 'supportive'
      const message = getStreakAlertMessage(
        personality,
        stats.currentStreak,
        user.name?.split(' ')[0] || 'friend'
      )

      const personalityInfo = PERSONALITIES[personality] || PERSONALITIES.supportive
      const title = `${personalityInfo.emoji} Streak Alert!`

      const result = await notificationService.notifyUser(user.id, {
        title,
        body: message,
        html: this.generateEmailHTML(title, message, personality),
        url: '/today'
      })

      const channelsSent = []
      if (result.email) channelsSent.push('email')
      if (result.sms) channelsSent.push('sms')
      if (result.push) channelsSent.push('push')

      if (channelsSent.length > 0) {
        await prisma.reminderLog.create({
          data: {
            userId: user.id,
            type: 'streak_alert',
            message,
            channel: channelsSent.join(','),
            personality
          }
        })
        alertsSent++
      }
    }

    console.log(`[WorkoutReminders] Sent ${alertsSent} streak alerts`)
    return alertsSent
  }

  // Check and send achievement tease notifications
  async checkAchievementTeases() {
    console.log('[WorkoutReminders] Checking achievement teases...')

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find users close to achievements (within 1-3 of threshold)
    const closeAchievements = await prisma.userAchievement.findMany({
      where: {
        isUnlocked: false,
        achievement: {
          isActive: true
        }
      },
      include: {
        user: {
          include: { settings: true }
        },
        achievement: true
      }
    })

    let teasesSent = 0

    for (const ua of closeAchievements) {
      const remaining = ua.achievement.threshold - ua.currentProgress
      if (remaining < 1 || remaining > 3) continue // Only tease when 1-3 away

      const user = ua.user
      if (!user.settings?.enableAchievementTeases) continue

      // Check if we already sent a tease for this achievement today
      const existingTease = await prisma.reminderLog.findFirst({
        where: {
          userId: user.id,
          type: 'achievement_tease',
          sentAt: { gte: today },
          message: { contains: ua.achievement.name }
        }
      })

      if (existingTease) continue

      const personality = user.settings.reminderPersonality || 'supportive'
      const message = getAchievementTeaseMessage(
        personality,
        ua.achievement.name,
        remaining,
        user.name?.split(' ')[0] || 'friend'
      )

      const personalityInfo = PERSONALITIES[personality] || PERSONALITIES.supportive
      const title = `${personalityInfo.emoji} So Close!`

      const result = await notificationService.notifyUser(user.id, {
        title,
        body: message,
        html: this.generateEmailHTML(title, message, personality),
        url: '/profile'
      })

      const channelsSent = []
      if (result.email) channelsSent.push('email')
      if (result.sms) channelsSent.push('sms')
      if (result.push) channelsSent.push('push')

      if (channelsSent.length > 0) {
        await prisma.reminderLog.create({
          data: {
            userId: user.id,
            type: 'achievement_tease',
            message,
            channel: channelsSent.join(','),
            personality
          }
        })
        teasesSent++
      }
    }

    console.log(`[WorkoutReminders] Sent ${teasesSent} achievement teases`)
    return teasesSent
  }

  // Check and send social motivation notifications
  async checkSocialMotivation() {
    console.log('[WorkoutReminders] Checking social motivation...')

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find users who haven't worked out today but have friends who have
    const usersWithFriends = await prisma.user.findMany({
      where: {
        settings: {
          enableSocialMotivation: true,
          workoutReminders: true
        }
      },
      include: {
        settings: true,
        stats: true,
        friendships: {
          where: { status: 'ACCEPTED' },
          include: {
            friend: {
              include: { stats: true }
            }
          }
        }
      }
    })

    let socialSent = 0

    for (const user of usersWithFriends) {
      // Skip if user worked out today
      if (user.stats?.lastWorkoutDate && user.stats.lastWorkoutDate >= today) {
        continue
      }

      // Count friends who worked out today
      const friendsWhoWorkedOut = user.friendships.filter(f => {
        const friendLastWorkout = f.friend.stats?.lastWorkoutDate
        return friendLastWorkout && friendLastWorkout >= today
      })

      if (friendsWhoWorkedOut.length === 0) continue

      // Check if we already sent a social motivation today
      const existingMotivation = await prisma.reminderLog.findFirst({
        where: {
          userId: user.id,
          type: 'social_motivation',
          sentAt: { gte: today }
        }
      })

      if (existingMotivation) continue

      const personality = user.settings?.reminderPersonality || 'supportive'
      const randomFriend = friendsWhoWorkedOut[Math.floor(Math.random() * friendsWhoWorkedOut.length)]
      const message = getSocialMessage(
        personality,
        friendsWhoWorkedOut.length,
        randomFriend?.friend.name?.split(' ')[0],
        user.name?.split(' ')[0] || 'friend'
      )

      const personalityInfo = PERSONALITIES[personality] || PERSONALITIES.supportive
      const title = `${personalityInfo.emoji} Your Friends Are Training!`

      const result = await notificationService.notifyUser(user.id, {
        title,
        body: message,
        html: this.generateEmailHTML(title, message, personality),
        url: '/today'
      })

      const channelsSent = []
      if (result.email) channelsSent.push('email')
      if (result.sms) channelsSent.push('sms')
      if (result.push) channelsSent.push('push')

      if (channelsSent.length > 0) {
        await prisma.reminderLog.create({
          data: {
            userId: user.id,
            type: 'social_motivation',
            message,
            channel: channelsSent.join(','),
            personality
          }
        })
        socialSent++
      }
    }

    console.log(`[WorkoutReminders] Sent ${socialSent} social motivation notifications`)
    return socialSent
  }

  // Process daily reminders for all users
  async processDailyReminders() {
    console.log('[WorkoutReminders] Processing daily reminders...')

    // Get all users with reminders enabled
    const users = await prisma.user.findMany({
      where: {
        active: true,
        settings: {
          workoutReminders: true,
          reminderFrequency: { not: 'off' }
        }
      },
      select: { id: true }
    })

    console.log(`[WorkoutReminders] Found ${users.length} users with reminders enabled`)

    let sent = 0
    let skipped = 0

    for (const user of users) {
      try {
        const result = await this.sendReminder(user.id)
        if (result.sent) {
          sent++
        } else {
          skipped++
        }
      } catch (error) {
        console.error(`[WorkoutReminders] Error sending reminder to ${user.id}:`, error)
        skipped++
      }
    }

    console.log(`[WorkoutReminders] Daily reminders complete: ${sent} sent, ${skipped} skipped`)
    return { sent, skipped }
  }

  // Generate email HTML for reminders
  generateEmailHTML(title, message, personality) {
    const colors = {
      drill_sergeant: { bg: '#8B0000', text: '#FFFFFF' },
      supportive: { bg: '#4CAF50', text: '#FFFFFF' },
      sarcastic: { bg: '#9C27B0', text: '#FFFFFF' },
      motivational: { bg: '#FF5722', text: '#FFFFFF' },
      dad_jokes: { bg: '#2196F3', text: '#FFFFFF' }
    }

    const color = colors[personality] || colors.supportive
    const personalityInfo = PERSONALITIES[personality] || PERSONALITIES.supportive

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px;">
          <tr>
            <td align="center">
              <table width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background:${color.bg};padding:30px;text-align:center;">
                    <h1 style="margin:0;color:${color.text};font-size:28px;">${personalityInfo.emoji}</h1>
                    <h2 style="margin:10px 0 0;color:${color.text};font-size:20px;">${title}</h2>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:30px;">
                    <p style="font-size:18px;line-height:1.6;color:#333;margin:0 0 20px;">
                      ${message.replace(/\n/g, '<br>')}
                    </p>
                    <div style="text-align:center;margin-top:30px;">
                      <a href="/today" style="display:inline-block;padding:15px 40px;background:${color.bg};color:${color.text};text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">
                        Start Workout
                      </a>
                    </div>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:20px;background:#f9f9f9;text-align:center;border-top:1px solid #eee;">
                    <p style="margin:0;color:#888;font-size:12px;">
                      You're receiving this because workout reminders are enabled.<br>
                      <a href="/settings/notifications" style="color:#888;">Manage notification settings</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  }

  // Get reminder stats for admin dashboard
  async getReminderStats(days = 7) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const stats = await prisma.reminderLog.groupBy({
      by: ['type', 'personality'],
      where: {
        sentAt: { gte: since }
      },
      _count: true
    })

    const totalSent = await prisma.reminderLog.count({
      where: { sentAt: { gte: since } }
    })

    return {
      totalSent,
      byType: stats.reduce((acc, s) => {
        acc[s.type] = (acc[s.type] || 0) + s._count
        return acc
      }, {}),
      byPersonality: stats.reduce((acc, s) => {
        acc[s.personality] = (acc[s.personality] || 0) + s._count
        return acc
      }, {})
    }
  }
}

// Export singleton instance
const workoutReminderService = new WorkoutReminderService()
export default workoutReminderService
export { PERSONALITIES }
