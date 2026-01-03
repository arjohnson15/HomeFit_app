import { useState } from 'react'
import api from '../services/api'

const visibilityOptions = [
  {
    id: 'PUBLIC',
    title: 'Public',
    description: 'Anyone can follow you without approval. Your profile and activity are visible to everyone.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    recommended: true
  },
  {
    id: 'FRIENDS_ONLY',
    title: 'Approval Required',
    description: 'People can find you, but must request to follow. You approve who can see your activity.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  },
  {
    id: 'PRIVATE',
    title: 'Private',
    description: 'You cannot be found in search or followed. Your profile is completely hidden from others.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    )
  }
]

function PrivacyOnboardingModal({ onComplete }) {
  const [selected, setSelected] = useState('PUBLIC')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/users/settings', {
        profileVisibility: selected,
        hasCompletedOnboarding: true
      })
      onComplete()
    } catch (error) {
      console.error('Error saving privacy settings:', error)
      // Still complete onboarding even if save fails - they can change later
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4">
      <div className="bg-dark-card w-full max-w-lg rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 text-center border-b border-dark-border">
          <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to HomeFit!</h2>
          <p className="text-gray-400">
            Let's set up your profile privacy. You can change this anytime in Settings.
          </p>
        </div>

        {/* Options */}
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-500 mb-4">
            Your account is set to <span className="text-accent font-medium">Public</span> by default.
            Choose how others can interact with your profile:
          </p>

          {visibilityOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelected(option.id)}
              className={`w-full p-4 rounded-2xl text-left transition-all border-2 ${
                selected === option.id
                  ? 'border-accent bg-accent/10'
                  : 'border-transparent bg-dark-elevated hover:border-dark-border'
              }`}
            >
              <div className="flex gap-4">
                <div className={`flex-shrink-0 ${selected === option.id ? 'text-accent' : 'text-gray-500'}`}>
                  {option.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold ${selected === option.id ? 'text-white' : 'text-gray-300'}`}>
                      {option.title}
                    </h3>
                    {option.recommended && (
                      <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <p className={`text-sm mt-1 ${selected === option.id ? 'text-gray-300' : 'text-gray-500'}`}>
                    {option.description}
                  </p>
                </div>
                <div className="flex-shrink-0 self-center">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selected === option.id
                      ? 'border-accent bg-accent'
                      : 'border-gray-600'
                  }`}>
                    {selected === option.id && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="px-4 py-3 bg-dark-elevated/50 mx-4 rounded-xl mb-4">
          {selected === 'PUBLIC' && (
            <p className="text-sm text-gray-400">
              <span className="text-white font-medium">Public profile:</span> Anyone can add you as a friend instantly and see your workouts on the leaderboard.
            </p>
          )}
          {selected === 'FRIENDS_ONLY' && (
            <p className="text-sm text-gray-400">
              <span className="text-white font-medium">Approval required:</span> You'll receive friend requests that you can accept or decline. Only approved friends see your activity.
            </p>
          )}
          {selected === 'PRIVATE' && (
            <p className="text-sm text-gray-400">
              <span className="text-white font-medium">Private profile:</span> You won't appear in search results and no one can send you friend requests. You can still use all app features.
            </p>
          )}
        </div>

        {/* Action Button */}
        <div className="p-4 pt-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-accent text-white font-semibold rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PrivacyOnboardingModal
