import { useState, useEffect } from 'react'
import api from '../../../services/api'

const defaultPersonalities = {
  drill_sergeant: {
    name: 'Drill Sergeant',
    emoji: '🎖️',
    description: 'No excuses! Get moving, soldier!',
    preview: "DROP AND GIVE ME 20! Your muscles are getting SOFT!"
  },
  supportive: {
    name: 'Supportive Friend',
    emoji: '🤗',
    description: 'Gentle encouragement and positivity',
    preview: "Hey! Just a friendly reminder - you've got this!"
  },
  sarcastic: {
    name: 'Sarcastic Gym Bro',
    emoji: '😏',
    description: 'Witty motivation with a side of sass',
    preview: "Oh, you're tired? Cool story bro. The weights don't care."
  },
  motivational: {
    name: 'Motivational Speaker',
    emoji: '🔥',
    description: 'Inspiring quotes and powerful energy',
    preview: "Today is the day you become 1% better than yesterday!"
  },
  dad_jokes: {
    name: 'Dad Joke Coach',
    emoji: '👨',
    description: 'Puns, dad jokes, and groans guaranteed',
    preview: "Why did the dumbbell go to therapy? Too much emotional weight!"
  }
}

function NotificationsStep({ data, updateData }) {
  const [personalities, setPersonalities] = useState(defaultPersonalities)

  useEffect(() => {
    // Try to load personalities from API, fall back to defaults
    api.get('/notifications/reminder-personalities')
      .then(res => {
        if (res.data.personalities) {
          setPersonalities(res.data.personalities)
        }
      })
      .catch(() => {
        // Use defaults
      })
  }, [])

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">💬</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Reminder Style</h2>
        <p className="text-gray-400 text-sm">
          Choose how you want to be reminded to work out
        </p>
      </div>

      {/* Enable Reminders */}
      <div className="flex items-center justify-between p-4 bg-dark-elevated rounded-xl">
        <div>
          <p className="text-white font-medium">Workout Reminders</p>
          <p className="text-gray-500 text-sm">Get motivated to stay consistent</p>
        </div>
        <button
          onClick={() => updateData({ workoutReminders: !data.workoutReminders })}
          className={`w-12 h-7 rounded-full transition-colors relative ${
            data.workoutReminders ? 'bg-accent' : 'bg-dark-card'
          }`}
        >
          <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
            data.workoutReminders ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {/* Personality Selection */}
      {data.workoutReminders && (
        <>
          <div>
            <label className="block text-white font-medium mb-3">Choose Your Coach</label>
            <div className="space-y-3">
              {Object.entries(personalities).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => updateData({ reminderPersonality: key })}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    data.reminderPersonality === key
                      ? 'bg-accent/20 border-2 border-accent'
                      : 'bg-dark-elevated border-2 border-transparent hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl">{p.emoji}</span>
                    <span className="text-white font-medium">{p.name}</span>
                    {data.reminderPersonality === key && (
                      <svg className="w-5 h-5 text-accent ml-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mb-1 pl-9">{p.description}</p>
                  <p className="text-gray-400 text-xs pl-9 italic">"{p.preview}"</p>
                </button>
              ))}
            </div>
          </div>

          {/* Smart Reminders Quick Toggle */}
          <div className="bg-dark-elevated rounded-xl p-4 space-y-3">
            <h3 className="text-white font-medium mb-1">Smart Reminders</h3>
            <p className="text-gray-500 text-xs mb-3">Extra motivation when you need it most</p>

            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Streak alerts</span>
              <button
                onClick={() => updateData({ enableStreakAlerts: !data.enableStreakAlerts })}
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  data.enableStreakAlerts ? 'bg-accent' : 'bg-dark-card'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  data.enableStreakAlerts ? 'translate-x-5' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Achievement teases</span>
              <button
                onClick={() => updateData({ enableAchievementTeases: !data.enableAchievementTeases })}
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  data.enableAchievementTeases ? 'bg-accent' : 'bg-dark-card'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  data.enableAchievementTeases ? 'translate-x-5' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Friend motivation</span>
              <button
                onClick={() => updateData({ enableSocialMotivation: !data.enableSocialMotivation })}
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  data.enableSocialMotivation ? 'bg-accent' : 'bg-dark-card'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  data.enableSocialMotivation ? 'translate-x-5' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </>
      )}

      <p className="text-gray-500 text-xs text-center">
        You can change these anytime in Settings → Notifications
      </p>
    </div>
  )
}

export default NotificationsStep
