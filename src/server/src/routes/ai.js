// AI routes - Simplified fitness coach chat
import express from 'express'
import prisma from '../lib/prisma.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Helper to get user's AI configuration (OpenAI only for now)
async function getUserAIConfig(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { openaiApiKey: true }
  })

  const userSettings = await prisma.userSettings.findUnique({
    where: { userId }
  })

  const appSettings = await prisma.appSettings.findUnique({
    where: { id: '1' }
  })

  // Check if user has their own OpenAI key
  if (user?.openaiApiKey) {
    return {
      provider: 'openai',
      apiKey: user.openaiApiKey,
      model: userSettings?.aiModel || 'gpt-4o-mini',
      source: 'user'
    }
  }

  // Fall back to global OpenAI settings
  if (appSettings?.globalOpenaiEnabled && appSettings.globalOpenaiApiKey) {
    return {
      provider: 'openai',
      apiKey: appSettings.globalOpenaiApiKey,
      model: userSettings?.aiModel || 'gpt-4o-mini',
      source: 'global'
    }
  }

  // No AI configuration available
  return { provider: null, apiKey: null, model: null, source: null }
}

// Helper to call OpenAI API
async function callAI(config, messages, options = {}) {
  if (!config.provider) {
    throw new Error('No AI provider configured')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      ...options
    })
  })

  return response
}

// Load exercise database for catalog awareness
let exerciseDatabase = null

function loadExerciseDatabase() {
  if (exerciseDatabase) return exerciseDatabase

  try {
    const exercisesPath = process.env.NODE_ENV === 'production'
      ? path.join(__dirname, '../../data/exercises.json')
      : path.join(__dirname, '../../../../exercises-db/dist/exercises.json')

    exerciseDatabase = JSON.parse(fs.readFileSync(exercisesPath, 'utf-8'))
    console.log(`[AI] Loaded ${exerciseDatabase.length} exercises`)
    return exerciseDatabase
  } catch (e) {
    console.error('[AI] Failed to load exercise database:', e.message)
    return []
  }
}

// Get exercise catalog summary for AI context
function getExerciseCatalogSummary() {
  const exercises = loadExerciseDatabase()
  if (!exercises.length) return null

  // Get unique muscle groups and equipment types
  const muscleGroups = new Set()
  const equipmentTypes = new Set()

  exercises.forEach(e => {
    if (e.primaryMuscles) e.primaryMuscles.forEach(m => muscleGroups.add(m))
    if (e.equipment) equipmentTypes.add(e.equipment)
  })

  return {
    totalExercises: exercises.length,
    muscleGroups: Array.from(muscleGroups).sort(),
    equipmentTypes: Array.from(equipmentTypes).sort()
  }
}

// Helper to get user context for personalized AI responses
async function getUserContext(userId) {
  // Fetch user profile and settings
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      trainingStyle: true,
      heightCm: true,
      weightKg: true,
      goalWeightKg: true,
      sex: true,
      birthDate: true,
      activityLevel: true,
      settings: {
        select: {
          weightUnit: true,
          availableEquipment: true,
          gymType: true,
          dietaryGoal: true,
          dailyCalorieGoal: true,
          dailyProteinGoal: true,
          dailyCarbsGoal: true,
          dailyFatGoal: true
        }
      }
    }
  })

  if (!user) return null

  // Fetch user stats
  const stats = await prisma.userStats.findUnique({
    where: { userId },
    select: {
      totalWorkouts: true,
      currentStreak: true,
      longestStreak: true,
      totalPRs: true
    }
  })

  // Fetch active goals
  const goals = await prisma.goal.findMany({
    where: { userId, isCompleted: false },
    select: {
      type: true,
      targetValue: true,
      currentValue: true,
      exerciseName: true,
      targetDate: true
    },
    take: 5
  })

  // Fetch recent PRs (last 10)
  const recentPRs = await prisma.set.findMany({
    where: {
      isPR: true,
      log: {
        session: { userId }
      }
    },
    select: {
      weight: true,
      reps: true,
      createdAt: true,
      log: {
        select: { exerciseName: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  // Fetch favorite exercises (stored as isFavorite flag on ExerciseNote)
  const favorites = await prisma.exerciseNote.findMany({
    where: { userId, isFavorite: true },
    select: { exerciseId: true },
    take: 20
  })

  // Fetch most used exercises (from workout logs)
  const mostUsed = await prisma.exerciseLog.groupBy({
    by: ['exerciseName'],
    where: {
      session: { userId }
    },
    _count: { exerciseName: true },
    orderBy: { _count: { exerciseName: 'desc' } },
    take: 15
  })

  // Fetch current weekly schedule
  const weeklySchedule = await prisma.weeklySchedule.findMany({
    where: { userId },
    include: {
      exercises: {
        select: { exerciseName: true, sets: true, reps: true },
        orderBy: { order: 'asc' }
      }
    },
    orderBy: { dayOfWeek: 'asc' }
  })

  // Fetch recent food log entries (last 7 days) for nutrition context
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentFoodLogs = await prisma.foodLogEntry.findMany({
    where: {
      userId,
      date: { gte: sevenDaysAgo }
    },
    select: {
      date: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true
    },
    orderBy: { date: 'desc' }
  })

  // Aggregate nutrition by day
  const nutritionByDay = {}
  recentFoodLogs.forEach(log => {
    const dateKey = log.date.toISOString().split('T')[0]
    if (!nutritionByDay[dateKey]) {
      nutritionByDay[dateKey] = { calories: 0, protein: 0, carbs: 0, fat: 0 }
    }
    nutritionByDay[dateKey].calories += log.calories || 0
    nutritionByDay[dateKey].protein += log.protein || 0
    nutritionByDay[dateKey].carbs += log.carbs || 0
    nutritionByDay[dateKey].fat += log.fat || 0
  })
  const recentNutrition = Object.entries(nutritionByDay).map(([date, totals]) => ({
    date,
    totalCalories: Math.round(totals.calories),
    totalProtein: Math.round(totals.protein),
    totalCarbs: Math.round(totals.carbs),
    totalFat: Math.round(totals.fat)
  }))

  // Calculate age from birthDate
  let age = null
  if (user.birthDate) {
    const today = new Date()
    const birth = new Date(user.birthDate)
    age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
  }

  // Build context object
  return {
    profile: {
      name: user.name?.split(' ')[0],
      sex: user.sex,
      age,
      heightCm: user.heightCm,
      weightKg: user.weightKg,
      goalWeightKg: user.goalWeightKg,
      activityLevel: user.activityLevel,
      trainingStyle: user.trainingStyle,
      weightUnit: user.settings?.weightUnit || 'LBS'
    },
    equipment: {
      available: user.settings?.availableEquipment || [],
      gymType: user.settings?.gymType
    },
    nutrition: {
      goal: user.settings?.dietaryGoal,
      dailyCalories: user.settings?.dailyCalorieGoal,
      dailyProtein: user.settings?.dailyProteinGoal,
      dailyCarbs: user.settings?.dailyCarbsGoal,
      dailyFat: user.settings?.dailyFatGoal,
      recentLogs: recentNutrition
    },
    stats: stats || {},
    goals: goals.map(g => ({
      type: g.type,
      target: g.targetValue,
      current: g.currentValue,
      exercise: g.exerciseName,
      deadline: g.targetDate
    })),
    recentPRs: recentPRs.slice(0, 5).map(pr => ({
      exercise: pr.log.exerciseName,
      weight: pr.weight,
      reps: pr.reps
    })),
    favorites: favorites.map(f => f.exerciseId),
    mostUsedExercises: mostUsed.map(e => ({
      name: e.exerciseName,
      count: e._count.exerciseName
    })),
    weeklySchedule: weeklySchedule.map(day => ({
      day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.dayOfWeek],
      name: day.name,
      exercises: day.exercises.map(e => e.exerciseName)
    }))
  }
}

// Build system prompt
function buildSystemPrompt(userContext, catalogSummary, pageContext) {
  let prompt = `You are a knowledgeable and supportive fitness coach and nutritionist for the HomeFit workout app.

Your role is to help users with:
- Exercise form and technique questions
- Workout planning and programming advice
- Nutrition guidance and meal planning
- Motivation and fitness education
- Understanding their progress and data

Be conversational, helpful, and encouraging. Keep responses concise but informative. If you don't know something, say so.`

  // Add exercise catalog awareness
  if (catalogSummary) {
    prompt += `

=== EXERCISE DATABASE ===
The app has ${catalogSummary.totalExercises} exercises available.
Muscle groups: ${catalogSummary.muscleGroups.join(', ')}
Equipment types: ${catalogSummary.equipmentTypes.join(', ')}`
  }

  // Add user context
  if (userContext) {
    prompt += `

=== USER PROFILE ===`

    if (userContext.profile.name) {
      prompt += `\nName: ${userContext.profile.name}`
    }

    // Body stats
    const bodyStats = []
    if (userContext.profile.sex) bodyStats.push(userContext.profile.sex)
    if (userContext.profile.age) bodyStats.push(`${userContext.profile.age} years old`)
    if (userContext.profile.heightCm) {
      const heightIn = Math.round(userContext.profile.heightCm / 2.54)
      const feet = Math.floor(heightIn / 12)
      const inches = heightIn % 12
      bodyStats.push(`${feet}'${inches}"`)
    }
    if (userContext.profile.weightKg) {
      const weight = userContext.profile.weightUnit === 'KG'
        ? `${userContext.profile.weightKg}kg`
        : `${Math.round(userContext.profile.weightKg * 2.205)}lbs`
      bodyStats.push(weight)
    }
    if (bodyStats.length > 0) {
      prompt += `\nBody: ${bodyStats.join(', ')}`
    }

    if (userContext.profile.goalWeightKg && userContext.profile.weightKg) {
      const diff = userContext.profile.goalWeightKg - userContext.profile.weightKg
      if (Math.abs(diff) > 1) {
        const action = diff < 0 ? 'lose' : 'gain'
        const amount = userContext.profile.weightUnit === 'KG'
          ? `${Math.abs(diff).toFixed(1)}kg`
          : `${Math.round(Math.abs(diff) * 2.205)}lbs`
        prompt += `\nWeight goal: ${action} ${amount}`
      }
    }

    if (userContext.profile.trainingStyle && userContext.profile.trainingStyle !== 'GENERAL') {
      prompt += `\nTraining style: ${userContext.profile.trainingStyle.toLowerCase()}`
    }

    if (userContext.profile.activityLevel) {
      prompt += `\nActivity level: ${userContext.profile.activityLevel}`
    }

    // Equipment
    if (userContext.equipment.gymType) {
      prompt += `\nGym type: ${userContext.equipment.gymType}`
    }
    if (userContext.equipment.available?.length > 0) {
      prompt += `\nAvailable equipment: ${userContext.equipment.available.join(', ')}`
    }

    // Stats
    if (userContext.stats.totalWorkouts > 0) {
      prompt += `\nExperience: ${userContext.stats.totalWorkouts} workouts completed`
      if (userContext.stats.currentStreak > 0) {
        prompt += `, ${userContext.stats.currentStreak}-day streak`
      }
    }

    // Active goals
    if (userContext.goals?.length > 0) {
      prompt += `\nActive goals:`
      userContext.goals.forEach(g => {
        const progress = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0
        if (g.type === 'EXERCISE_STRENGTH' && g.exercise) {
          prompt += `\n  - ${g.exercise}: ${g.current}/${g.target}lbs (${progress}%)`
        } else if (g.type === 'WEIGHT_LOSS' || g.type === 'WEIGHT_GAIN') {
          prompt += `\n  - ${g.type.replace('_', ' ').toLowerCase()}: ${progress}% complete`
        } else if (g.type === 'WORKOUT_COUNT') {
          prompt += `\n  - ${g.current}/${g.target} workouts`
        }
      })
    }

    // Recent PRs
    if (userContext.recentPRs?.length > 0) {
      prompt += `\nRecent PRs: ${userContext.recentPRs.map(pr =>
        `${pr.exercise} ${pr.weight}lbs×${pr.reps}`
      ).join(', ')}`
    }

    // Favorite exercises
    if (userContext.favorites?.length > 0) {
      prompt += `\nFavorite exercises: ${userContext.favorites.slice(0, 10).join(', ')}`
    }

    // Most used exercises
    if (userContext.mostUsedExercises?.length > 0) {
      prompt += `\nMost used exercises: ${userContext.mostUsedExercises.slice(0, 8).map(e => `${e.name} (${e.count}x)`).join(', ')}`
    }

    // Weekly schedule
    if (userContext.weeklySchedule?.length > 0) {
      prompt += `\nWeekly schedule:`
      userContext.weeklySchedule.forEach(day => {
        if (day.exercises.length > 0) {
          prompt += `\n  - ${day.day}: ${day.name || day.exercises.slice(0, 3).join(', ')}${day.exercises.length > 3 ? '...' : ''}`
        }
      })
    }

    // Nutrition info
    if (userContext.nutrition.goal) {
      prompt += `\nNutrition goal: ${userContext.nutrition.goal}`
    }
    if (userContext.nutrition.dailyCalories) {
      prompt += `\nDaily targets: ${userContext.nutrition.dailyCalories} cal`
      if (userContext.nutrition.dailyProtein) prompt += `, ${userContext.nutrition.dailyProtein}g protein`
      if (userContext.nutrition.dailyCarbs) prompt += `, ${userContext.nutrition.dailyCarbs}g carbs`
      if (userContext.nutrition.dailyFat) prompt += `, ${userContext.nutrition.dailyFat}g fat`
    }

    // Recent nutrition adherence
    if (userContext.nutrition.recentLogs?.length > 0) {
      const avgCalories = Math.round(userContext.nutrition.recentLogs.reduce((sum, l) => sum + (l.totalCalories || 0), 0) / userContext.nutrition.recentLogs.length)
      const avgProtein = Math.round(userContext.nutrition.recentLogs.reduce((sum, l) => sum + (l.totalProtein || 0), 0) / userContext.nutrition.recentLogs.length)
      if (avgCalories > 0) {
        prompt += `\nRecent nutrition (${userContext.nutrition.recentLogs.length}-day avg): ${avgCalories} cal, ${avgProtein}g protein`
      }
    }

    prompt += `\n=== END USER PROFILE ===`
  }

  // Add page-specific context
  if (pageContext === 'schedule') {
    prompt += `\n\nThe user is on the Schedule page, planning their weekly workouts.`
  } else if (pageContext === 'today') {
    prompt += `\n\nThe user is on the Today page, looking at their workout for today.`
  } else if (pageContext === 'catalog') {
    prompt += `\n\nThe user is browsing the Exercise Catalog.`
  } else if (pageContext === 'nutrition') {
    prompt += `\n\nThe user is on the Nutrition tracking page.`
  }

  return prompt
}

// GET /api/ai/status - Check if AI is available for the user
router.get('/status', async (req, res) => {
  try {
    const config = await getUserAIConfig(req.user.id)

    if (config.provider) {
      return res.json({
        available: true,
        source: config.source,
        provider: config.provider
      })
    }

    res.json({ available: false })
  } catch (error) {
    console.error('Error checking AI status:', error)
    res.json({ available: false })
  }
})

// POST /api/ai/chat - Send a message to AI
router.post('/chat', async (req, res) => {
  try {
    const { message, context, history = [] } = req.body

    if (!message) {
      return res.status(400).json({ message: 'Message is required' })
    }

    // Get AI configuration
    const config = await getUserAIConfig(req.user.id)

    if (!config.provider) {
      return res.status(400).json({
        message: 'AI is not configured. Please add your OpenAI API key in Settings, or ask your admin to enable the global AI.'
      })
    }

    // Fetch user context for personalization
    const userContext = await getUserContext(req.user.id)

    // Get exercise catalog summary
    const catalogSummary = getExerciseCatalogSummary()

    // Build system prompt
    const systemPrompt = buildSystemPrompt(userContext, catalogSummary, context)

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ]

    // Call OpenAI API
    const aiResponse = await callAI(config, messages, {
      max_tokens: 1000,
      temperature: 0.7
    })

    if (!aiResponse.ok) {
      const errorData = await aiResponse.json().catch(() => ({}))
      console.error('AI API error:', errorData)

      if (aiResponse.status === 401) {
        return res.status(400).json({ message: 'Invalid API key. Please check your API key in settings.' })
      }
      if (aiResponse.status === 429) {
        return res.status(429).json({ message: 'Rate limit exceeded. Please wait a moment and try again.' })
      }

      return res.status(500).json({ message: 'Failed to get AI response. Please try again.' })
    }

    const data = await aiResponse.json()
    const assistantMessage = data.choices?.[0]?.message?.content || 'Sorry, I couldn\'t generate a response.'

    res.json({
      message: assistantMessage,
      source: config.source,
      provider: config.provider
    })
  } catch (error) {
    console.error('Error in AI chat:', error)
    res.status(500).json({ message: 'An error occurred. Please try again.' })
  }
})

// POST /api/ai/suggest-workout - Get AI-generated workout suggestion
router.post('/suggest-workout', async (req, res) => {
  try {
    const { muscleGroups, duration, equipment, fitnessLevel } = req.body

    const config = await getUserAIConfig(req.user.id)

    if (!config.provider) {
      return res.status(400).json({ message: 'AI is not configured' })
    }

    const userContext = await getUserContext(req.user.id)
    const userEquipment = equipment?.length > 0
      ? equipment
      : userContext?.equipment?.available?.length > 0
        ? userContext.equipment.available
        : ['bodyweight']

    let level = fitnessLevel
    if (!level && userContext?.stats?.totalWorkouts) {
      if (userContext.stats.totalWorkouts < 20) level = 'beginner'
      else if (userContext.stats.totalWorkouts < 100) level = 'intermediate'
      else level = 'advanced'
    }

    const prompt = `Create a workout plan:
- Target muscles: ${muscleGroups?.join(', ') || 'full body'}
- Duration: ${duration || 45} minutes
- Equipment: ${userEquipment.join(', ')}
- Level: ${level || 'intermediate'}

Return JSON only:
{
  "name": "Workout name",
  "exercises": [
    { "name": "Exercise", "sets": 3, "reps": "10-12", "restSeconds": 60, "notes": "Form tip" }
  ],
  "warmup": "Warmup description",
  "cooldown": "Cooldown description"
}`

    const messages = [
      { role: 'system', content: 'You are a fitness trainer. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ]

    const response = await callAI(config, messages, {
      max_tokens: 1000,
      temperature: 0.7
    })

    if (!response.ok) {
      return res.status(500).json({ message: 'Failed to generate workout' })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    try {
      const workout = JSON.parse(content.replace(/```json\n?|```\n?/g, '').trim())
      res.json({ workout, provider: config.provider })
    } catch (e) {
      res.status(500).json({ message: 'Failed to parse workout suggestion' })
    }
  } catch (error) {
    console.error('Error suggesting workout:', error)
    res.status(500).json({ message: 'An error occurred' })
  }
})

// Helper: round to nearest increment (for clean weight values)
function roundToNearest(value, increment) {
  return Math.round(value / increment) * increment
}

// Rule-based set suggestion calculator
function calculateRuleBasedSuggestion({ lastSets, trainingStyle, pr, setNumber, difficultyFeedback }) {
  const repRanges = {
    STRENGTH: { min: 3, max: 5, idealReps: 5 },
    POWERLIFTING: { min: 1, max: 5, idealReps: 3 },
    BODYBUILDING: { min: 8, max: 12, idealReps: 10 },
    ATHLETIC: { min: 6, max: 10, idealReps: 8 },
    ENDURANCE: { min: 15, max: 25, idealReps: 20 },
    GENERAL: { min: 8, max: 12, idealReps: 10 }
  }

  const range = repRanges[trainingStyle] || repRanges.GENERAL

  // No previous sets in this session - use PR or return target reps
  if (!lastSets || lastSets.length === 0) {
    if (pr && pr.weight > 0) {
      const workingWeightPct = (trainingStyle === 'STRENGTH' || trainingStyle === 'POWERLIFTING') ? 0.85 : 0.75
      const suggestedWeight = roundToNearest(pr.weight * workingWeightPct, 5)
      return {
        weight: suggestedWeight,
        reps: range.idealReps,
        reason: `Starting weight based on your PR of ${pr.weight}lbs × ${pr.reps}. Adjust as needed.`
      }
    }
    return {
      weight: null,
      reps: range.idealReps,
      reason: `Target ${range.min}-${range.max} reps for ${trainingStyle.toLowerCase()} training.`
    }
  }

  // Get the most recent completed set
  const lastSet = lastSets[lastSets.length - 1]
  const lastWeight = lastSet.weight || 0
  const lastReps = lastSet.reps || 0
  const difficulty = difficultyFeedback || lastSet.difficulty

  // No difficulty feedback: suggest same weight/reps
  if (!difficulty) {
    return {
      weight: lastWeight > 0 ? lastWeight : null,
      reps: lastReps || range.idealReps,
      reason: 'Same as your last set. Rate difficulty to get personalized suggestions.'
    }
  }

  let suggestedWeight = lastWeight
  let suggestedReps = lastReps
  let reason = ''

  if (difficulty <= 2) {
    // Easy: increase weight or reps
    if (lastWeight > 0) {
      const increment = (trainingStyle === 'STRENGTH' || trainingStyle === 'POWERLIFTING') ? 10 : 5
      suggestedWeight = lastWeight + increment
      suggestedReps = lastReps
      reason = `Last set felt easy (${difficulty}/5). Increased weight by ${increment}lbs.`
    } else {
      const repBump = difficulty === 1 ? 3 : 2
      suggestedReps = lastReps + repBump
      reason = `Last set felt easy (${difficulty}/5). Added ${repBump} reps.`
    }
  } else if (difficulty === 3) {
    suggestedWeight = lastWeight
    suggestedReps = lastReps
    reason = 'Good difficulty. Maintaining same weight and reps.'
  } else if (difficulty === 4) {
    suggestedWeight = lastWeight
    if (lastReps > range.min) {
      suggestedReps = Math.max(lastReps - 1, range.min)
      reason = `Last set was tough (${difficulty}/5). Same weight, reduced to ${suggestedReps} reps.`
    } else {
      suggestedReps = lastReps
      reason = `Last set was tough (${difficulty}/5). Maintaining current load.`
    }
  } else if (difficulty >= 5) {
    if (lastWeight > 0) {
      const decrement = (trainingStyle === 'STRENGTH' || trainingStyle === 'POWERLIFTING') ? 10 : 5
      suggestedWeight = Math.max(lastWeight - decrement, 0)
      suggestedReps = lastReps
      reason = `Last set was very hard (${difficulty}/5). Reduced weight by ${decrement}lbs to maintain form.`
    } else {
      suggestedReps = Math.max(lastReps - 2, 1)
      reason = `Last set was very hard (${difficulty}/5). Reduced to ${suggestedReps} reps.`
    }
  }

  // Safety cap: don't suggest going above PR weight
  if (pr && pr.weight > 0 && suggestedWeight > pr.weight * 1.05) {
    suggestedWeight = pr.weight
    reason += ' (Capped near your PR - be careful with heavy weight.)'
  }

  // Round weight to nearest 5
  if (suggestedWeight > 0) {
    suggestedWeight = roundToNearest(suggestedWeight, 5)
  }

  return {
    weight: suggestedWeight > 0 ? suggestedWeight : null,
    reps: suggestedReps,
    reason
  }
}

// POST /api/ai/suggest-set - Rule-based (or AI-powered) set suggestion
router.post('/suggest-set', async (req, res) => {
  try {
    const {
      exerciseName,
      lastSets = [],
      trainingStyle = 'GENERAL',
      pr,
      setNumber = 1,
      difficultyFeedback,
      useAi = false
    } = req.body

    // If useAi is requested, try AI first then fall back to rules
    if (useAi) {
      try {
        const config = await getUserAIConfig(req.user.id)
        if (config.provider) {
          const prompt = `You are a fitness coach. Suggest the next set for ${exerciseName}.

Training style: ${trainingStyle}
Set number: ${setNumber}
${pr ? `PR: ${pr.weight}lbs x ${pr.reps} reps` : 'No PR recorded yet'}
${lastSets.length > 0 ? `Previous sets this session: ${lastSets.map((s, i) => `Set ${i+1}: ${s.weight}lbs x ${s.reps} reps${s.difficulty ? ` (difficulty ${s.difficulty}/5)` : ''}`).join(', ')}` : 'First set of the session'}
${difficultyFeedback ? `Last set difficulty: ${difficultyFeedback}/5 (1=very easy, 5=very hard)` : ''}

Return ONLY valid JSON: {"weight": <number or null>, "reps": <number>, "reason": "<brief explanation>"}`

          const response = await callAI(config, [
            { role: 'system', content: 'You are a concise fitness coach. Return only valid JSON.' },
            { role: 'user', content: prompt }
          ], { max_tokens: 200, temperature: 0.3 })

          if (response.ok) {
            const data = await response.json()
            const content = data.choices?.[0]?.message?.content || ''
            try {
              const aiSuggestion = JSON.parse(content.replace(/```json\n?|```\n?/g, '').trim())
              return res.json({ suggestion: aiSuggestion, source: 'ai' })
            } catch (e) {
              // AI response wasn't valid JSON, fall through to rules
            }
          }
        }
      } catch (aiError) {
        console.error('AI suggestion failed, falling back to rules:', aiError.message)
      }
    }

    // Rule-based suggestion
    const suggestion = calculateRuleBasedSuggestion({
      exerciseName, lastSets, trainingStyle, pr, setNumber, difficultyFeedback
    })

    res.json({ suggestion, source: 'rules' })
  } catch (error) {
    console.error('Error in suggest-set:', error)
    res.status(500).json({ message: 'Failed to generate suggestion' })
  }
})

export default router
