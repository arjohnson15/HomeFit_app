import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import ChatWidget from '../components/ChatWidget'
import { useWorkoutSocket } from '../hooks/useWorkoutSocket'
import { SocialSection } from '../components/SocialCards'
import WeightTrackingCard from '../components/WeightTrackingCard'
import { SyncStatus } from '../components/SyncStatus'
import { useOfflineWorkout } from '../hooks/useOfflineWorkout'
import ExerciseCatalogModal from '../components/ExerciseCatalogModal'
import CopyWorkoutModal from '../components/CopyWorkoutModal'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Marathon map helpers
function getPositionAlongRoute(routeData, fraction) {
  if (!routeData || routeData.length < 2) return routeData?.[0] || [0, 0]
  if (fraction <= 0) return routeData[0]
  if (fraction >= 1) return routeData[routeData.length - 1]
  let totalLen = 0
  const segLengths = []
  for (let i = 1; i < routeData.length; i++) {
    const d = Math.sqrt(Math.pow(routeData[i][0] - routeData[i - 1][0], 2) + Math.pow(routeData[i][1] - routeData[i - 1][1], 2))
    segLengths.push(d)
    totalLen += d
  }
  const targetLen = totalLen * fraction
  let accum = 0
  for (let i = 0; i < segLengths.length; i++) {
    if (accum + segLengths[i] >= targetLen) {
      const segFraction = (targetLen - accum) / segLengths[i]
      return [routeData[i][0] + (routeData[i + 1][0] - routeData[i][0]) * segFraction, routeData[i][1] + (routeData[i + 1][1] - routeData[i][1]) * segFraction]
    }
    accum += segLengths[i]
  }
  return routeData[routeData.length - 1]
}

function splitRoute(routeData, fraction) {
  if (!routeData || routeData.length < 2) return { completed: routeData || [], remaining: [] }
  if (fraction >= 1) return { completed: routeData, remaining: [] }
  if (fraction <= 0) return { completed: [], remaining: routeData }
  const midPoint = getPositionAlongRoute(routeData, fraction)
  let totalLen = 0
  const segLengths = []
  for (let i = 1; i < routeData.length; i++) {
    const d = Math.sqrt(Math.pow(routeData[i][0] - routeData[i - 1][0], 2) + Math.pow(routeData[i][1] - routeData[i - 1][1], 2))
    segLengths.push(d)
    totalLen += d
  }
  const targetLen = totalLen * fraction
  let accum = 0, splitIdx = 0
  for (let i = 0; i < segLengths.length; i++) {
    if (accum + segLengths[i] >= targetLen) { splitIdx = i + 1; break }
    accum += segLengths[i]
  }
  return { completed: [...routeData.slice(0, splitIdx), midPoint], remaining: [midPoint, ...routeData.slice(splitIdx)] }
}

function FitBounds({ route }) {
  const map = useMap()
  useEffect(() => {
    if (route && route.length > 1) map.fitBounds(route, { padding: [30, 30] })
  }, [route, map])
  return null
}

function Today() {
  const [todayWorkout, setTodayWorkout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [workoutStarted, setWorkoutStarted] = useState(false)
  const [workoutPaused, setWorkoutPaused] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [activeSession, setActiveSession] = useState(null)
  const [exerciseLogs, setExerciseLogs] = useState({})
  const [expandedExercise, setExpandedExercise] = useState(null)
  const [exerciseHistory, setExerciseHistory] = useState({})
  const [exerciseDetails, setExerciseDetails] = useState({})
  const [restTimer, setRestTimer] = useState(0)
  const [restTimerRunning, setRestTimerRunning] = useState(false)
  const [showRestTimer, setShowRestTimer] = useState(false)
  const [defaultRestTime, setDefaultRestTime] = useState(90)
  const [stats, setStats] = useState({ thisWeek: 0, streak: 0, prs: 0 })
  const [completedWorkouts, setCompletedWorkouts] = useState([])
  const [todaySummary, setTodaySummary] = useState(null)
  const [newPRs, setNewPRs] = useState([])
  const [expandedCompletedWorkout, setExpandedCompletedWorkout] = useState(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showExerciseModal, setShowExerciseModal] = useState(null)
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [todaySource, setTodaySource] = useState('none') // 'weekly', 'calendar', or 'none'
  const [showHistoryFor, setShowHistoryFor] = useState(null)
  const [userTrainingStyle, setUserTrainingStyle] = useState('GENERAL')
  const [socialSettings, setSocialSettings] = useState(null)
  const [aiTips, setAiTips] = useState({})
  const [setDifficulty, setSetDifficulty] = useState({}) // Track which set is showing difficulty picker
  // Warmup, Cooldown, and Recurring Workouts
  const [warmupData, setWarmupData] = useState({ warmups: [], tip: null, enabled: true })
  const [cooldownData, setCooldownData] = useState({ cooldowns: [], tip: null, enabled: true })
  const [recurringWorkouts, setRecurringWorkouts] = useState([])
  const [warmupChecked, setWarmupChecked] = useState({})
  const [cooldownChecked, setCooldownChecked] = useState({})
  const [warmupToggleOn, setWarmupToggleOn] = useState(() => {
    const saved = localStorage.getItem('warmupToggleOn')
    return saved === 'true'
  }) // Toggle state (initialized from localStorage, then settings)
  const [cooldownToggleOn, setCooldownToggleOn] = useState(() => {
    const saved = localStorage.getItem('cooldownToggleOn')
    return saved === 'true'
  }) // Toggle state (initialized from localStorage, then settings)
  const [warmupCollapsed, setWarmupCollapsed] = useState(true) // Warmup collapsed by default
  const [cooldownCollapsed, setCooldownCollapsed] = useState(true) // Cooldown collapsed by default
  const [expandedRecurringWorkout, setExpandedRecurringWorkout] = useState(null) // Track which recurring workout is expanded
  const [showWeightTracking, setShowWeightTracking] = useState(false) // Weight tracking feature
  const [weightUnit, setWeightUnit] = useState('LBS') // User's preferred weight unit
  const [showStillWorkingOut, setShowStillWorkingOut] = useState(false) // Runaway timer prompt
  const [showEditTimer, setShowEditTimer] = useState(false) // Edit timer modal
  const [editedTime, setEditedTime] = useState({ hours: 0, minutes: 0 }) // For editing elapsed time
  const [lastTimerCheck, setLastTimerCheck] = useState(0) // Track when we last prompted
  const [exerciseNicknames, setExerciseNicknames] = useState({}) // User's personal nicknames for exercises
  const [restTimerSoundEnabled, setRestTimerSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('restTimerSoundEnabled')
    return saved !== 'false' // Default to true if not set
  })
  const [lastSessionCollapsed, setLastSessionCollapsed] = useState(false) // Last session collapsed state
  const [showOlderSessions, setShowOlderSessions] = useState(false) // Show older sessions beyond the last one
  const [hiddenExercises, setHiddenExercises] = useState(() => {
    const dateKey = new Date().toISOString().split('T')[0]
    try {
      const saved = localStorage.getItem(`hiddenExercises-${dateKey}`)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  // Digital Race tracking
  const [activeRace, setActiveRace] = useState(null) // Active non-passive race
  const [passiveRace, setPassiveRace] = useState(null) // Across America passive race
  const [raceExpanded, setRaceExpanded] = useState(false)
  const [showAcrossAmerica, setShowAcrossAmerica] = useState(false)
  const navigate = useNavigate()
  const timerRef = useRef(null)
  const restTimerRef = useRef(null)
  const audioContextRef = useRef(null) // For rest timer sound
  const isRemoteUpdateRef = useRef(false) // Track if update is from another tab/device
  const chatWidgetRef = useRef(null) // Ref to control ChatWidget programmatically

  // Offline-first workout support
  const {
    isOnline,
    pendingSyncCount,
    cacheWorkoutData,
    cacheHistory,
    getCachedWorkout,
    getCachedExerciseDetails,
    getCachedHistory,
    startWorkout: startWorkoutOffline,
    logExercise: logExerciseOffline,
    completeSet: completeSetOffline,
    togglePause: togglePauseOffline,
    endWorkout: endWorkoutOffline,
    cancelWorkout: cancelWorkoutOffline
  } = useOfflineWorkout()

  // Function to ask AI about an exercise/warmup/cooldown
  const askAIAbout = (exerciseName, type = 'exercise') => {
    const questions = {
      exercise: `Can you explain how to properly perform "${exerciseName}"? Include proper form, common mistakes to avoid, and any tips for beginners.`,
      warmup: `Can you explain the warmup "${exerciseName}"? How do I perform it correctly, what muscles does it target, and why is it beneficial before my workout?`,
      cooldown: `Can you explain the cooldown "${exerciseName}"? How do I perform it correctly and what are its benefits for recovery?`
    }
    chatWidgetRef.current?.openWithQuestion(questions[type])
  }

  // Socket event handlers for real-time sync
  const handleWorkoutStarted = useCallback((data) => {
    console.log('[Sync] Workout started on another device:', data)
    isRemoteUpdateRef.current = true
    // Reload active workout from server to get fresh data
    window.location.reload() // Simple approach - reload to sync state
  }, [])

  const handleWorkoutPaused = useCallback((data) => {
    console.log('[Sync] Workout pause state changed:', data)
    isRemoteUpdateRef.current = true
    setWorkoutPaused(data.isPaused)
    setElapsedTime(data.elapsedTime)
    setTimeout(() => { isRemoteUpdateRef.current = false }, 100)
  }, [])

  const handleWorkoutEnded = useCallback((data) => {
    console.log('[Sync] Workout ended on another device:', data)
    isRemoteUpdateRef.current = true
    // Reset local state
    setWorkoutStarted(false)
    setWorkoutPaused(false)
    setElapsedTime(0)
    setActiveSession(null)
    setExpandedExercise(null)
    setNewPRs([])
    setAiTips({})
    setRestTimer(0)
    setRestTimerRunning(false)
    setShowRestTimer(false)
    // Refresh completed workouts
    fetchCompletedWorkouts()
    fetchStats()
    setTimeout(() => { isRemoteUpdateRef.current = false }, 100)
  }, [])

  const handleWorkoutCanceled = useCallback((data) => {
    console.log('[Sync] Workout canceled on another device:', data)
    isRemoteUpdateRef.current = true
    // Reset local state
    setWorkoutStarted(false)
    setWorkoutPaused(false)
    setElapsedTime(0)
    setActiveSession(null)
    setExpandedExercise(null)
    setNewPRs([])
    setAiTips({})
    setRestTimer(0)
    setRestTimerRunning(false)
    setShowRestTimer(false)
    setTimeout(() => { isRemoteUpdateRef.current = false }, 100)
  }, [])

  const handleRestTimerSync = useCallback((data) => {
    console.log('[Sync] Rest timer updated:', data)
    isRemoteUpdateRef.current = true
    setRestTimer(data.restTimer)
    setRestTimerRunning(data.restTimerRunning)
    setShowRestTimer(data.showRestTimer)
    setTimeout(() => { isRemoteUpdateRef.current = false }, 100)
  }, [])

  const handleSetLogged = useCallback((data) => {
    console.log('[Sync] Set logged on another device:', data)
    isRemoteUpdateRef.current = true
    if (data.exerciseLogs) {
      setExerciseLogs(data.exerciseLogs)
    }
    setTimeout(() => { isRemoteUpdateRef.current = false }, 100)
  }, [])

  const handleTimerUpdate = useCallback((data) => {
    // Only sync if difference is significant (more than 2 seconds)
    if (Math.abs(data.elapsedTime - elapsedTime) > 2) {
      isRemoteUpdateRef.current = true
      setElapsedTime(data.elapsedTime)
      setWorkoutPaused(data.isPaused)
      setTimeout(() => { isRemoteUpdateRef.current = false }, 100)
    }
  }, [elapsedTime])

  // Initialize socket for real-time sync
  const {
    emitWorkoutStart,
    emitWorkoutPause,
    emitWorkoutEnd,
    emitWorkoutCancel,
    emitRestTimer,
    emitSetLogged,
    emitTimerSync
  } = useWorkoutSocket({
    onWorkoutStarted: handleWorkoutStarted,
    onWorkoutPaused: handleWorkoutPaused,
    onWorkoutEnded: handleWorkoutEnded,
    onWorkoutCanceled: handleWorkoutCanceled,
    onRestTimerSync: handleRestTimerSync,
    onSetLogged: handleSetLogged,
    onTimerUpdate: handleTimerUpdate
  })

  // Play notification sound when rest timer ends
  const playRestTimerSound = useCallback(() => {
    if (!restTimerSoundEnabled) return

    try {
      // Create audio context if not exists
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      const ctx = audioContextRef.current

      // Resume context if suspended (required for mobile)
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      // Create a pleasant two-tone notification sound
      const playTone = (frequency, startTime, duration) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscillator.frequency.value = frequency
        oscillator.type = 'sine'

        // Envelope for smooth sound
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05)
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration)

        oscillator.start(startTime)
        oscillator.stop(startTime + duration)
      }

      const now = ctx.currentTime
      // Play a pleasant "ding ding" notification
      playTone(880, now, 0.15)        // A5
      playTone(1100, now + 0.15, 0.2) // C#6
      playTone(1320, now + 0.35, 0.3) // E6
    } catch (error) {
      console.error('Error playing rest timer sound:', error)
    }
  }, [restTimerSoundEnabled])

  // Toggle rest timer sound setting
  const toggleRestTimerSound = () => {
    const newValue = !restTimerSoundEnabled
    setRestTimerSoundEnabled(newValue)
    localStorage.setItem('restTimerSoundEnabled', newValue.toString())
  }

  // Load timer settings from localStorage
  useEffect(() => {
    const savedTimer = localStorage.getItem('timerSettings')
    if (savedTimer) {
      const timerSettings = JSON.parse(savedTimer)
      if (timerSettings.defaultRestTime) {
        setDefaultRestTime(timerSettings.defaultRestTime)
      }
    }
  }, [])

  // Clean up old hidden exercises from localStorage (keep only last 7 days)
  useEffect(() => {
    const today = new Date()
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith('hiddenExercises-')) {
        const dateStr = key.replace('hiddenExercises-', '')
        const entryDate = new Date(dateStr)
        const daysDiff = (today - entryDate) / (1000 * 60 * 60 * 24)
        if (daysDiff > 7) {
          localStorage.removeItem(key)
        }
      }
    }
  }, [])

  // Fetch warmup and cooldown suggestions
  const fetchWarmupSuggestions = async () => {
    try {
      const response = await api.get('/schedules/warmup-suggestions')
      setWarmupData(response.data)
      // Initialize toggle state from settings (defaultOn controls initial state)
      // Only set if no localStorage preference exists (first time user)
      if (localStorage.getItem('warmupToggleOn') === null && response.data.enabled && response.data.warmups?.length > 0 && response.data.defaultOn) {
        setWarmupToggleOn(true)
        localStorage.setItem('warmupToggleOn', 'true')
      }
    } catch (error) {
      console.error('Error fetching warmup suggestions:', error)
    }
  }

  const fetchCooldownSuggestions = async () => {
    try {
      const response = await api.get('/schedules/cooldown-suggestions')
      setCooldownData(response.data)
      // Initialize toggle state from settings (defaultOn controls initial state)
      // Only set if no localStorage preference exists (first time user)
      if (localStorage.getItem('cooldownToggleOn') === null && response.data.enabled && response.data.cooldowns?.length > 0 && response.data.defaultOn) {
        setCooldownToggleOn(true)
        localStorage.setItem('cooldownToggleOn', 'true')
      }
    } catch (error) {
      console.error('Error fetching cooldown suggestions:', error)
    }
  }

  const dismissTip = async (tipId) => {
    try {
      await api.post('/schedules/dismiss-tip', { tipId })
      // Remove tip from both warmup and cooldown data
      setWarmupData(prev => prev.tip?.id === tipId ? { ...prev, tip: null } : prev)
      setCooldownData(prev => prev.tip?.id === tipId ? { ...prev, tip: null } : prev)
    } catch (error) {
      console.error('Error dismissing tip:', error)
    }
  }

  // Fetch today's workout and check for active session
  useEffect(() => {
    // Restore exercise logs with workout context for proper matching
    // Returns { logs, adhocExercises } where adhocExercises are exercises not in the schedule
    const restoreExerciseLogsFromActive = (active, workout, logs) => {
      if (!active?.exerciseLogs?.length) return { logs, adhocExercises: [] }

      const updated = { ...logs }
      const adhocExercises = []

      active.exerciseLogs.forEach(log => {
        // Find the scheduled exercise that matches this log's exerciseId
        const matchingExercise = workout?.exercises?.find(ex => ex.exerciseId === log.exerciseId)
        const matchingKey = matchingExercise?.id

        // Restore all logged sets, including any that were dynamically added
        const restoredSets = log.sets.map(loggedSet => ({
          setNumber: loggedSet.setNumber,
          reps: loggedSet.reps?.toString() || '',
          weight: loggedSet.weight?.toString() || '',
          completed: true,
          isPR: loggedSet.isPR || false,
          difficulty: null
        }))
        // Add an empty set at the end for the next entry
        restoredSets.push({
          setNumber: restoredSets.length + 1,
          reps: '',
          weight: '',
          completed: false,
          isPR: false,
          difficulty: null
        })

        if (matchingKey && updated[matchingKey]) {
          // Exercise is in the schedule - update its log
          updated[matchingKey] = {
            ...updated[matchingKey],
            logId: log.id,
            sets: restoredSets,
            completed: false // Still in progress
          }
        } else {
          // Exercise is NOT in the schedule - it's an ad-hoc exercise
          const adhocId = `adhoc-restored-${log.id}`
          adhocExercises.push({
            id: adhocId,
            exerciseId: log.exerciseId,
            exerciseName: log.exerciseName,
            sets: 3,
            reps: '8-12',
            isAdhoc: true
          })
          updated[adhocId] = {
            completed: false,
            logId: log.id,
            targetSets: 3,
            isAdhoc: true,
            sets: restoredSets
          }
        }
      })
      return { logs: updated, adhocExercises }
    }

    const fetchUserProfile = async () => {
      try {
        const response = await api.get('/users/profile')
        setUserTrainingStyle(response.data.user.trainingStyle || 'GENERAL')
        // Set social settings for the social cards section
        if (response.data.user.settings) {
          setSocialSettings(response.data.user.settings)
          // Set weight tracking settings
          setShowWeightTracking(response.data.user.settings.showWeightTracking || false)
          setWeightUnit(response.data.user.settings.weightUnit || 'LBS')
        }
      } catch (error) {
        console.error('Error fetching user profile:', error)
      }
    }

    // Run in sequence to avoid race conditions
    const initWorkout = async () => {
      // First fetch today's workout and initialize logs
      let workout = null
      let recurringWkts = []
      let logs = {}

      try {
        const response = await api.get('/schedules/today')
        workout = response.data.workout
        recurringWkts = response.data.recurringWorkouts || []
        setTodaySource(response.data.source || 'none')

        if (workout) {
          cacheWorkoutData(workout, workout.exercises?.map(e => ({ id: e.exerciseId, ...e })))
        }
      } catch (error) {
        console.error('Error fetching today workout:', error)
        if (!isOnline || error.response?.status === 503) {
          try {
            const cachedWorkout = await getCachedWorkout()
            if (cachedWorkout) {
              workout = cachedWorkout
            }
          } catch (cacheError) {
            console.error('Error loading cached workout:', cacheError)
          }
        }
      }

      setTodayWorkout(workout)
      setRecurringWorkouts(recurringWkts)

      // Initialize exercise logs
      if (workout?.exercises) {
        workout.exercises.forEach(ex => {
          logs[ex.id] = {
            completed: false,
            logId: null,
            targetSets: ex.sets,
            sets: [{
              setNumber: 1,
              reps: '',
              weight: '',
              completed: false,
              isPR: false,
              difficulty: null
            }]
          }
        })
      }

      if (recurringWkts?.length > 0) {
        recurringWkts.forEach(recurring => {
          recurring.exercises?.forEach((ex, idx) => {
            const uniqueId = `recurring-${recurring.id}-${idx}`
            logs[uniqueId] = {
              completed: false,
              logId: null,
              targetSets: ex.sets || 3,
              isRecurring: true,
              recurringWorkoutId: recurring.id,
              sets: [{
                setNumber: 1,
                reps: '',
                weight: '',
                completed: false,
                isPR: false,
                difficulty: null
              }]
            }
          })
        })
      }

      // Now check for active workout and restore logs if present
      try {
        const response = await api.get('/workouts/active')
        const active = response.data.activeWorkout

        if (active) {
          setActiveSession(active)
          setWorkoutStarted(true)

          const startTime = new Date(active.startTime)
          const now = new Date()
          const totalPausedTime = active.totalPausedTime || 0

          if (active.pausedAt) {
            const pausedAtTime = new Date(active.pausedAt)
            const elapsed = Math.floor((pausedAtTime - startTime) / 1000) - totalPausedTime
            setElapsedTime(Math.max(0, elapsed))
            setWorkoutPaused(true)
          } else {
            const elapsed = Math.floor((now - startTime) / 1000) - totalPausedTime
            setElapsedTime(Math.max(0, elapsed))
            setWorkoutPaused(false)
          }

          if (active.restTimerEndAt) {
            const endTime = new Date(active.restTimerEndAt)
            const remaining = Math.floor((endTime - now) / 1000)
            if (remaining > 0) {
              setRestTimer(remaining)
              setRestTimerRunning(true)
              setShowRestTimer(true)
            }
          }

          // Restore logs with proper matching using workout context
          const restored = restoreExerciseLogsFromActive(active, workout, logs)
          logs = restored.logs

          // If there are ad-hoc exercises (not in schedule), add them to the workout display
          if (restored.adhocExercises.length > 0) {
            workout = {
              ...workout,
              exercises: [...(workout?.exercises || []), ...restored.adhocExercises]
            }
            setTodayWorkout(workout)
          }
        }
      } catch (error) {
        console.error('Error checking active workout:', error)
      }

      setExerciseLogs(logs)
      setLoading(false)
    }

    initWorkout()
    fetchStats()
    fetchCompletedWorkouts()
    fetchUserProfile()
    fetchWarmupSuggestions()
    fetchCooldownSuggestions()
    fetchRaceData()
  }, [])

  // Fetch completed workouts for today
  const fetchCompletedWorkouts = async () => {
    try {
      const response = await api.get('/workouts/today/completed')
      setCompletedWorkouts(response.data.workouts || [])
      setTodaySummary(response.data.summary)
    } catch (error) {
      console.error('Error fetching completed workouts:', error)
    }
  }

  // Fetch stats
  const fetchStats = async () => {
    try {
      const [workoutsRes, prsRes] = await Promise.all([
        api.get('/workouts?limit=100'),
        api.get('/workouts/stats/prs')
      ])
      const workouts = workoutsRes.data.workouts || []
      const prCount = prsRes.data.prCount || 0

      // Calculate this week
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const thisWeek = workouts.filter(w => new Date(w.date) >= weekStart).length

      // Calculate streak (simplified)
      let streak = 0
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today)
        checkDate.setDate(checkDate.getDate() - i)
        const hasWorkout = workouts.some(w => {
          const wDate = new Date(w.date)
          wDate.setHours(0, 0, 0, 0)
          return wDate.getTime() === checkDate.getTime()
        })
        if (hasWorkout) {
          streak++
        } else if (i > 0) {
          break
        }
      }

      setStats({ thisWeek, streak, prs: prCount })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  // Fetch race data for Digital Races section
  const fetchRaceData = async () => {
    try {
      const res = await api.get('/marathons/my/active')
      const userMarathons = res.data.userMarathons || []
      const active = userMarathons.find(um => um.status === 'active' && !um.isPassive)
      const passive = userMarathons.find(um => um.isPassive && um.status === 'active')
      setActiveRace(active || null)
      setPassiveRace(passive || null)
    } catch (err) {
      // Silently fail - race data is supplementary
    }
  }

  // Fetch exercise history when expanding
  const fetchExerciseHistory = async (exerciseId) => {
    if (exerciseHistory[exerciseId]) return // Already fetched

    try {
      const response = await api.get(`/workouts/exercise/${exerciseId}/history?limit=5`)
      const historyData = {
        history: response.data.history || [],
        lastSession: response.data.lastSession,
        pr: response.data.pr
      }

      setExerciseHistory(prev => ({
        ...prev,
        [exerciseId]: historyData
      }))

      // Cache for offline use
      cacheHistory(exerciseId, historyData)
    } catch (error) {
      console.error('Error fetching exercise history:', error)

      // Try to load from cache if offline
      if (!isOnline) {
        try {
          const cachedHistory = await getCachedHistory(exerciseId)
          if (cachedHistory) {
            setExerciseHistory(prev => ({
              ...prev,
              [exerciseId]: cachedHistory
            }))
          }
        } catch (cacheError) {
          console.error('Error loading cached history:', cacheError)
        }
      }
    }
  }

  // Fetch exercise details (images, instructions)
  const fetchExerciseDetails = async (exerciseId) => {
    if (exerciseDetails[exerciseId]) return

    try {
      const response = await api.get(`/exercises/${exerciseId}`)
      setExerciseDetails(prev => ({
        ...prev,
        [exerciseId]: response.data.exercise
      }))
    } catch (error) {
      // Try to load from cache if offline
      if (!isOnline) {
        try {
          const cachedExercise = await getCachedExerciseDetails(exerciseId)
          if (cachedExercise) {
            setExerciseDetails(prev => ({
              ...prev,
              [exerciseId]: cachedExercise
            }))
            return
          }
        } catch (cacheError) {
          console.error('Error loading cached exercise:', cacheError)
        }
      }
      console.error('Error fetching exercise details:', error)
    }
  }

  // Load nicknames for exercises in today's workout and recurring workouts
  useEffect(() => {
    const loadNicknames = async () => {
      const exerciseIds = new Set()

      // Add exercise IDs from today's workout
      todayWorkout?.exercises?.forEach(e => exerciseIds.add(e.exerciseId))

      // Add exercise IDs from recurring workouts
      recurringWorkouts?.forEach(rw => {
        rw.exercises?.forEach(e => exerciseIds.add(e.exerciseId))
      })

      if (exerciseIds.size === 0) return

      try {
        const response = await api.post('/exercises/preferences/batch', { ids: Array.from(exerciseIds) })
        const nicknameMap = {}
        response.data.preferences?.forEach(p => {
          if (p.nickname) {
            nicknameMap[p.exerciseId] = p.nickname
          }
        })
        setExerciseNicknames(nicknameMap)
      } catch (error) {
        console.error('Error loading nicknames:', error)
      }
    }
    loadNicknames()
  }, [todayWorkout?.exercises, recurringWorkouts])

  // Get display name for an exercise (nickname or original name)
  const getDisplayName = (exercise) => {
    const nickname = exerciseNicknames[exercise.exerciseId]
    return nickname || exercise.exerciseName
  }

  // Auto-fill sets from last session's data
  const autoFillFromHistory = (scheduleExId, exerciseId) => {
    const history = exerciseHistory[exerciseId]
    if (!history?.lastSession?.sets) return

    setExerciseLogs(prev => {
      const log = prev[scheduleExId]
      if (!log) return prev

      const updatedSets = log.sets.map((set, i) => {
        const historySet = history.lastSession.sets[i]
        if (historySet && !set.completed) {
          return {
            ...set,
            weight: historySet.weight?.toString() || '',
            reps: historySet.reps?.toString() || ''
          }
        }
        return set
      })

      return {
        ...prev,
        [scheduleExId]: {
          ...log,
          sets: updatedSets
        }
      }
    })
  }

  // Load a single historical set's values into the current (first uncompleted) set
  const loadHistoricalSet = (exerciseScheduleId, historicalSet) => {
    setExerciseLogs(prev => {
      const log = prev[exerciseScheduleId]
      if (!log) return prev

      const targetIndex = log.sets.findIndex(s => !s.completed)
      if (targetIndex === -1) return prev

      return {
        ...prev,
        [exerciseScheduleId]: {
          ...log,
          sets: log.sets.map((set, i) =>
            i === targetIndex ? {
              ...set,
              weight: historicalSet.weight > 0 ? historicalSet.weight.toString() : '',
              reps: historicalSet.reps ? historicalSet.reps.toString() : ''
            } : set
          )
        }
      }
    })
  }

  // Get rule-based suggestion (no API call) - for automatic suggestions
  const getRuleBasedSuggestion = async (exercise, completedSets, targetSetIndex) => {
    try {
      const history = exerciseHistory[exercise.exerciseId]

      // Get difficulty from last completed set if any
      const lastCompletedSet = completedSets.length > 0 ? completedSets[completedSets.length - 1] : null
      const lastDifficulty = lastCompletedSet?.difficulty

      const response = await api.post('/ai/suggest-set', {
        exerciseName: exercise.exerciseName,
        lastSets: completedSets,
        trainingStyle: userTrainingStyle,
        pr: history?.pr,
        setNumber: targetSetIndex + 1,
        difficultyFeedback: lastDifficulty
      })

      if (response.data.suggestion) {
        // Store suggestion with source info
        setAiTips(prev => ({
          ...prev,
          [exercise.id]: {
            ...response.data.suggestion,
            source: response.data.source // 'ai' or 'rules'
          }
        }))

        // Only auto-fill if suggestion has actual values (not null)
        const suggestion = response.data.suggestion
        if (suggestion.weight !== null || suggestion.reps !== null) {
          setExerciseLogs(prev => {
            const currentLog = prev[exercise.id]
            if (!currentLog || targetSetIndex >= currentLog.sets.length) return prev

            return {
              ...prev,
              [exercise.id]: {
                ...currentLog,
                sets: currentLog.sets.map((s, i) =>
                  i === targetSetIndex && !s.completed ? {
                    ...s,
                    weight: suggestion.weight !== null ? suggestion.weight.toString() : s.weight,
                    reps: suggestion.reps !== null ? suggestion.reps.toString() : s.reps
                  } : s
                )
              }
            }
          })
        }
      }
    } catch (error) {
      console.error('Error getting suggestion:', error)
    }
  }

  // Get AI-powered suggestion (uses API call) - only when user clicks button
  const getAiTip = async (exercise) => {
    try {
      const log = exerciseLogs[exercise.id]
      const history = exerciseHistory[exercise.exerciseId]

      // Build completed sets from current session
      const completedSets = log?.sets
        .filter(s => s.completed)
        .map(s => ({ weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps) || 0, difficulty: s.difficulty })) || []

      const lastDifficulty = completedSets.length > 0 ? completedSets[completedSets.length - 1]?.difficulty : null

      // Set loading state
      setAiTips(prev => ({
        ...prev,
        [exercise.id]: { ...prev[exercise.id], loading: true }
      }))

      // Call the AI endpoint with useAi=true
      const response = await api.post('/ai/suggest-set', {
        exerciseName: exercise.exerciseName,
        lastSets: completedSets,
        trainingStyle: userTrainingStyle,
        pr: history?.pr,
        setNumber: (log?.sets.findIndex(s => !s.completed) ?? 0) + 1,
        difficultyFeedback: lastDifficulty,
        useAi: true // Explicitly request AI
      })

      if (response.data.suggestion) {
        setAiTips(prev => ({
          ...prev,
          [exercise.id]: {
            ...response.data.suggestion,
            source: response.data.source,
            loading: false
          }
        }))
      }
    } catch (error) {
      console.error('Error getting AI tip:', error)
      setAiTips(prev => ({
        ...prev,
        [exercise.id]: {
          ...prev[exercise.id],
          tip: 'Failed to get AI tip. Check your API key in Settings.',
          source: 'error',
          loading: false
        }
      }))
    }
  }

  // Workout timer - respects pause state
  useEffect(() => {
    if (workoutStarted && !workoutPaused) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [workoutStarted, workoutPaused])

  // Periodic timer sync across tabs (every 10 seconds)
  useEffect(() => {
    if (!workoutStarted || !activeSession?.id) return

    const syncInterval = setInterval(() => {
      if (!isRemoteUpdateRef.current) {
        emitTimerSync(activeSession.id, elapsedTime, workoutPaused)
      }
    }, 10000) // Sync every 10 seconds

    return () => clearInterval(syncInterval)
  }, [workoutStarted, activeSession?.id, elapsedTime, workoutPaused, emitTimerSync])

  // Runaway timer check - prompt after 2 hours, then every 30 minutes
  useEffect(() => {
    const TWO_HOURS = 2 * 60 * 60 // 7200 seconds
    const THIRTY_MINUTES = 30 * 60 // 1800 seconds

    if (workoutStarted && !workoutPaused && elapsedTime >= TWO_HOURS) {
      // Check if enough time has passed since last prompt
      if (elapsedTime - lastTimerCheck >= THIRTY_MINUTES || lastTimerCheck === 0) {
        setWorkoutPaused(true) // Pause the timer
        setShowStillWorkingOut(true)
        setLastTimerCheck(elapsedTime)
      }
    }
  }, [workoutStarted, workoutPaused, elapsedTime, lastTimerCheck])

  // Rest timer
  useEffect(() => {
    if (restTimerRunning && restTimer > 0) {
      restTimerRef.current = setInterval(() => {
        setRestTimer(prev => {
          if (prev <= 1) {
            setRestTimerRunning(false)
            setShowRestTimer(false)
            // Clear from database
            if (activeSession) {
              api.post(`/workouts/${activeSession.id}/rest`, { duration: 0 }).catch(() => {})
            }
            // Play sound and vibrate to notify user
            playRestTimerSound()
            if ('vibrate' in navigator) {
              navigator.vibrate([200, 100, 200])
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else if (restTimerRef.current) {
      clearInterval(restTimerRef.current)
    }
    return () => clearInterval(restTimerRef.current)
  }, [restTimerRunning, restTimer, activeSession, playRestTimerSound])

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hrs > 0) {
      return `${hrs}h ${mins}m`
    }
    return `${mins}m`
  }

  const formatTimeLong = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hrs > 0 && mins > 0) {
      return `${hrs} hour${hrs > 1 ? 's' : ''} and ${mins} minute${mins > 1 ? 's' : ''}`
    } else if (hrs > 0) {
      return `${hrs} hour${hrs > 1 ? 's' : ''}`
    }
    return `${mins} minute${mins > 1 ? 's' : ''}`
  }

  const startWorkout = async () => {
    // Reset local timer state before starting fresh
    setRestTimer(0)
    setRestTimerRunning(false)
    setShowRestTimer(false)
    setElapsedTime(0)
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current)
    }

    // Use offline-first approach
    const result = await startWorkoutOffline({
      name: todayWorkout?.name || 'Workout',
      scheduledWorkoutId: todayWorkout?.id
    })

    if (result.success) {
      setActiveSession(result.workout)
      setWorkoutStarted(true)
      setWorkoutPaused(false)
      setNewPRs([])

      // Emit socket event for real-time sync (only if online)
      if (!result.offline) {
        emitWorkoutStart(
          result.workout.id,
          result.workout.startTime,
          todayWorkout?.name || 'Workout'
        )
      }
    }
  }

  const togglePause = async () => {
    if (!activeSession) return

    try {
      const response = await api.post(`/workouts/${activeSession.id}/pause`)
      const newPausedState = response.data.isPaused
      setWorkoutPaused(newPausedState)
      setActiveSession(response.data.workout)

      // Emit socket event for real-time sync (only if not a remote update)
      if (!isRemoteUpdateRef.current) {
        emitWorkoutPause(
          activeSession.id,
          newPausedState,
          elapsedTime,
          newPausedState ? new Date().toISOString() : null
        )
      }
    } catch (error) {
      console.error('Error toggling pause:', error)
      // Fallback to local state toggle
      setWorkoutPaused(prev => !prev)
    }
  }

  const endWorkout = async () => {
    const sessionId = activeSession?.id
    if (activeSession) {
      const completionData = {
        endTime: new Date().toISOString(),
        startTime: activeSession.startTime
      }

      // Use offline-first approach
      const result = await endWorkoutOffline(sessionId, completionData)

      // Emit socket event for real-time sync (only if online)
      if (!result.offline && !isRemoteUpdateRef.current && sessionId) {
        emitWorkoutEnd(sessionId, new Date().toISOString())
      }
    }
    resetWorkoutState()
    fetchStats()
    fetchCompletedWorkouts()
  }

  const cancelWorkout = async () => {
    const sessionId = activeSession?.id

    // Use offline-first approach
    const result = await cancelWorkoutOffline(sessionId)

    // Emit socket event for real-time sync (only if online)
    if (!result.offline && !isRemoteUpdateRef.current && sessionId) {
      emitWorkoutCancel(sessionId)
    }

    resetWorkoutState()
    setShowCancelConfirm(false)
  }

  const resetWorkoutState = () => {
    setWorkoutStarted(false)
    setWorkoutPaused(false)
    setElapsedTime(0)
    setActiveSession(null)
    setExpandedExercise(null)
    setNewPRs([])
    setAiTips({})

    // Clear rest timer state completely
    setRestTimer(0)
    setRestTimerRunning(false)
    setShowRestTimer(false)
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current)
    }

    // Reset exercise logs - start with 1 set
    if (todayWorkout?.exercises) {
      const logs = {}
      todayWorkout.exercises.forEach(ex => {
        logs[ex.id] = {
          completed: false,
          logId: null,
          targetSets: ex.sets,
          sets: [{
            setNumber: 1,
            reps: '',
            weight: '',
            completed: false,
            isPR: false,
            difficulty: null
          }]
        }
      })
      setExerciseLogs(logs)
    }
  }

  const deleteCompletedWorkout = async (workoutId, e) => {
    e.stopPropagation()
    if (!confirm('Delete this workout?')) return

    try {
      await api.delete(`/workouts/${workoutId}`)
      fetchCompletedWorkouts()
      fetchStats()
    } catch (error) {
      console.error('Error deleting workout:', error)
    }
  }

  const startRestTimer = async (duration = defaultRestTime) => {
    // Ensure duration is a valid number
    const validDuration = typeof duration === 'number' && !isNaN(duration) ? duration : defaultRestTime

    setRestTimer(validDuration)
    setRestTimerRunning(true)
    setShowRestTimer(true)

    // Emit socket event for real-time sync
    if (!isRemoteUpdateRef.current && activeSession?.id) {
      emitRestTimer(activeSession.id, validDuration, true, true)
    }

    // Sync to database - only if we have a valid session ID
    if (activeSession?.id) {
      try {
        await api.post(`/workouts/${activeSession.id}/rest`, { duration: validDuration })
      } catch (error) {
        // Silently fail - rest timer still works locally
        console.error('Error syncing rest timer:', error?.message || error)
      }
    }
  }

  const clearRestTimer = async () => {
    setShowRestTimer(false)
    setRestTimerRunning(false)
    setRestTimer(0)

    // Emit socket event for real-time sync
    if (!isRemoteUpdateRef.current && activeSession?.id) {
      emitRestTimer(activeSession.id, 0, false, false)
    }

    // Clear from database - only if we have a valid session ID
    if (activeSession?.id) {
      try {
        await api.post(`/workouts/${activeSession.id}/rest`, { duration: 0 })
      } catch (error) {
        // Silently fail - rest timer still works locally
        console.error('Error clearing rest timer:', error?.message || error)
      }
    }
  }

  const toggleExerciseExpand = async (exercise) => {
    if (expandedExercise === exercise.id) {
      setExpandedExercise(null)
    } else {
      setExpandedExercise(exercise.id)

      // Fetch history first
      await fetchExerciseHistory(exercise.exerciseId)
      await fetchExerciseDetails(exercise.exerciseId)

      const log = exerciseLogs[exercise.id]

      // Create exercise log if not exists (when workout started)
      let logId = log?.logId
      if (workoutStarted && activeSession && !logId) {
        try {
          const response = await api.post(`/workouts/${activeSession.id}/exercises`, {
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName
          })
          logId = response.data.exerciseLog.id
          setExerciseLogs(prev => ({
            ...prev,
            [exercise.id]: {
              ...prev[exercise.id],
              logId
            }
          }))
        } catch (error) {
          console.error('Error creating exercise log:', error)
        }
      }

      // Find first uncompleted set index
      const firstUncompletedIndex = log?.sets.findIndex(s => !s.completed) ?? 0

      // Get AI suggestion immediately for the first uncompleted set
      // Use history data to build completed sets array
      const completedSets = log?.sets
        .filter(s => s.completed)
        .map(s => ({ weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps) || 0, difficulty: s.difficulty })) || []

      await getRuleBasedSuggestion(exercise, completedSets, firstUncompletedIndex)
    }
  }

  const updateSetValue = (exerciseId, setIndex, field, value) => {
    setExerciseLogs(prev => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        sets: prev[exerciseId].sets.map((set, i) =>
          i === setIndex ? { ...set, [field]: value } : set
        )
      }
    }))
  }

  const completeSet = async (exerciseId, setIndex, exercise, difficulty = null) => {
    const log = exerciseLogs[exerciseId]
    const set = log.sets[setIndex]

    if (!set.reps) return // Need at least reps

    const setData = {
      setNumber: setIndex + 1,
      reps: parseInt(set.reps),
      weight: set.weight ? parseFloat(set.weight) : 0,
      rpe: difficulty ? difficulty * 2 : null // Convert 1-5 difficulty to 2-10 RPE scale
    }

    // Use offline-first approach
    const result = await completeSetOffline(
      activeSession?.id,
      log.logId,
      exercise.exerciseId,
      setData
    )

    // Update local state immediately (optimistic update)
    const isPR = result.isPR || false

    setExerciseLogs(prev => {
      const currentLog = prev[exerciseId]
      const updatedSets = currentLog.sets.map((s, i) =>
        i === setIndex ? { ...s, completed: true, isPR, difficulty } : s
      )

      // Auto-add next set
      const newSetNumber = updatedSets.length + 1
      updatedSets.push({
        setNumber: newSetNumber,
        reps: '',
        weight: '',
        completed: false,
        isPR: false,
        difficulty: null
      })

      return {
        ...prev,
        [exerciseId]: {
          ...currentLog,
          sets: updatedSets
        }
      }
    })

    // Track new PRs
    if (isPR) {
      setNewPRs(prev => [...prev, {
        exerciseName: exercise.exerciseName,
        weight: set.weight,
        reps: set.reps
      }])
    }

    // Build completed sets array including the one we just completed
    const completedSets = [...log.sets.filter(s => s.completed), { ...set, difficulty }]
      .map(s => ({ weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps) || 0, difficulty: s.difficulty }))

    // Auto-suggest for the new set (only if online - AI requires network)
    if (isOnline) {
      await getRuleBasedSuggestion(exercise, completedSets, setIndex + 1)
    }

    // Emit socket event for real-time sync (only if online and not offline result)
    if (!result.offline && !isRemoteUpdateRef.current && activeSession?.id) {
      emitSetLogged(activeSession.id, exerciseId, {
        setNumber: setIndex + 1,
        reps: parseInt(set.reps),
        weight: set.weight ? parseFloat(set.weight) : 0,
        isPR,
        difficulty
      }, exerciseLogs)
    }

    // Start rest timer after completing a set
    startRestTimer()
  }

  // Toggle exercise completion - allows uncompleting
  const toggleExerciseComplete = (exerciseId) => {
    const log = exerciseLogs[exerciseId]
    const isCurrentlyCompleted = log?.completed

    setExerciseLogs(prev => {
      const currentLog = prev[exerciseId]
      const newCompleted = !currentLog.completed
      let updatedSets = [...currentLog.sets]

      // When uncompleting, ensure there's an empty set to continue with
      if (!newCompleted) {
        const hasUncompletedSet = updatedSets.some(s => !s.completed)
        if (!hasUncompletedSet) {
          updatedSets.push({
            setNumber: updatedSets.length + 1,
            reps: '',
            weight: '',
            completed: false,
            isPR: false,
            difficulty: null
          })
        }
      }

      return {
        ...prev,
        [exerciseId]: {
          ...currentLog,
          completed: newCompleted,
          sets: updatedSets
        }
      }
    })

    // If uncompleting, expand it so user can continue
    if (isCurrentlyCompleted) {
      setExpandedExercise(exerciseId)
    } else {
      setExpandedExercise(null)
    }
  }

  // Add exercises to current workout ad-hoc
  const handleAddExercisesToWorkout = async (exercises) => {
    if (!exercises || exercises.length === 0) return

    // Add each exercise to the current workout display
    const newExercises = exercises.map((ex, idx) => ({
      id: `adhoc-${Date.now()}-${idx}`, // Temporary ID for display
      exerciseId: ex.id,
      exerciseName: ex.name,
      sets: 3,
      reps: '8-12',
      isAdhoc: true // Mark as ad-hoc exercise
    }))

    // Update todayWorkout to include new exercises
    setTodayWorkout(prev => ({
      ...prev,
      exercises: [...(prev?.exercises || []), ...newExercises]
    }))

    // Initialize exercise logs for new exercises
    setExerciseLogs(prev => {
      const updated = { ...prev }
      newExercises.forEach(ex => {
        updated[ex.id] = {
          completed: false,
          logId: null,
          targetSets: ex.sets,
          isAdhoc: true,
          sets: [{
            setNumber: 1,
            reps: '',
            weight: '',
            completed: false,
            isPR: false,
            difficulty: null
          }]
        }
      })
      return updated
    })

    // If workout is started, create exercise logs on server
    if (workoutStarted && activeSession) {
      for (const ex of newExercises) {
        try {
          const response = await api.post(`/workouts/${activeSession.id}/exercises`, {
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName
          })
          // Update logId for the exercise
          setExerciseLogs(prev => ({
            ...prev,
            [ex.id]: {
              ...prev[ex.id],
              logId: response.data.exerciseLog.id
            }
          }))
        } catch (error) {
          console.error('Error creating exercise log:', error)
        }
      }
    } else {
      // Persist to server as calendar workout so exercises survive refresh
      try {
        const allExercises = [...(todayWorkout?.exercises || []), ...newExercises]
        const exercisesPayload = allExercises.map((ex, i) => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          sets: ex.sets || 3,
          reps: ex.reps || '8-12',
          order: i
        }))
        const workoutName = todayWorkout?.name || 'Today\'s Workout'

        let savedWorkout = null
        if (todaySource === 'calendar' && todayWorkout?.id) {
          // Update existing calendar workout
          const res = await api.put(`/schedules/calendar/${todayWorkout.id}`, {
            name: workoutName,
            exercises: exercisesPayload
          })
          savedWorkout = res.data.event
        } else {
          // Create new calendar override for today
          const today = new Date()
          today.setHours(12, 0, 0, 0)
          const res = await api.post('/schedules/calendar', {
            date: today.toISOString(),
            name: workoutName,
            exercises: exercisesPayload
          })
          savedWorkout = res.data.event
        }
        if (savedWorkout) {
          setTodayWorkout(savedWorkout)
          setTodaySource('calendar')
          // Re-initialize exercise logs with server IDs
          const newLogs = {}
          savedWorkout.exercises?.forEach(ex => {
            newLogs[ex.id] = {
              completed: false,
              logId: null,
              targetSets: ex.sets,
              sets: [{
                setNumber: 1,
                reps: '',
                weight: '',
                completed: false,
                isPR: false,
                difficulty: null
              }]
            }
          })
          setExerciseLogs(newLogs)
        }
      } catch (error) {
        console.error('Error persisting exercises to calendar:', error)
      }
    }

    setShowAddExerciseModal(false)
  }

  const handleCopyExercisesToWorkout = (exercises) => {
    // Convert copied exercises to the format expected by handleAddExercisesToWorkout
    const catalogFormat = exercises.map(ex => ({
      id: ex.exerciseId,
      name: ex.exerciseName
    }))
    handleAddExercisesToWorkout(catalogFormat)
    setShowCopyModal(false)
  }

  // Remove an ad-hoc exercise from the workout
  const removeAdhocExercise = async (exerciseId, logId) => {
    // Remove from todayWorkout display
    setTodayWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.filter(ex => ex.id !== exerciseId)
    }))

    // Remove from exercise logs
    setExerciseLogs(prev => {
      const updated = { ...prev }
      delete updated[exerciseId]
      return updated
    })

    // If there's a logId, delete from server
    if (logId && activeSession) {
      try {
        await api.delete(`/workouts/${activeSession.id}/exercises/${logId}`)
      } catch (error) {
        console.error('Error deleting exercise log:', error)
      }
    }
  }

  // Hide a scheduled/recurring exercise for today only (does NOT delete from schedule)
  const hideExerciseForToday = (exerciseUniqueId) => {
    setHiddenExercises(prev => {
      const updated = [...prev, exerciseUniqueId]
      const dateKey = new Date().toISOString().split('T')[0]
      localStorage.setItem(`hiddenExercises-${dateKey}`, JSON.stringify(updated))
      return updated
    })
  }

  // Restore a hidden exercise
  const restoreExercise = (exerciseUniqueId) => {
    setHiddenExercises(prev => {
      const updated = prev.filter(id => id !== exerciseUniqueId)
      const dateKey = new Date().toISOString().split('T')[0]
      localStorage.setItem(`hiddenExercises-${dateKey}`, JSON.stringify(updated))
      return updated
    })
  }

  // Restore all hidden exercises
  const restoreAllExercises = () => {
    setHiddenExercises([])
    const dateKey = new Date().toISOString().split('T')[0]
    localStorage.removeItem(`hiddenExercises-${dateKey}`)
  }

  const getExerciseImage = (exerciseId) => {
    const details = exerciseDetails[exerciseId]
    if (details?.images?.[0]) {
      return details.images[0].startsWith('/uploads/') ? details.images[0] : `/api/exercise-images/${details.images[0]}`
    }
    return null
  }

  const completedCount = Object.values(exerciseLogs).filter(l => l.completed).length
  const totalExercises = todayWorkout?.exercises?.filter(e => !hiddenExercises.includes(e.id))?.length || 0

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              {todayWorkout?.name || 'Today'}
            </h1>
            <SyncStatus />
          </div>
          <p className="text-gray-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {/* Warmup/Cooldown Toggle Switches - Mobile */}
          {!loading && (warmupData.warmups?.length > 0 || cooldownData.cooldowns?.length > 0) && (
            <div className="flex items-center gap-4 mt-2 md:hidden">
              {warmupData.warmups?.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={warmupToggleOn}
                      onChange={(e) => { setWarmupToggleOn(e.target.checked); localStorage.setItem('warmupToggleOn', e.target.checked) }}
                      className="sr-only"
                    />
                    <div className={`w-9 h-5 rounded-full transition-colors ${warmupToggleOn ? 'bg-orange-500' : 'bg-dark-elevated'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${warmupToggleOn ? 'translate-x-4' : ''}`} />
                    </div>
                  </div>
                  <span className={`text-xs ${warmupToggleOn ? 'text-orange-400' : 'text-gray-500'}`}>
                    Warmup
                  </span>
                </label>
              )}
              {cooldownData.cooldowns?.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={cooldownToggleOn}
                      onChange={(e) => { setCooldownToggleOn(e.target.checked); localStorage.setItem('cooldownToggleOn', e.target.checked) }}
                      className="sr-only"
                    />
                    <div className={`w-9 h-5 rounded-full transition-colors ${cooldownToggleOn ? 'bg-cyan-500' : 'bg-dark-elevated'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${cooldownToggleOn ? 'translate-x-4' : ''}`} />
                    </div>
                  </div>
                  <span className={`text-xs ${cooldownToggleOn ? 'text-cyan-400' : 'text-gray-500'}`}>
                    Cooldown
                  </span>
                </label>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Warmup/Cooldown Toggle Switches - Desktop */}
          {!loading && (warmupData.warmups?.length > 0 || cooldownData.cooldowns?.length > 0) && (
            <div className="hidden md:flex items-center gap-3">
              {warmupData.warmups?.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className={`text-sm ${warmupToggleOn ? 'text-orange-400' : 'text-gray-500'}`}>
                    Warmup
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={warmupToggleOn}
                      onChange={(e) => { setWarmupToggleOn(e.target.checked); localStorage.setItem('warmupToggleOn', e.target.checked) }}
                      className="sr-only"
                    />
                    <div className={`w-9 h-5 rounded-full transition-colors ${warmupToggleOn ? 'bg-orange-500' : 'bg-dark-elevated'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${warmupToggleOn ? 'translate-x-4' : ''}`} />
                    </div>
                  </div>
                </label>
              )}
              {cooldownData.cooldowns?.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className={`text-sm ${cooldownToggleOn ? 'text-cyan-400' : 'text-gray-500'}`}>
                    Cooldown
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={cooldownToggleOn}
                      onChange={(e) => { setCooldownToggleOn(e.target.checked); localStorage.setItem('cooldownToggleOn', e.target.checked) }}
                      className="sr-only"
                    />
                    <div className={`w-9 h-5 rounded-full transition-colors ${cooldownToggleOn ? 'bg-cyan-500' : 'bg-dark-elevated'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${cooldownToggleOn ? 'translate-x-4' : ''}`} />
                    </div>
                  </div>
                </label>
              )}
            </div>
          )}
          {/* Digital Races pill - always visible */}
          <button
            onClick={() => navigate('/marathons')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 rounded-full text-accent hover:bg-accent/30 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Races</span>
          </button>
          {/* My Race pill - only when enrolled in an active non-passive race */}
          {activeRace && (
            <button
              onClick={() => { setRaceExpanded(prev => !prev); setShowAcrossAmerica(false) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors text-sm ${
                raceExpanded ? 'bg-accent text-white' : 'bg-dark-elevated text-gray-400 hover:text-white hover:bg-dark-card'
              }`}
            >
              <span>{raceExpanded ? '🏃' : '🏃'} My Race</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${raceExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          {socialSettings?.showSocialSection !== false && (
            <button
              onClick={() => document.getElementById('social-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-elevated rounded-full text-gray-400 hover:text-white hover:bg-dark-card transition-colors text-sm"
            >
              <span>Community</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* My Race Expandable Section */}
      {raceExpanded && (activeRace || passiveRace) && (() => {
        const race = showAcrossAmerica ? passiveRace : activeRace
        if (!race) return null
        const routeData = race.marathon.routeData
        const fraction = Math.min(1, race.currentDistance / race.marathon.distance)
        const { completed, remaining } = splitRoute(routeData, fraction)
        const currentPos = getPositionAlongRoute(routeData, fraction)
        const milestones = race.marathon.milestones || []
        const pct = (fraction * 100).toFixed(1)
        const remaining_mi = Math.max(0, race.marathon.distance - race.currentDistance).toFixed(1)
        const avgPace = race.totalSeconds > 0 && race.currentDistance > 0
          ? `${Math.floor((race.totalSeconds / race.currentDistance) / 60)}:${String(Math.floor((race.totalSeconds / race.currentDistance) % 60)).padStart(2, '0')} /mi`
          : '--'

        return (
          <div className="card overflow-hidden">
            {/* Map */}
            {routeData && routeData.length > 1 && (
              <div className="h-[250px] w-full relative">
                <MapContainer
                  center={routeData[0]}
                  zoom={10}
                  style={{ height: '100%', width: '100%' }}
                  className="z-0"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitBounds route={routeData} />
                  {remaining.length > 1 && (
                    <Polyline positions={remaining} pathOptions={{ color: '#555', weight: 3, dashArray: '8 8', opacity: 0.6 }} />
                  )}
                  {completed.length > 1 && (
                    <Polyline positions={completed} pathOptions={{ color: '#0a84ff', weight: 5, opacity: 0.9 }} />
                  )}
                  {fraction > 0 && fraction < 1 && (
                    <CircleMarker center={currentPos} radius={8} pathOptions={{ color: '#fff', fillColor: '#0a84ff', fillOpacity: 1, weight: 3 }}>
                      <Tooltip permanent direction="top" offset={[0, -10]}>{race.currentDistance.toFixed(1)} mi</Tooltip>
                    </CircleMarker>
                  )}
                  {milestones.map((ms, i) => (
                    <CircleMarker
                      key={i}
                      center={[ms.lat, ms.lng]}
                      radius={5}
                      pathOptions={{ color: '#fff', fillColor: ms.mile <= race.currentDistance ? '#0a84ff' : '#666', fillOpacity: 1, weight: 2 }}
                    >
                      <Tooltip direction="top" offset={[0, -8]}>
                        <span className="font-semibold">Mile {ms.mile}</span>
                        {ms.label && <><br />{ms.label}</>}
                      </Tooltip>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            )}

            {/* Race info & stats */}
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">{race.marathon.name}</p>
                  <p className="text-gray-500 text-xs">{race.marathon.city}</p>
                </div>
                <span className="text-accent text-sm font-medium">{pct}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-dark-elevated rounded-full h-2">
                <div className="bg-accent h-2 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-dark-elevated rounded-lg p-2">
                  <p className="text-white font-semibold text-sm">{race.currentDistance.toFixed(1)}</p>
                  <p className="text-gray-500 text-[10px]">Miles Done</p>
                </div>
                <div className="bg-dark-elevated rounded-lg p-2">
                  <p className="text-white font-semibold text-sm">{remaining_mi}</p>
                  <p className="text-gray-500 text-[10px]">Miles Left</p>
                </div>
                <div className="bg-dark-elevated rounded-lg p-2">
                  <p className="text-white font-semibold text-sm">{avgPace}</p>
                  <p className="text-gray-500 text-[10px]">Avg Pace</p>
                </div>
              </div>

              {/* Across America toggle */}
              {passiveRace && activeRace && (
                <label className="flex items-center justify-between cursor-pointer pt-1 border-t border-dark-border">
                  <span className="text-gray-400 text-xs">Show Across America</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showAcrossAmerica}
                      onChange={(e) => setShowAcrossAmerica(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-9 h-5 rounded-full transition-colors ${showAcrossAmerica ? 'bg-purple-500' : 'bg-dark-elevated'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showAcrossAmerica ? 'translate-x-4' : ''}`} />
                    </div>
                  </div>
                </label>
              )}
            </div>
          </div>
        )
      })()}

      {/* PR Celebration */}
      {newPRs.length > 0 && (
        <div className="card bg-gradient-to-r from-success/20 to-accent/20 border border-success/30">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <p className="text-success font-semibold">New PR{newPRs.length > 1 ? 's' : ''}!</p>
              <p className="text-sm text-gray-300">
                {newPRs.map(pr => `${pr.exerciseName}: ${pr.weight ? `${pr.weight}lbs × ` : ''}${pr.reps} reps`).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Workout Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowCancelConfirm(false)}>
          <div className="bg-dark-card rounded-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">Cancel Workout?</h3>
            <p className="text-gray-400 mb-6">This will delete the current workout and all logged sets. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelConfirm(false)} className="btn-secondary flex-1">
                Keep Going
              </button>
              <button onClick={cancelWorkout} className="btn-primary bg-error flex-1">
                Cancel Workout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Still Working Out? Modal - Runaway timer check */}
      {showStillWorkingOut && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card rounded-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <span className="text-4xl">⏱️</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 text-center">Still working out?</h3>
            <p className="text-gray-400 mb-2 text-center">
              Your workout has been running for <span className="text-white font-medium">{formatTimeLong(elapsedTime)}</span>.
            </p>
            <p className="text-gray-500 text-sm mb-6 text-center">
              Just checking in to make sure the timer wasn't left running by accident.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowStillWorkingOut(false)
                  setShowEditTimer(true)
                  // Pre-fill with current time for editing
                  const hrs = Math.floor(elapsedTime / 3600)
                  const mins = Math.floor((elapsedTime % 3600) / 60)
                  setEditedTime({ hours: hrs, minutes: mins })
                }}
                className="btn-secondary flex-1"
              >
                No, Edit Time
              </button>
              <button
                onClick={() => {
                  setShowStillWorkingOut(false)
                  setWorkoutPaused(false) // Resume timer
                }}
                className="btn-primary flex-1"
              >
                Yes, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Timer Modal */}
      {showEditTimer && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card rounded-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4 text-center">Edit Workout Time</h3>
            <p className="text-gray-400 text-sm mb-4 text-center">
              Adjust the elapsed time to match your actual workout duration.
            </p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex flex-col items-center">
                <label className="text-gray-500 text-xs mb-1">Hours</label>
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={editedTime.hours}
                  onChange={(e) => setEditedTime(prev => ({ ...prev, hours: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-20 px-3 py-3 bg-dark-elevated border border-gray-700 rounded-lg text-white text-center text-xl focus:border-accent focus:outline-none"
                />
              </div>
              <span className="text-white text-2xl mt-5">:</span>
              <div className="flex flex-col items-center">
                <label className="text-gray-500 text-xs mb-1">Minutes</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={editedTime.minutes}
                  onChange={(e) => setEditedTime(prev => ({ ...prev, minutes: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) }))}
                  className="w-20 px-3 py-3 bg-dark-elevated border border-gray-700 rounded-lg text-white text-center text-xl focus:border-accent focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditTimer(false)
                  setWorkoutPaused(false) // Resume with original time
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Apply the edited time
                  const newTime = (editedTime.hours * 3600) + (editedTime.minutes * 60)
                  setElapsedTime(newTime)
                  setLastTimerCheck(newTime) // Reset the check so it doesn't immediately prompt again
                  setShowEditTimer(false)
                  setWorkoutPaused(false) // Resume timer
                }}
                className="btn-primary flex-1"
              >
                Save Time
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Details Modal */}
      {showExerciseModal && (
        <ExerciseDetailModal
          exercise={showExerciseModal}
          details={exerciseDetails[showExerciseModal.exerciseId]}
          onClose={() => setShowExerciseModal(null)}
        />
      )}

      {/* Add Exercise Modal */}
      {showAddExerciseModal && (
        <ExerciseCatalogModal
          onClose={() => setShowAddExerciseModal(false)}
          onAddExercises={handleAddExercisesToWorkout}
        />
      )}

      {/* Copy Workout Modal */}
      {showCopyModal && (
        <CopyWorkoutModal
          onClose={() => setShowCopyModal(false)}
          onCopyExercises={handleCopyExercisesToWorkout}
          showOwnSchedule={showCopyModal === 'schedule' || showCopyModal === true}
        />
      )}

      {/* Compact Workout Timer */}
      {!workoutStarted ? (
        <button onClick={startWorkout} className="w-full card bg-gradient-to-r from-accent/20 to-dark-card hover:from-accent/30 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-white">Start Workout</p>
                <p className="text-sm text-gray-400">{todayWorkout?.name || 'Quick Workout'}</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      ) : (
        <div className={`card ${workoutPaused ? 'ring-2 ring-warning' : showRestTimer ? 'ring-2 ring-blue-500' : 'ring-2 ring-accent'}`}>
          {/* Timer Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <p className={`text-3xl font-mono font-bold ${workoutPaused ? 'text-warning' : 'text-white'}`}>
                {formatTime(elapsedTime)}
              </p>
              {workoutPaused && (
                <span className="px-2 py-0.5 bg-warning/20 text-warning text-xs rounded-full">PAUSED</span>
              )}
            </div>
            <div className="text-right text-sm">
              <p className="text-white font-medium">{completedCount}/{totalExercises}</p>
              <p className="text-gray-500 text-xs">exercises</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 bg-dark-elevated rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${totalExercises > 0 ? (completedCount / totalExercises) * 100 : 0}%` }}
            />
          </div>

          {/* Rest Timer - Inline */}
          {showRestTimer && (
            <div className="mb-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 text-sm">Rest</span>
                  <p className={`text-2xl font-mono font-bold ${restTimer <= 10 ? 'text-error animate-pulse' : 'text-blue-400'}`}>
                    {formatTime(restTimer)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleRestTimerSound}
                    className={`px-2 py-1 text-xs rounded ${restTimerSoundEnabled ? 'bg-blue-500/20 text-blue-400' : 'bg-dark-elevated text-gray-500'}`}
                    title={restTimerSoundEnabled ? 'Sound on' : 'Sound off'}
                  >
                    {restTimerSoundEnabled ? '🔔' : '🔕'}
                  </button>
                  <button
                    onClick={() => startRestTimer(restTimer + 30)}
                    className="px-2 py-1 text-xs bg-dark-elevated text-gray-300 rounded hover:bg-dark-card"
                  >
                    +30s
                  </button>
                  {restTimerRunning ? (
                    <button
                      onClick={() => setRestTimerRunning(false)}
                      className="px-2 py-1 text-xs bg-dark-elevated text-gray-300 rounded hover:bg-dark-card"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => setRestTimerRunning(true)}
                      className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                    >
                      Resume
                    </button>
                  )}
                  <button
                    onClick={clearRestTimer}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-white"
                  >
                    Skip
                  </button>
                </div>
              </div>
              {/* Quick time presets */}
              <div className="flex gap-2 mt-2">
                {[30, 60, 90, 120].map(t => (
                  <button
                    key={t}
                    onClick={() => startRestTimer(t)}
                    className={`flex-1 py-1 text-xs rounded ${restTimer === t ? 'bg-blue-500/30 text-blue-400' : 'bg-dark-elevated text-gray-400'}`}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button onClick={togglePause} className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 ${workoutPaused ? 'bg-warning/20 text-warning' : 'bg-dark-elevated text-white'}`}>
              {workoutPaused ? (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  Resume
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                  Pause
                </>
              )}
            </button>
            <button onClick={() => startRestTimer()} className={`py-2 px-3 rounded-lg text-sm flex items-center gap-2 ${showRestTimer ? 'bg-blue-500/20 text-blue-400' : 'bg-dark-elevated text-white'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Rest
            </button>
            <button onClick={endWorkout} className="py-2 px-3 rounded-lg bg-success/20 text-success text-sm font-medium">
              Finish
            </button>
            <button onClick={() => setShowCancelConfirm(true)} className="py-2 px-3 rounded-lg bg-dark-elevated text-gray-400 hover:text-error text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Completed Workouts Today - Compact */}
      {completedWorkouts.length > 0 && (
        <div>
          {/* Compact Summary Row */}
          {todaySummary && (
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2 text-success">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium">Today</span>
              </div>
              <div className="flex-1 flex items-center gap-4 text-sm">
                <span className="text-gray-400"><span className="text-white font-medium">{todaySummary.count}</span> workout{todaySummary.count !== 1 ? 's' : ''}</span>
                <span className="text-gray-400"><span className="text-white font-medium">{formatDuration(todaySummary.totalDuration)}</span></span>
                <span className="text-gray-400"><span className="text-white font-medium">{todaySummary.totalSets}</span> sets</span>
                {todaySummary.prsToday > 0 && (
                  <span className="text-success"><span className="font-medium">{todaySummary.prsToday}</span> PR{todaySummary.prsToday !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          )}

          {/* Collapsible Workout List */}
          <div className="space-y-2">
            {completedWorkouts.map((workout, index) => {
              const isExpanded = expandedCompletedWorkout === workout.id

              return (
                <div key={workout.id} className="card bg-dark-elevated p-0 overflow-hidden">
                  {/* Workout Header - Clickable */}
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5"
                    onClick={() => setExpandedCompletedWorkout(isExpanded ? null : workout.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-sm">
                        <span className="text-success font-bold">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{workout.name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(workout.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          {workout.endTime && ` - ${new Date(workout.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-accent font-mono text-sm">{formatDuration(workout.duration || 0)}</p>
                        <p className="text-xs text-gray-500">{workout.exerciseLogs?.length || 0} ex</p>
                      </div>
                      <svg className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-dark-card px-3 pb-3">
                      {/* Exercises */}
                      {workout.exerciseLogs?.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {workout.exerciseLogs.map((log) => (
                            <div key={log.id} className="bg-dark-card rounded-lg p-2">
                              <p className="text-sm text-white font-medium mb-1">{log.exerciseName}</p>
                              <div className="flex flex-wrap gap-1">
                                {log.sets.map((set, i) => (
                                  <span key={i} className={`text-xs px-2 py-0.5 rounded ${set.isPR ? 'bg-success/20 text-success' : 'bg-dark-elevated text-gray-400'}`}>
                                    {set.isPR && '🏆 '}{set.weight > 0 ? `${set.weight}×` : ''}{set.reps}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm mt-3">No exercises logged</p>
                      )}

                      {/* Delete Button */}
                      <button
                        onClick={(e) => deleteCompletedWorkout(workout.id, e)}
                        className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                      >
                        Delete Workout
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Warmup Section - Below Start Workout */}
      {warmupToggleOn && warmupData.warmups.length > 0 && !workoutStarted && (
        <div className="card p-3 bg-orange-500/10 border border-orange-500/30">
          <button
            onClick={() => setWarmupCollapsed(!warmupCollapsed)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <svg
                className={`w-4 h-4 text-orange-400 transition-transform ${warmupCollapsed ? '' : 'rotate-90'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-orange-400 font-medium text-sm">Warmup</span>
              <span className="text-orange-400/60 text-xs">
                {warmupData.warmups.length} exercises
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-orange-400/50">
              {warmupData.isAI ? 'AI' : 'Standard'}
            </div>
          </button>

          {!warmupCollapsed && (
            <div className="space-y-2 mt-3 pt-3 border-t border-orange-500/20">
              {warmupData.warmups.map((warmup, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 py-1.5 px-2 rounded-lg transition-colors ${warmupChecked[idx] ? 'bg-orange-500/5' : 'hover:bg-orange-500/10'}`}
                >
                  <button
                    onClick={() => setWarmupChecked(prev => ({ ...prev, [idx]: !prev[idx] }))}
                    className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      warmupChecked[idx] ? 'bg-orange-500 border-orange-500' : 'border-orange-500/50'
                    }`}
                  >
                    {warmupChecked[idx] && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-white text-xs font-medium ${warmupChecked[idx] ? 'line-through opacity-60' : ''}`}>
                        {warmup.name}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-orange-400/50 text-[10px]">
                          {warmup.duration ? `${warmup.duration}s` : warmup.sets && warmup.reps ? `${warmup.sets}×${warmup.reps}` : warmup.reps ? `${warmup.reps}` : ''}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); askAIAbout(warmup.name, 'warmup'); }}
                          className="p-0.5 text-orange-400/40 hover:text-orange-400 transition-colors"
                          title="Ask AI for more info"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {warmup.description && (
                      <p className={`text-orange-400/60 text-[10px] mt-0.5 leading-tight ${warmupChecked[idx] ? 'opacity-60' : ''}`}>
                        {warmup.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* No Workout Scheduled */}
      {!loading && !todayWorkout && (
        <div className="card text-center py-8">
          <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-white font-medium mb-2">No Workout Scheduled</h3>
          <p className="text-gray-400 mb-4">Set up your weekly schedule to see today's workout</p>
          <Link to="/schedule" className="btn-primary">
            Set Up Schedule
          </Link>
        </div>
      )}

      {/* Weight Tracking Card */}
      {showWeightTracking && !workoutStarted && (
        <WeightTrackingCard
          weightUnit={weightUnit}
          onWeightLogged={() => fetchStats()}
        />
      )}

      {/* Daily/Recurring Workouts Section */}
      {!loading && recurringWorkouts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-400">Recurring Workouts</h2>
            <Link to="/schedule" className="text-purple-400 text-sm hover:text-purple-300">Edit</Link>
          </div>
          {recurringWorkouts.map((recurring) => {
            const isExpanded = expandedRecurringWorkout === recurring.id
            const visibleExercises = recurring.exercises?.filter((_, idx) =>
              !hiddenExercises.includes(`recurring-${recurring.id}-${idx}`)
            ) || []
            const completedCount = recurring.exercises?.filter((_, idx) => {
              const uniqueId = `recurring-${recurring.id}-${idx}`
              return !hiddenExercises.includes(uniqueId) && exerciseLogs[uniqueId]?.completed
            }).length || 0

            return (
              <div key={recurring.id} className="card bg-purple-500/10 border border-purple-500/30">
                {/* Recurring Workout Header */}
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpandedRecurringWorkout(isExpanded ? null : recurring.id)}
                >
                  <span className="text-2xl">🔄</span>
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{recurring.name}</h3>
                    <p className="text-purple-400/80 text-sm">
                      {completedCount > 0 ? (
                        <span className="text-success">{completedCount}/{visibleExercises.length} done</span>
                      ) : (
                        `${visibleExercises.length} exercise${visibleExercises.length !== 1 ? 's' : ''}`
                      )}
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-purple-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded Exercises */}
                {isExpanded && recurring.exercises?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-purple-500/20 space-y-3">
                    {recurring.exercises.map((ex, idx) => {
                      const uniqueId = `recurring-${recurring.id}-${idx}`
                      if (hiddenExercises.includes(uniqueId)) return null
                      const log = exerciseLogs[uniqueId] || { completed: false, sets: [], targetSets: ex.sets || 3 }
                      const isExerciseExpanded = expandedExercise === uniqueId
                      const exerciseImage = getExerciseImage(ex.exerciseId)
                      const completedSetCount = log.sets?.filter(s => s.completed).length || 0

                      // Prefetch exercise details for image
                      if (!exerciseDetails[ex.exerciseId]) {
                        fetchExerciseDetails(ex.exerciseId)
                      }

                      return (
                        <div
                          key={uniqueId}
                          className={`p-3 rounded-lg bg-dark-card transition-all ${
                            log.completed ? 'opacity-60 bg-success/10' : ''
                          } ${isExerciseExpanded ? 'ring-2 ring-purple-500' : ''}`}
                        >
                          {/* Exercise Header */}
                          <div
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => {
                              setExpandedExercise(isExerciseExpanded ? null : uniqueId)
                              if (!isExerciseExpanded) {
                                fetchExerciseHistory(ex.exerciseId)
                              }
                            }}
                          >
                            {/* Checkbox */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExerciseComplete(uniqueId)
                              }}
                              className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${
                                log.completed
                                  ? 'bg-success text-white hover:bg-success/80'
                                  : 'bg-dark-elevated text-gray-500 hover:bg-dark-card'
                              }`}
                            >
                              {log.completed && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>

                            {/* Exercise Image */}
                            <div className="w-10 h-10 rounded-lg bg-dark-elevated flex-shrink-0 flex items-center justify-center overflow-hidden">
                              {exerciseImage ? (
                                <img src={exerciseImage} alt={ex.exerciseName} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                              ) : (
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              )}
                            </div>

                            {/* Exercise Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-medium text-sm truncate ${log.completed ? 'text-gray-400 line-through' : 'text-white'}`}>
                                {exerciseNicknames[ex.exerciseId] || ex.exerciseName}
                              </h4>
                              {exerciseNicknames[ex.exerciseId] && (
                                <p className="text-gray-500 text-xs truncate">{ex.exerciseName}</p>
                              )}
                              <p className="text-gray-400 text-xs">
                                {completedSetCount > 0 ? (
                                  <span className="text-success">{completedSetCount} logged</span>
                                ) : (
                                  `${ex.sets || 3} sets × ${ex.reps || '8-12'}`
                                )}
                              </p>
                            </div>

                            {/* Skip for today */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                hideExerciseForToday(uniqueId)
                              }}
                              className="p-1 text-gray-500 hover:text-red-500 transition-colors flex-shrink-0"
                              title="Skip for today"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>

                            {/* Expand Arrow */}
                            <svg
                              className={`w-4 h-4 text-gray-400 transition-transform ${isExerciseExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>

                          {/* Expanded Set Logging */}
                          {isExerciseExpanded && (
                            <div className="mt-3 pt-3 border-t border-dark-elevated space-y-2">
                              {log.sets?.map((set, setIndex) => (
                                <div
                                  key={setIndex}
                                  className={`p-2 rounded-lg ${set.completed ? 'bg-success/10' : 'bg-dark-elevated'}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-medium w-10 ${set.completed ? 'text-success' : 'text-gray-400'}`}>
                                      Set {setIndex + 1}
                                    </span>
                                    <input
                                      type="number"
                                      placeholder="lbs"
                                      value={set.weight}
                                      onChange={(e) => updateSetValue(uniqueId, setIndex, 'weight', e.target.value)}
                                      disabled={set.completed}
                                      className="w-16 px-2 py-1.5 bg-dark-card border border-gray-700 rounded text-white text-center text-sm focus:border-purple-500 focus:outline-none disabled:opacity-50"
                                    />
                                    <span className="text-gray-400 text-sm">×</span>
                                    <input
                                      type="number"
                                      placeholder="reps"
                                      value={set.reps}
                                      onChange={(e) => updateSetValue(uniqueId, setIndex, 'reps', e.target.value)}
                                      disabled={set.completed}
                                      className="w-16 px-2 py-1.5 bg-dark-card border border-gray-700 rounded text-white text-center text-sm focus:border-purple-500 focus:outline-none disabled:opacity-50"
                                    />
                                    {!set.completed ? (
                                      <button
                                        onClick={() => {
                                          // Mark set as completed locally
                                          setExerciseLogs(prev => ({
                                            ...prev,
                                            [uniqueId]: {
                                              ...prev[uniqueId],
                                              sets: prev[uniqueId].sets.map((s, i) =>
                                                i === setIndex ? { ...s, completed: true } : s
                                              )
                                            }
                                          }))
                                          // Add next set if needed
                                          if (setIndex === log.sets.length - 1 && log.sets.length < (ex.sets || 3)) {
                                            setExerciseLogs(prev => ({
                                              ...prev,
                                              [uniqueId]: {
                                                ...prev[uniqueId],
                                                sets: [...prev[uniqueId].sets, {
                                                  setNumber: log.sets.length + 1,
                                                  reps: '',
                                                  weight: '',
                                                  completed: false,
                                                  isPR: false,
                                                  difficulty: null
                                                }]
                                              }
                                            }))
                                          }
                                        }}
                                        disabled={!set.reps}
                                        className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
                                      >
                                        Done
                                      </button>
                                    ) : (
                                      <span className="text-success text-xs">✓</span>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {/* Add Set Button */}
                              {log.sets?.every(s => s.completed) && (
                                <button
                                  onClick={() => {
                                    setExerciseLogs(prev => ({
                                      ...prev,
                                      [uniqueId]: {
                                        ...prev[uniqueId],
                                        sets: [...prev[uniqueId].sets, {
                                          setNumber: log.sets.length + 1,
                                          reps: '',
                                          weight: '',
                                          completed: false,
                                          isPR: false,
                                          difficulty: null
                                        }]
                                      }
                                    }))
                                  }}
                                  className="w-full py-2 text-purple-400 hover:text-purple-300 text-xs flex items-center justify-center gap-1"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add Another Set
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Today's Workout */}
      {!loading && todayWorkout && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-400">Exercises</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="text-accent text-sm hover:text-accent-hover flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </button>
                {showAddMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-dark-card border border-dark-border rounded-xl shadow-xl z-50 overflow-hidden">
                      <button
                        onClick={() => { setShowAddMenu(false); setShowAddExerciseModal(true) }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-elevated transition-colors text-left"
                      >
                        <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <div>
                          <p className="text-white text-sm font-medium">Browse Exercises</p>
                          <p className="text-gray-500 text-xs">Search the exercise catalog</p>
                        </div>
                      </button>
                      <button
                        onClick={() => { setShowAddMenu(false); setShowCopyModal('schedule') }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-elevated transition-colors text-left border-t border-dark-border"
                      >
                        <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div>
                          <p className="text-white text-sm font-medium">Copy from Schedule</p>
                          <p className="text-gray-500 text-xs">Use another day's workout</p>
                        </div>
                      </button>
                      <button
                        onClick={() => { setShowAddMenu(false); setShowCopyModal('friends') }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-elevated transition-colors text-left border-t border-dark-border"
                      >
                        <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <div>
                          <p className="text-white text-sm font-medium">Copy from Friend</p>
                          <p className="text-gray-500 text-xs">Use a friend's workout</p>
                        </div>
                      </button>
                      <button
                        onClick={() => { setShowAddMenu(false); setShowCopyModal('templates') }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-elevated transition-colors text-left border-t border-dark-border"
                      >
                        <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <div>
                          <p className="text-white text-sm font-medium">Use Template</p>
                          <p className="text-gray-500 text-xs">Apply a saved workout package</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <Link to="/schedule" className="text-accent text-sm">Edit</Link>
            </div>
          </div>

          {todayWorkout.isRestDay ? (
            <div className="card text-center py-8">
              <span className="text-6xl mb-4 block">😴</span>
              <h3 className="text-white font-medium mb-2">Rest Day</h3>
              <p className="text-gray-400">Take it easy and recover!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayWorkout.exercises?.filter(exercise => !hiddenExercises.includes(exercise.id)).map((exercise) => {
                const isExpanded = expandedExercise === exercise.id
                const log = exerciseLogs[exercise.id] || { completed: false, sets: [], targetSets: exercise.sets }
                const history = exerciseHistory[exercise.exerciseId]
                const details = exerciseDetails[exercise.exerciseId]
                const tip = aiTips[exercise.id]
                const exerciseImage = getExerciseImage(exercise.exerciseId)
                const completedSetCount = log.sets.filter(s => s.completed).length

                // Prefetch exercise details for image
                if (!exerciseDetails[exercise.exerciseId]) {
                  fetchExerciseDetails(exercise.exerciseId)
                }

                return (
                  <div
                    key={exercise.id}
                    className={`card transition-all ${
                      log.completed ? 'opacity-60 bg-success/10' : ''
                    } ${isExpanded ? 'ring-2 ring-accent' : ''}`}
                  >
                    {/* Exercise Header */}
                    <div
                      className="flex items-center gap-4 cursor-pointer"
                      onClick={() => toggleExerciseExpand(exercise)}
                    >
                      {/* Checkbox - toggleable */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExerciseComplete(exercise.id)
                        }}
                        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${
                          log.completed
                            ? 'bg-success text-white hover:bg-success/80'
                            : 'bg-dark-elevated text-gray-500 hover:bg-dark-card'
                        }`}
                        title={log.completed ? 'Click to continue exercise' : 'Mark as complete'}
                      >
                        {log.completed && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Exercise Image - Clickable for details */}
                      <div
                        className="w-14 h-14 rounded-xl bg-dark-elevated flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); if (details) setShowExerciseModal(exercise); }}
                      >
                        {exerciseImage ? (
                          <img src={exerciseImage} alt={exercise.exerciseName} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>

                      {/* Exercise Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium truncate ${log.completed ? 'text-gray-400 line-through' : 'text-white'}`}>
                          {getDisplayName(exercise)}
                        </h3>
                        {exerciseNicknames[exercise.exerciseId] && (
                          <p className="text-gray-500 text-xs truncate">{exercise.exerciseName}</p>
                        )}
                        <p className="text-gray-400 text-sm">
                          {completedSetCount > 0 ? (
                            <span className="text-success">{completedSetCount} logged</span>
                          ) : (
                            `${exercise.sets} sets × ${exercise.reps}`
                          )}
                        </p>
                      </div>

                      {/* Ask AI Info Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); askAIAbout(exercise.exerciseName, 'exercise'); }}
                        className="p-1.5 text-gray-500 hover:text-accent transition-colors"
                        title="Ask AI about this exercise"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>

                      {/* Skip/Remove Exercise Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (exercise.isAdhoc) {
                            if (window.confirm(`Remove ${getDisplayName(exercise)} from this workout?`)) {
                              removeAdhocExercise(exercise.id, log.id)
                            }
                          } else {
                            hideExerciseForToday(exercise.id)
                          }
                        }}
                        className="p-1.5 text-gray-500 hover:text-red-500 transition-colors"
                        title={exercise.isAdhoc ? "Remove this exercise" : "Skip for today"}
                      >
                        {exercise.isAdhoc ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>

                      {/* Expand Arrow */}
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-dark-elevated">
                        {/* Tip box with reasoning */}
                        <div className="mb-4 p-3 bg-dark-elevated border border-dark-border rounded-lg">
                          <div className="flex items-start gap-2">
                            <span className="text-accent">
                              {tip?.source === 'ai' ? '🤖' : tip?.source === 'error' ? '⚠️' : '💡'}
                            </span>
                            <div className="flex-1">
                              {tip?.tip ? (
                                <>
                                  <p className="text-sm text-gray-300 mb-1">{tip.tip}</p>
                                  {tip.weight !== null && tip.reps !== null && (
                                    <p className="text-xs text-gray-400">
                                      Suggested: <span className="text-white font-medium">{tip.weight}lbs × {tip.reps} reps</span>
                                      {tip.source === 'ai' && ' (AI)'}
                                    </p>
                                  )}
                                  {tip.reason && (
                                    <p className="text-xs text-gray-500 mt-1 italic">{tip.reason}</p>
                                  )}
                                </>
                              ) : (
                                <p className="text-sm text-gray-400">Enter your first set to get suggestions.</p>
                              )}
                            </div>
                            {/* AI Tip button */}
                            <button
                              onClick={() => getAiTip(exercise)}
                              disabled={tip?.loading}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-dark-card hover:bg-dark-border rounded text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                              title="Get AI-powered tip"
                            >
                              {tip?.loading ? (
                                <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <span>💡</span>
                              )}
                              <span>AI Tip</span>
                            </button>
                          </div>
                        </div>

                        {/* Past Sessions - Collapsible Last Session + Show More */}
                        {history?.lastSession && (
                          <div className="mb-4">
                            {/* Collapsible Header */}
                            <button
                              onClick={() => setLastSessionCollapsed(!lastSessionCollapsed)}
                              className="w-full flex items-center justify-between text-sm text-gray-400 hover:text-white mb-2"
                            >
                              <div className="flex items-center gap-2">
                                <svg className={`w-4 h-4 transition-transform ${lastSessionCollapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span>Last Session</span>
                                <span className="text-gray-500">({new Date(history.lastSession.session.date).toLocaleDateString()})</span>
                              </div>
                              {!lastSessionCollapsed && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    autoFillFromHistory(exercise.id, exercise.exerciseId)
                                  }}
                                  className="text-xs text-accent hover:text-accent-hover"
                                >
                                  Copy to sets
                                </button>
                              )}
                            </button>

                            {/* Last Session Content */}
                            {!lastSessionCollapsed && (
                              <div className="p-3 bg-dark-elevated rounded-lg">
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {history.lastSession.sets.map((set, i) => (
                                    <button
                                      key={i}
                                      onClick={() => loadHistoricalSet(exercise.id, set)}
                                      className="px-2 py-1 bg-dark-card rounded text-sm text-gray-300 hover:bg-accent/20 hover:text-accent cursor-pointer transition-colors active:scale-95"
                                      title="Tap to load into current set"
                                    >
                                      {set.weight > 0 ? `${set.weight}lbs × ` : ''}{set.reps} reps
                                    </button>
                                  ))}
                                </div>

                                {/* Show More Sessions Link */}
                                {history?.history?.length > 1 && (
                                  <div>
                                    <button
                                      onClick={() => setShowOlderSessions(!showOlderSessions)}
                                      className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                                    >
                                      <svg className={`w-3 h-3 transition-transform ${showOlderSessions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                      {showOlderSessions ? 'Hide' : `Show ${history.history.length - 1} older session${history.history.length - 1 > 1 ? 's' : ''}`}
                                    </button>

                                    {/* Older Sessions */}
                                    {showOlderSessions && (
                                      <div className="mt-3 space-y-2 border-t border-gray-700 pt-3">
                                        {history.history.slice(1).map((session, idx) => (
                                          <div key={idx} className="p-2 bg-dark-card rounded">
                                            <p className="text-xs text-gray-500 mb-1">
                                              {new Date(session.session.date).toLocaleDateString()} - {session.session.name}
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                              {session.sets.map((set, i) => (
                                                <button
                                                  key={i}
                                                  onClick={() => loadHistoricalSet(exercise.id, set)}
                                                  className={`px-2 py-0.5 rounded text-xs cursor-pointer transition-colors active:scale-95 ${
                                                    set.isPR
                                                      ? 'bg-success/20 text-success hover:bg-success/30'
                                                      : 'bg-dark-elevated text-gray-400 hover:bg-accent/20 hover:text-accent'
                                                  }`}
                                                  title="Tap to load into current set"
                                                >
                                                  {set.isPR && '🏆 '}{set.weight > 0 ? `${set.weight}× ` : ''}{set.reps}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* PR Badge */}
                        {history?.pr && (
                          <div className="mb-4 flex items-center gap-2 text-sm">
                            <span className="text-success">🏆 PR:</span>
                            <span className="text-white">
                              {history.pr.weight > 0 ? `${history.pr.weight}lbs × ` : ''}{history.pr.reps} reps
                            </span>
                          </div>
                        )}

                        {/* Set Logging */}
                        <div className="space-y-3">
                          {log.sets.map((set, setIndex) => (
                            <div
                              key={setIndex}
                              className={`p-3 rounded-lg ${
                                set.completed ? 'bg-success/10' : 'bg-dark-elevated'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`text-sm font-medium w-12 ${set.completed ? 'text-success' : 'text-gray-400'}`}>
                                  {set.isPR && '🏆 '}Set {setIndex + 1}
                                </span>
                                <input
                                  type="number"
                                  placeholder="lbs"
                                  value={set.weight}
                                  onChange={(e) => updateSetValue(exercise.id, setIndex, 'weight', e.target.value)}
                                  disabled={set.completed}
                                  className="w-20 px-3 py-2 bg-dark-card border border-gray-700 rounded-lg text-white text-center focus:border-accent focus:outline-none disabled:opacity-50"
                                />
                                <span className="text-gray-400">×</span>
                                <input
                                  type="number"
                                  placeholder="reps"
                                  value={set.reps}
                                  onChange={(e) => updateSetValue(exercise.id, setIndex, 'reps', e.target.value)}
                                  disabled={set.completed}
                                  className="w-20 px-3 py-2 bg-dark-card border border-gray-700 rounded-lg text-white text-center focus:border-accent focus:outline-none disabled:opacity-50"
                                />
                                {!set.completed ? (
                                  <button
                                    onClick={() => completeSet(exercise.id, setIndex, exercise, setDifficulty[`${exercise.id}-${setIndex}`])}
                                    disabled={!set.reps}
                                    className="btn-primary text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Log
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    {set.difficulty && (
                                      <span className={`text-xs px-2 py-1 rounded ${
                                        set.difficulty <= 2 ? 'bg-success/20 text-success' :
                                        set.difficulty === 3 ? 'bg-warning/20 text-warning' :
                                        'bg-error/20 text-error'
                                      }`}>
                                        {set.difficulty}/5
                                      </span>
                                    )}
                                    <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                )}
                              </div>

                              {/* Optional difficulty rating for uncompleted sets */}
                              {!set.completed && set.reps && (
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-xs text-gray-500">Difficulty (optional):</span>
                                  <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(rating => (
                                      <button
                                        key={rating}
                                        onClick={() => setSetDifficulty(prev => ({ ...prev, [`${exercise.id}-${setIndex}`]: rating }))}
                                        className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                                          setDifficulty[`${exercise.id}-${setIndex}`] === rating
                                            ? rating <= 2 ? 'bg-success text-white' :
                                              rating === 3 ? 'bg-warning text-white' :
                                              'bg-error text-white'
                                            : 'bg-dark-card text-gray-400 hover:bg-dark-border'
                                        }`}
                                      >
                                        {rating}
                                      </button>
                                    ))}
                                  </div>
                                  <span className="text-xs text-gray-600 ml-1">
                                    {setDifficulty[`${exercise.id}-${setIndex}`] <= 2 ? '😊 Easy' :
                                     setDifficulty[`${exercise.id}-${setIndex}`] === 3 ? '😐 Good' :
                                     setDifficulty[`${exercise.id}-${setIndex}`] >= 4 ? '😤 Hard' : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Show target sets info */}
                          {log.targetSets && log.sets.filter(s => s.completed).length < log.targetSets && (
                            <p className="text-xs text-gray-500 text-center">
                              {log.sets.filter(s => s.completed).length} of {log.targetSets} planned sets completed
                            </p>
                          )}
                        </div>

                        {/* Done button - just closes the exercise */}
                        {workoutStarted && log.sets.some(s => s.completed) && (
                          <button
                            onClick={() => toggleExerciseComplete(exercise.id)}
                            className="w-full mt-4 py-3 rounded-lg font-medium transition-colors bg-success text-white hover:bg-success/80"
                          >
                            Done with {exercise.exerciseName}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Skipped Exercises Restore Indicator */}
      {hiddenExercises.length > 0 && (
        <div className="card p-3 bg-dark-elevated border border-dark-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">
              {hiddenExercises.length} exercise{hiddenExercises.length > 1 ? 's' : ''} skipped for today
            </span>
            <button
              onClick={restoreAllExercises}
              className="text-xs text-accent hover:text-accent-hover"
            >
              Restore all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {hiddenExercises.map(id => {
              const exercise = todayWorkout?.exercises?.find(e => e.id === id)
              const recurringMatch = !exercise && recurringWorkouts.flatMap(rw =>
                (rw.exercises || []).map((ex, idx) => ({
                  ...ex,
                  uniqueId: `recurring-${rw.id}-${idx}`
                }))
              ).find(e => e.uniqueId === id)
              const name = exercise?.exerciseName || recurringMatch?.exerciseName || 'Exercise'

              return (
                <button
                  key={id}
                  onClick={() => restoreExercise(id)}
                  className="flex items-center gap-1 px-2 py-1 bg-dark-card rounded text-xs text-gray-400 hover:text-white hover:bg-dark-border transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Cooldown Section */}
      {cooldownToggleOn && cooldownData.cooldowns.length > 0 && (
        <div className="card p-3 bg-cyan-500/10 border border-cyan-500/30">
          <button
            onClick={() => setCooldownCollapsed(!cooldownCollapsed)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <svg
                className={`w-4 h-4 text-cyan-400 transition-transform ${cooldownCollapsed ? '' : 'rotate-90'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-cyan-400 font-medium text-sm">Cooldown</span>
              <span className="text-cyan-400/60 text-xs">
                {cooldownData.cooldowns.length} exercises
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-cyan-400/50">
              {cooldownData.isAI ? 'AI' : 'Standard'}
            </div>
          </button>

          {!cooldownCollapsed && (
            <div className="space-y-2 mt-3 pt-3 border-t border-cyan-500/20">
              {cooldownData.cooldowns.map((cooldown, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 py-1.5 px-2 rounded-lg transition-colors ${cooldownChecked[idx] ? 'bg-cyan-500/5' : 'hover:bg-cyan-500/10'}`}
                >
                  <button
                    onClick={() => setCooldownChecked(prev => ({ ...prev, [idx]: !prev[idx] }))}
                    className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      cooldownChecked[idx] ? 'bg-cyan-500 border-cyan-500' : 'border-cyan-500/50'
                    }`}
                  >
                    {cooldownChecked[idx] && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-white text-xs font-medium ${cooldownChecked[idx] ? 'line-through opacity-60' : ''}`}>
                        {cooldown.name}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-cyan-400/50 text-[10px]">
                          {cooldown.duration ? `${cooldown.duration}s` : ''}{cooldown.sides ? ' ea side' : ''}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); askAIAbout(cooldown.name, 'cooldown'); }}
                          className="p-0.5 text-cyan-400/40 hover:text-cyan-400 transition-colors"
                          title="Ask AI for more info"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {cooldown.description && (
                      <p className={`text-cyan-400/60 text-[10px] mt-0.5 leading-tight ${cooldownChecked[idx] ? 'opacity-60' : ''}`}>
                        {cooldown.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Stats - Compact inline */}
      <div className="card px-3 py-2">
        <div className="flex items-center justify-around">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">📅</span>
            <p className="text-white font-bold">{stats.thisWeek}</p>
            <p className="text-gray-500 text-xs">this week</p>
          </div>
          <div className="w-px h-5 bg-dark-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🔥</span>
            <p className="text-accent font-bold">{stats.streak}</p>
            <p className="text-gray-500 text-xs">day streak</p>
          </div>
          <div className="w-px h-5 bg-dark-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🏆</span>
            <p className="text-success font-bold">{stats.prs}</p>
            <p className="text-gray-500 text-xs">PRs</p>
          </div>
        </div>
      </div>

      {/* Social Section */}
      <SocialSection settings={socialSettings} />

      {/* AI Chat Widget */}
      <ChatWidget ref={chatWidgetRef} context="today" />
    </div>
  )
}

// Exercise Detail Modal Component
function ExerciseDetailModal({ exercise, details, onClose }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  if (!details) return null

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-dark-card w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white truncate pr-4">{exercise.exerciseName}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Image */}
          <div className="aspect-video bg-dark-elevated rounded-xl overflow-hidden flex items-center justify-center relative">
            {details.images?.length > 0 ? (
              <>
                <img
                  src={details.images[currentImageIndex].startsWith('/uploads/') ? details.images[currentImageIndex] : `/api/exercise-images/${details.images[currentImageIndex]}`}
                  alt={details.name}
                  className="w-full h-full object-contain bg-dark-elevated"
                />
                {details.images.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImageIndex(prev => prev === 0 ? details.images.length - 1 : prev - 1)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentImageIndex(prev => prev === details.images.length - 1 ? 0 : prev + 1)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {details.images.map((_, idx) => (
                        <div key={idx} className={`w-2 h-2 rounded-full ${idx === currentImageIndex ? 'bg-accent' : 'bg-gray-500'}`} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <svg className="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>

          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-2">
            <div className="card p-2">
              <p className="text-gray-400 text-xs">Muscles</p>
              <p className="text-white text-sm capitalize">{details.primaryMuscles?.join(', ') || 'N/A'}</p>
            </div>
            <div className="card p-2">
              <p className="text-gray-400 text-xs">Equipment</p>
              <p className="text-white text-sm capitalize">{details.equipment || 'Body Only'}</p>
            </div>
            <div className="card p-2">
              <p className="text-gray-400 text-xs">Level</p>
              <p className="text-white text-sm capitalize">{details.level || 'N/A'}</p>
            </div>
            <div className="card p-2">
              <p className="text-gray-400 text-xs">Category</p>
              <p className="text-white text-sm capitalize">{details.category || 'N/A'}</p>
            </div>
          </div>

          {/* Secondary Muscles */}
          {details.secondaryMuscles?.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs mb-1">Secondary Muscles</p>
              <div className="flex flex-wrap gap-1">
                {details.secondaryMuscles.map((muscle, idx) => (
                  <span key={idx} className="px-2 py-1 bg-dark-elevated rounded text-xs text-gray-300 capitalize">{muscle}</span>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          {details.instructions?.length > 0 && (
            <div>
              <h3 className="text-white font-medium mb-2">Instructions</h3>
              <ol className="space-y-2">
                {details.instructions.map((step, idx) => (
                  <li key={idx} className="flex gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs flex-shrink-0">{idx + 1}</span>
                    <p className="text-gray-300">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Today
