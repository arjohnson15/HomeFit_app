import { useState, useCallback } from 'react'
import api from '../../services/api'
import WizardProgress from './WizardProgress'
import WelcomeStep from './steps/WelcomeStep'
import PrivacyStep from './steps/PrivacyStep'
import TrainingStep from './steps/TrainingStep'
import BodyStatsStep from './steps/BodyStatsStep'
import NotificationsStep from './steps/NotificationsStep'

const STEPS = ['welcome', 'privacy', 'training', 'bodyStats', 'notifications']

const initialState = {
  // Privacy
  profileVisibility: 'PUBLIC',

  // Training
  experienceLevel: 'intermediate',
  liftingStyle: 'strength',
  workoutsPerWeek: 4,
  sessionLength: 60,
  equipmentAccess: [],

  // Body Stats
  heightCm: null,
  weightKg: null,
  goalWeightKg: null,
  sex: null,
  birthDate: null,
  activityLevel: null,

  // Nutrition/Dietary (optional expansion)
  dietaryGoal: null,
  dietaryPreference: null,
  allergies: [],
  preferredProteins: [],

  // Calculated goals
  dailyCalorieGoal: null,
  dailyProteinGoal: null,
  dailyCarbsGoal: null,
  dailyFatGoal: null,

  // Notification/Reminder Settings
  workoutReminders: true,
  reminderPersonality: 'supportive',
  enableStreakAlerts: true,
  enableAchievementTeases: true,
  enableSocialMotivation: true
}

function OnboardingWizard({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState(initialState)
  const [saving, setSaving] = useState(false)
  const [showEquipment, setShowEquipment] = useState(false)
  const [showDietary, setShowDietary] = useState(false)

  const updateData = useCallback((updates) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  const saveStepData = async (stepName) => {
    try {
      switch (stepName) {
        case 'privacy':
          await api.patch('/users/settings', {
            profileVisibility: data.profileVisibility
          })
          break

        case 'training':
          // Save to localStorage (current pattern)
          const trainingSettings = {
            experienceLevel: data.experienceLevel,
            primaryGoal: data.liftingStyle,
            workoutDays: data.workoutsPerWeek,
            sessionLength: data.sessionLength,
            equipmentAccess: data.equipmentAccess
          }
          localStorage.setItem('trainingSettings', JSON.stringify(trainingSettings))
          // Also save to server
          await api.put('/users/settings', { trainingPreferences: trainingSettings }).catch(() => {})
          break

        case 'bodyStats':
          // Save body stats
          if (data.heightCm || data.weightKg || data.sex || data.birthDate || data.activityLevel) {
            await api.put('/nutrition/body-stats', {
              heightCm: data.heightCm,
              weightKg: data.weightKg,
              goalWeightKg: data.goalWeightKg,
              sex: data.sex,
              birthDate: data.birthDate,
              activityLevel: data.activityLevel
            }).catch(() => {})
          }

          // Save nutrition goals if set
          if (data.dailyCalorieGoal) {
            await api.put('/nutrition/goals', {
              dailyCalorieGoal: data.dailyCalorieGoal,
              dailyProteinGoal: data.dailyProteinGoal,
              dailyCarbsGoal: data.dailyCarbsGoal,
              dailyFatGoal: data.dailyFatGoal
            }).catch(() => {})
          }

          // Save dietary preferences if expanded
          if (showDietary && (data.dietaryGoal || data.dietaryPreference || data.allergies.length > 0)) {
            await api.put('/nutrition/preferences', {
              dietaryGoal: data.dietaryGoal,
              dietaryPreference: data.dietaryPreference,
              allergies: data.allergies,
              preferredProteins: data.preferredProteins
            }).catch(() => {})
          }
          break

        case 'notifications':
          // Save reminder settings
          await api.patch('/notifications/reminder-settings', {
            workoutReminders: data.workoutReminders,
            reminderPersonality: data.reminderPersonality,
            enableStreakAlerts: data.enableStreakAlerts,
            enableAchievementTeases: data.enableAchievementTeases,
            enableSocialMotivation: data.enableSocialMotivation
          }).catch(() => {})
          break
      }
    } catch (error) {
      console.error(`Error saving ${stepName} data:`, error)
      // Continue anyway - user can adjust in settings later
    }
  }

  const handleNext = async () => {
    const stepName = STEPS[currentStep]

    // Save data for the current step (except welcome)
    if (stepName !== 'welcome') {
      await saveStepData(stepName)
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      await completeOnboarding()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSkip = async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      await completeOnboarding()
    }
  }

  const handleSkipAll = async () => {
    await completeOnboarding()
  }

  const completeOnboarding = async () => {
    setSaving(true)
    try {
      await api.patch('/users/settings', {
        hasCompletedOnboarding: true
      })
    } catch (error) {
      console.error('Error completing onboarding:', error)
    } finally {
      setSaving(false)
      onComplete()
    }
  }

  const renderStep = () => {
    switch (STEPS[currentStep]) {
      case 'welcome':
        return <WelcomeStep />
      case 'privacy':
        return (
          <PrivacyStep
            selected={data.profileVisibility}
            onSelect={(value) => updateData({ profileVisibility: value })}
          />
        )
      case 'training':
        return (
          <TrainingStep
            data={data}
            updateData={updateData}
            showEquipment={showEquipment}
            setShowEquipment={setShowEquipment}
          />
        )
      case 'bodyStats':
        return (
          <BodyStatsStep
            data={data}
            updateData={updateData}
            showDietary={showDietary}
            setShowDietary={setShowDietary}
          />
        )
      case 'notifications':
        return (
          <NotificationsStep
            data={data}
            updateData={updateData}
          />
        )
      default:
        return null
    }
  }

  const isLastStep = currentStep === STEPS.length - 1
  const isFirstStep = currentStep === 0

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4">
      <div className="bg-dark-card w-full max-w-lg rounded-3xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Progress Indicator */}
        <WizardProgress currentStep={currentStep} totalSteps={STEPS.length} />

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto">
          {renderStep()}
        </div>

        {/* Navigation Footer */}
        <div className="p-4 border-t border-dark-border">
          <div className="flex gap-3">
            {!isFirstStep && (
              <button
                onClick={handleBack}
                className="flex-1 py-3 bg-dark-elevated text-gray-300 font-medium rounded-xl hover:bg-dark-border transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex-1 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Finishing...
                </span>
              ) : isFirstStep ? (
                "Let's Go"
              ) : isLastStep ? (
                'Get Started'
              ) : (
                'Continue'
              )}
            </button>
          </div>

          {/* Skip Options */}
          {!isFirstStep && (
            <div className="mt-3 text-center">
              <button
                onClick={handleSkip}
                className="text-gray-500 text-sm hover:text-gray-300 transition-colors"
              >
                Skip this step
              </button>
              <span className="mx-2 text-gray-600">|</span>
              <button
                onClick={handleSkipAll}
                className="text-gray-500 text-sm hover:text-gray-300 transition-colors"
              >
                Skip all and finish
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
