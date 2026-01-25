import nodemailer from 'nodemailer'
import webpush from 'web-push'
import prisma from '../lib/prisma.js'

// HTML escape function to prevent XSS in email templates
const escapeHtml = (str) => {
  if (typeof str !== 'string') return str
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// SMS Carrier Email-to-SMS Gateways
const SMS_GATEWAYS = {
  verizon: 'vtext.com',
  att: 'txt.att.net',
  tmobile: 'tmomail.net',
  sprint: 'messaging.sprintpcs.com',
  boost: 'sms.myboostmobile.com',
  cricket: 'sms.cricketwireless.net',
  uscellular: 'email.uscc.net',
  virgin: 'vmobl.com',
  metro: 'mymetropcs.com'
}

class NotificationService {
  constructor() {
    this.emailTransporter = null
    this.vapidConfigured = false
    this.settings = null
  }

  // Initialize/refresh settings from database
  async loadSettings() {
    this.settings = await prisma.appSettings.findFirst()
    if (!this.settings) {
      return false
    }

    // Setup email transporter if SMTP is configured
    if (this.settings.smtpHost && this.settings.smtpUser) {
      this.emailTransporter = nodemailer.createTransport({
        host: this.settings.smtpHost,
        port: this.settings.smtpPort || 587,
        secure: this.settings.smtpPort === 465,
        auth: {
          user: this.settings.smtpUser,
          pass: this.settings.smtpPass
        }
      })
    }

    // Setup VAPID for web push if configured
    if (this.settings.vapidPublicKey && this.settings.vapidPrivateKey) {
      webpush.setVapidDetails(
        `mailto:${this.settings.vapidEmail || this.settings.smtpFrom}`,
        this.settings.vapidPublicKey,
        this.settings.vapidPrivateKey
      )
      this.vapidConfigured = true
    }

    return true
  }

  // Generate new VAPID keys (called when SMTP is configured)
  static generateVapidKeys() {
    return webpush.generateVAPIDKeys()
  }

  // Get public VAPID key for client-side subscription
  getPublicVapidKey() {
    return this.settings?.vapidPublicKey || null
  }

  // Check if email notifications are available
  isEmailAvailable() {
    return this.emailTransporter !== null
  }

  // Check if SMS notifications are available (requires SMTP for email-to-SMS gateway)
  isSmsAvailable() {
    return this.isEmailAvailable()
  }

  // Check if push notifications are available
  isPushAvailable() {
    return this.vapidConfigured
  }

  // Send email notification
  async sendEmail(to, subject, html, text = null) {
    if (!this.emailTransporter) {
      console.log('Email not configured, skipping notification')
      return false
    }

    try {
      await this.emailTransporter.sendMail({
        from: this.settings.smtpFrom,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '')
      })
      console.log(`Email sent to ${to}: ${subject}`)
      return true
    } catch (error) {
      console.error('Failed to send email:', error)
      return false
    }
  }

  // Send SMS via email-to-SMS gateway
  // carrier parameter allows using user's specific carrier instead of app default
  async sendSms(phoneNumber, message, carrier = null) {
    if (!this.isSmsAvailable()) {
      console.log('SMS not configured, skipping notification')
      return false
    }

    try {
      // Clean phone number (remove non-digits)
      const cleanPhone = phoneNumber.replace(/\D/g, '')

      // Get gateway domain - use provided carrier or fall back to app default
      const gateway = carrier || this.settings.smsGateway || SMS_GATEWAYS.verizon
      const smsEmail = `${cleanPhone}@${gateway}`

      // Use plain email for SMS - carrier gateways don't support sender names properly
      await this.emailTransporter.sendMail({
        from: this.settings.smtpFrom,
        to: smsEmail,
        subject: '', // SMS doesn't use subject
        text: message.substring(0, 160) // SMS limit
      })
      console.log(`SMS sent to ${phoneNumber} via ${gateway}: ${message.substring(0, 30)}...`)
      return true
    } catch (error) {
      console.error('Failed to send SMS:', error)
      return false
    }
  }

  // Send web push notification
  async sendPush(userId, title, body, data = {}) {
    if (!this.isPushAvailable()) {
      console.log('Push not configured, skipping notification')
      return false
    }

    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId }
      })

      if (subscriptions.length === 0) {
        console.log('No push subscriptions for user:', userId)
        return false
      }

      const payload = JSON.stringify({
        title,
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        data: {
          url: data.url || '/',
          ...data
        }
      })

      const results = await Promise.allSettled(
        subscriptions.map(sub =>
          webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
              }
            },
            payload
          ).catch(async (error) => {
            // Remove invalid subscriptions
            if (error.statusCode === 410 || error.statusCode === 404) {
              await prisma.pushSubscription.delete({
                where: { id: sub.id }
              })
              console.log('Removed expired push subscription:', sub.id)
            }
            throw error
          })
        )
      )

      const successful = results.filter(r => r.status === 'fulfilled').length
      console.log(`Push sent to ${successful}/${subscriptions.length} subscriptions for user ${userId}`)
      return successful > 0
    } catch (error) {
      console.error('Failed to send push:', error)
      return false
    }
  }

  // Send notification through all enabled channels for a user
  async notifyUser(userId, notification) {
    const { title, body, html, url } = notification

    try {
      // Get user settings - only select fields that exist in database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          settings: {
            select: {
              notifyByEmail: true,
              notifyBySms: true,
              notifyByPush: true,
              phoneNumber: true,
              phoneCarrier: true
            }
          }
        }
      })

      if (!user) {
        console.error('User not found:', userId)
        return { email: false, sms: false, push: false }
      }

      const settings = user.settings || {}
      const results = { email: false, sms: false, push: false }

      // Send email if enabled
      if (settings.notifyByEmail !== false && user.email) {
        results.email = await this.sendEmail(
          user.email,
          title,
          html || `<h1>${title}</h1><p>${body}</p>`
        )
      }

      // Send SMS if enabled and phone number available
      if (settings.notifyBySms && settings.phoneNumber) {
        results.sms = await this.sendSms(
          settings.phoneNumber,
          `${title}: ${body}`,
          settings.phoneCarrier // Use user's carrier
        )
      }

      // Send push if enabled
      if (settings.notifyByPush !== false) {
        results.push = await this.sendPush(userId, title, body, { url })
      }

      return results
    } catch (error) {
      console.error('Error notifying user:', error)
      return { email: false, sms: false, push: false }
    }
  }

  // Send workout reminder
  async sendWorkoutReminder(userId, workoutName) {
    const safeName = escapeHtml(workoutName)
    return this.notifyUser(userId, {
      title: 'Time to Work Out!',
      body: `Your ${safeName} workout is scheduled for today. Let's get moving!`,
      html: `
        <h1>Time to Work Out!</h1>
        <p>Your <strong>${safeName}</strong> workout is scheduled for today.</p>
        <p>Let's get moving!</p>
        <a href="/today" style="display:inline-block;padding:10px 20px;background:#0a84ff;color:white;text-decoration:none;border-radius:8px;">Start Workout</a>
      `,
      url: '/today'
    })
  }

  // Send achievement notification
  async sendAchievement(userId, achievement) {
    const safeName = escapeHtml(achievement.name)
    const safeDesc = escapeHtml(achievement.description)
    return this.notifyUser(userId, {
      title: 'Achievement Unlocked!',
      body: safeName,
      html: `
        <h1>Achievement Unlocked!</h1>
        <p>Congratulations! You've earned:</p>
        <h2>${safeName}</h2>
        <p>${safeDesc}</p>
      `,
      url: '/profile'
    })
  }

  // Send weekly progress summary
  async sendWeeklyProgress(userId, stats) {
    const safeWorkouts = escapeHtml(String(stats.workouts))
    const safeSets = escapeHtml(String(stats.sets))
    const safeVolume = escapeHtml(String(stats.volume))
    return this.notifyUser(userId, {
      title: 'Your Weekly Progress',
      body: `You completed ${safeWorkouts} workouts this week!`,
      html: `
        <h1>Your Weekly Progress</h1>
        <p>Great work this week!</p>
        <ul>
          <li><strong>Workouts:</strong> ${safeWorkouts}</li>
          <li><strong>Total Sets:</strong> ${safeSets}</li>
          <li><strong>Total Volume:</strong> ${safeVolume} lbs</li>
        </ul>
        <a href="/history" style="display:inline-block;padding:10px 20px;background:#0a84ff;color:white;text-decoration:none;border-radius:8px;">View Details</a>
      `,
      url: '/history'
    })
  }
}

// Export singleton instance
const notificationService = new NotificationService()
export default notificationService
export { SMS_GATEWAYS }
