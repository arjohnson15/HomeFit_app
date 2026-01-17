// AI routes for chat, workout creation, exercise removal, and disambiguation
import express from 'express'
import prisma from '../lib/prisma.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Helper to get user's AI configuration
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

  // Determine provider and config from user settings first, then fall back to global
  const userProvider = userSettings?.aiProvider || 'openai'

  // Check if user has their own config
  if (userProvider === 'ollama' && userSettings?.ollamaEndpoint) {
    // User has Ollama configured
    return {
      provider: 'ollama',
      endpoint: userSettings.ollamaEndpoint,
      model: userSettings.ollamaModel || 'llama2',
      source: 'user',
      apiKey: userSettings.ollamaApiKey || null
    }
  } else if (userProvider === 'openai' && user?.openaiApiKey) {
    // User has OpenAI configured
    return {
      provider: 'openai',
      apiKey: user.openaiApiKey,
      model: userSettings?.aiModel || 'gpt-4o-mini',
      source: 'user',
      endpoint: null
    }
  }

  // Fall back to global settings
  if (appSettings?.globalOpenaiEnabled) {
    const globalProvider = appSettings.globalAiProvider || 'openai'

    if (globalProvider === 'ollama' && appSettings.globalOllamaEndpoint) {
      return {
        provider: 'ollama',
        endpoint: appSettings.globalOllamaEndpoint,
        model: appSettings.globalOllamaModel || 'llama2',
        source: 'global',
        apiKey: appSettings.globalOllamaApiKey || null
      }
    } else if (globalProvider === 'openai' && appSettings.globalOpenaiApiKey) {
      return {
        provider: 'openai',
        apiKey: appSettings.globalOpenaiApiKey,
        model: userSettings?.aiModel || 'gpt-4o-mini',
        source: 'global',
        endpoint: null
      }
    }
  }

  // No AI configuration available
  return { provider: null, apiKey: null, model: null, source: null, endpoint: null }
}

// Helper to call AI API (supports both OpenAI and Ollama)
async function callAI(config, messages, options = {}) {
  if (!config.provider) {
    throw new Error('No AI provider configured')
  }

  const baseUrl = config.provider === 'ollama'
    ? `${config.endpoint}/v1`
    : 'https://api.openai.com/v1'

  const headers = { 'Content-Type': 'application/json' }
  if (config.apiKey) {
    // Works for both OpenAI and authenticated Ollama proxies
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      ...options
    })
  })

  return response
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
          dailyProteinGoal: true
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
      name: user.name?.split(' ')[0], // First name only
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
      dailyProtein: user.settings?.dailyProteinGoal
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
    }))
  }
}

// Build personalized system prompt with user context
function buildPersonalizedPrompt(context, pageContext) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayName = dayNames[new Date().getDay()]

  let prompt = `You are a helpful fitness assistant for the HomeFit workout app.
You help users plan workouts, answer exercise questions, and add workouts to their schedule.
Keep responses short (2-4 sentences) unless more detail is requested.

=== MOST IMPORTANT - ADDING WORKOUTS TO SCHEDULE ===

When a user asks you to ADD, CREATE, MAKE, or SCHEDULE a workout or exercises for ANY day, you MUST respond with this EXACT format:

WORKOUT:[Day]
[Exercise Name]|[sets]|[reps]
[Exercise Name]|[sets]|[reps]

Where [Day] is: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday, or Today
Where [sets] is a number like 3 or 4
Where [reps] is a number or range like 10 or 8-12

EXAMPLES:

User: "Add shoulder press to Monday"
Response: Adding shoulder press to Monday!
WORKOUT:Monday
Shoulder Press|3|10-12

User: "Add bench press to today"
Response: Done! Adding bench press!
WORKOUT:Today
Bench Press|3|8-10

User: "Add dumbbell shoulder press to Monday"
Response: Adding dumbbell shoulder press!
WORKOUT:Monday
Dumbbell Shoulder Press|3|10-12

User: "Create a leg workout for Tuesday"
Response: Here's a solid leg workout for Tuesday!
WORKOUT:Tuesday
Barbell Squat|4|6-8
Romanian Deadlift|3|10-12
Leg Press|3|12-15
Leg Curl|3|10-12

User: "Give me a push workout for today"
Response: Here's your push workout!
WORKOUT:Today
Barbell Bench Press|4|8-10
Dumbbell Shoulder Press|3|8-10
Incline Dumbbell Press|3|10-12
Tricep Pushdowns|3|12-15

User: "Add pull ups and rows to Wednesday"
Response: Added your back exercises!
WORKOUT:Wednesday
Pull Ups|3|8-10
Barbell Rows|4|8-10

CRITICAL RULES:
1. ALWAYS use WORKOUT:[Day] format when adding exercises to a schedule
2. Each exercise goes on its own line: Name|sets|reps
3. Do NOT use markdown, bullets, or any other formatting for the workout
4. Write a brief friendly message BEFORE the WORKOUT: block
5. Today is ${todayName} (${new Date().toISOString().split('T')[0]})
6. ONLY add exactly what the user asks for! If they say "add shoulder press", add ONLY shoulder press (1 exercise). If they say "create a leg workout", THEN you can create multiple exercises. Never add extra exercises unless they ask for a full workout.
7. Use the EXACT exercise name the user provided - do not add equipment prefixes unless they did. If user says "shoulder press", output "Shoulder Press", NOT "Barbell Shoulder Press" or multiple variations.

=== REMOVING EXERCISES ===
When a user asks to REMOVE, DELETE, or CLEAR exercises from a day, respond with this format:

REMOVE:[Day]
[Exercise Name or "all"]

REMOVAL EXAMPLES:

User: "Remove bench press from Monday"
Response: I'll remove Bench Press from Monday. Please confirm by typing "yes".
REMOVE:Monday
Bench Press

User: "Clear all exercises from Tuesday"
Response: I'll remove all exercises from Tuesday. Please confirm by typing "yes".
REMOVE:Tuesday
all

User: "Delete squats from today"
Response: I'll remove Squats from today. Please confirm by typing "yes".
REMOVE:Today
Squats

User: (after you just added Dumbbell Shoulder Press to Monday) "Remove that from today"
Response: I'll remove Dumbbell Shoulder Press from Monday. Please confirm by typing "yes".
REMOVE:Monday
Dumbbell Shoulder Press

User: (after adding Barbell Bench Press to Monday) "can you remove that now"
Response: I'll remove Barbell Bench Press from Monday. Please confirm by typing "yes".
REMOVE:Monday
Barbell Bench Press

User: (after adding Cable Rows to Wednesday) "actually delete it"
Response: I'll remove Cable Rows from Wednesday. Please confirm by typing "yes".
REMOVE:Wednesday
Cable Rows

CRITICAL REMOVAL RULES:
1. Always ask for confirmation before removing exercises!
2. CONTEXT IS EVERYTHING: When user says "that", "it", "the exercise", "remove that now", or similar references, you MUST use the exercise from recent conversation history. Look at what was just added or discussed!
3. Use the SAME day the exercise was added to - if you added to Monday, remove from Monday
4. NEVER ask "which exercise?" if you just added one in the recent messages - use that exercise name
5. NEVER give generic examples like "Bench Press OR Squats" - use the ACTUAL exercise from conversation

=== GENERAL FITNESS HELP ===
For questions about exercise form, muscles, nutrition, or training advice, just answer helpfully.
If asked about injuries or medical conditions, recommend consulting a healthcare professional.`

  // Add personalized user context
  if (context) {
    prompt += `\n\n--- USER PROFILE ---`

    if (context.profile.name) {
      prompt += `\nName: ${context.profile.name}`
    }

    // Body stats
    const bodyStats = []
    if (context.profile.sex) bodyStats.push(context.profile.sex)
    if (context.profile.age) bodyStats.push(`${context.profile.age} years old`)
    if (context.profile.heightCm) {
      const heightIn = Math.round(context.profile.heightCm / 2.54)
      const feet = Math.floor(heightIn / 12)
      const inches = heightIn % 12
      bodyStats.push(`${feet}'${inches}"`)
    }
    if (context.profile.weightKg) {
      const weight = context.profile.weightUnit === 'KG'
        ? `${context.profile.weightKg}kg`
        : `${Math.round(context.profile.weightKg * 2.205)}lbs`
      bodyStats.push(weight)
    }
    if (bodyStats.length > 0) {
      prompt += `\nBody: ${bodyStats.join(', ')}`
    }

    if (context.profile.goalWeightKg && context.profile.weightKg) {
      const diff = context.profile.goalWeightKg - context.profile.weightKg
      if (Math.abs(diff) > 1) {
        const action = diff < 0 ? 'lose' : 'gain'
        const amount = context.profile.weightUnit === 'KG'
          ? `${Math.abs(diff).toFixed(1)}kg`
          : `${Math.round(Math.abs(diff) * 2.205)}lbs`
        prompt += `\nWeight goal: ${action} ${amount}`
      }
    }

    if (context.profile.trainingStyle && context.profile.trainingStyle !== 'GENERAL') {
      prompt += `\nTraining style: ${context.profile.trainingStyle.toLowerCase()}`
    }

    if (context.profile.activityLevel) {
      prompt += `\nActivity level: ${context.profile.activityLevel}`
    }

    // Equipment
    if (context.equipment.gymType) {
      prompt += `\nGym type: ${context.equipment.gymType}`
    }
    if (context.equipment.available?.length > 0) {
      prompt += `\nAvailable equipment: ${context.equipment.available.join(', ')}`
    } else if (!context.equipment.gymType) {
      prompt += `\nEquipment: Not specified (ask if relevant)`
    }

    // Stats
    if (context.stats.totalWorkouts > 0) {
      prompt += `\nExperience: ${context.stats.totalWorkouts} workouts completed`
      if (context.stats.currentStreak > 0) {
        prompt += `, ${context.stats.currentStreak}-day streak`
      }
    }

    // Active goals
    if (context.goals?.length > 0) {
      prompt += `\nActive goals:`
      context.goals.forEach(g => {
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
    if (context.recentPRs?.length > 0) {
      prompt += `\nRecent PRs: ${context.recentPRs.map(pr =>
        `${pr.exercise} ${pr.weight}lbs×${pr.reps}`
      ).join(', ')}`
    }

    // Nutrition goals
    if (context.nutrition.goal) {
      prompt += `\nNutrition goal: ${context.nutrition.goal}`
    }
    if (context.nutrition.dailyCalories) {
      prompt += `\nDaily targets: ${context.nutrition.dailyCalories} cal`
      if (context.nutrition.dailyProtein) {
        prompt += `, ${context.nutrition.dailyProtein}g protein`
      }
    }

    prompt += `\n--- END USER PROFILE ---`
    prompt += `\n\nUse this information to personalize your advice. Suggest weights and exercises appropriate for their experience level and available equipment.`
  }

  // Add page-specific context
  if (pageContext === 'schedule') {
    prompt += `\n\nThe user is currently on the Schedule page, planning their weekly workouts.
Help them create balanced training splits and organize their week effectively.
Consider rest days and muscle group recovery when making suggestions.
REMEMBER: When adding workouts to a day, use the WORKOUT:[Day] format!`
  } else if (pageContext === 'today') {
    prompt += `\n\nThe user is on their Today page, looking at their workout for today.
Help them with exercise form, warm-up suggestions, and motivation.
Keep responses action-oriented and motivating.`
  } else if (pageContext === 'catalog') {
    prompt += `\n\nThe user is browsing the Exercise Catalog with 7000+ exercises.
Help them understand exercises, proper form, muscle targeting, and exercise selection.
When they ask about an exercise, explain the movement, muscles worked, common mistakes, and variations.
Suggest alternatives based on their available equipment if relevant.
Be specific about technique cues and safety tips.`
  } else if (pageContext === 'nutrition') {
    prompt += `\n\nThe user is on the Nutrition tracking page.
Help them with nutrition questions, meal planning, macro calculations, and dietary advice.
Consider their nutrition goals and calorie/protein targets when giving advice.
Provide practical tips for meal prep, food choices, and hitting their macro targets.
If they ask about specific foods, explain nutritional value and how it fits their goals.`
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

// Define tools for function calling
const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_workout',
      description: 'Create a workout and add it to the user\'s schedule. Use this when the user asks to create, add, or schedule a workout for a specific day.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the workout (e.g., "Chest Day", "Leg Day", "Full Body")'
          },
          dayOfWeek: {
            type: 'integer',
            description: 'Day of week as a number: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday. Use this for requests like "on Monday".'
          },
          specificDate: {
            type: 'string',
            description: 'Specific date in YYYY-MM-DD format. Use this for requests like "on July 1st" or "on the 15th".'
          },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exerciseName: { type: 'string', description: 'Name of the exercise' },
                sets: { type: 'integer', description: 'Number of sets' },
                reps: { type: 'string', description: 'Number of reps or rep range (e.g., "10-12")' }
              },
              required: ['exerciseName', 'sets', 'reps']
            },
            description: 'List of exercises for the workout'
          },
          targetMuscles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Target muscle groups for this workout'
          }
        },
        required: ['name', 'exercises']
      }
    }
  }
]

// Detect if user is asking to create/add a workout
function isWorkoutCreationRequest(message) {
  const lowerMsg = message.toLowerCase()
  const createWords = ['create', 'add', 'make', 'schedule', 'put', 'give me', 'set up', 'build']
  const workoutWords = ['workout', 'exercise', 'routine', 'training', 'session']
  const dayWords = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'today', 'tomorrow']

  const hasCreateWord = createWords.some(w => lowerMsg.includes(w))
  const hasWorkoutWord = workoutWords.some(w => lowerMsg.includes(w))
  const hasDayWord = dayWords.some(w => lowerMsg.includes(w))

  // User is asking to create a workout if they mention creating + (workout or day)
  return hasCreateWord && (hasWorkoutWord || hasDayWord)
}

// POST /api/ai/clarify - Handle user clarification for ambiguous exercises
router.post('/clarify', async (req, res) => {
  try {
    const { choice, pendingWorkout, pendingRemoval } = req.body

    // Handle removal confirmation
    if (pendingRemoval) {
      const choiceLower = choice.toLowerCase().trim()

      // Check if user confirmed
      if (choiceLower === 'yes' || choiceLower === 'y' || choiceLower === 'confirm') {
        const result = await removeExercisesFromSchedule(req.user.id, pendingRemoval)

        if (result.success) {
          return res.json({
            message: `Done! ${result.message}`,
            removalComplete: result
          })
        } else {
          return res.json({
            message: result.message,
            pendingRemoval: null // Clear the pending removal
          })
        }
      } else if (choiceLower === 'no' || choiceLower === 'n' || choiceLower === 'cancel') {
        return res.json({
          message: "No problem, I won't remove anything.",
          pendingRemoval: null
        })
      } else {
        // Unrecognized response - ask again with context
        const whatToRemove = pendingRemoval.removeAll
          ? `all exercises from ${pendingRemoval.dayName}`
          : `${pendingRemoval.exercisesToRemove.join(', ')} from ${pendingRemoval.dayName}`
        return res.json({
          message: `I'll remove ${whatToRemove}. Please type "yes" to confirm, or "no" to cancel.`,
          pendingRemoval // Keep the pending removal
        })
      }
    }

    if (!pendingWorkout || !pendingWorkout.exercises) {
      return res.status(400).json({ message: 'No pending workout to clarify' })
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayName = pendingWorkout.dayOfWeek !== undefined ? dayNames[pendingWorkout.dayOfWeek] : 'your schedule'
    const choiceLower = choice.toLowerCase().trim()

    // Find the FIRST ambiguous exercise to resolve (one at a time for clarity)
    const firstAmbiguousIndex = pendingWorkout.exercises.findIndex(e => e.isAmbiguous)
    if (firstAmbiguousIndex === -1) {
      return res.status(400).json({ message: 'No ambiguous exercises to clarify' })
    }

    const exercise = pendingWorkout.exercises[firstAmbiguousIndex]
    const alternatives = exercise.alternatives || []
    let resolved = null

    // Check if choice is a number (1, 2, 3, etc.)
    const numChoice = parseInt(choiceLower)
    if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= alternatives.length) {
      const chosen = alternatives[numChoice - 1]
      resolved = {
        ...exercise,
        exerciseId: chosen.id,
        exerciseName: chosen.name,
        isAmbiguous: false
      }
    }

    // Check if choice matches an alternative name
    if (!resolved) {
      for (const alt of alternatives) {
        if (alt.name.toLowerCase().includes(choiceLower) ||
            choiceLower.includes(alt.name.toLowerCase().split(' ')[0])) {
          resolved = {
            ...exercise,
            exerciseId: alt.id,
            exerciseName: alt.name,
            isAmbiguous: false
          }
          break
        }
      }
    }

    // Check for equipment keywords
    if (!resolved) {
      const equipmentKeywords = ['dumbbell', 'barbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band']
      for (const keyword of equipmentKeywords) {
        if (choiceLower.includes(keyword)) {
          const match = alternatives.find(alt =>
            (alt.equipment || '').toLowerCase().includes(keyword) ||
            alt.name.toLowerCase().includes(keyword)
          )
          if (match) {
            resolved = {
              ...exercise,
              exerciseId: match.id,
              exerciseName: match.name,
              isAmbiguous: false
            }
            break
          }
        }
      }
    }

    // Build updated exercises list
    const updatedExercises = pendingWorkout.exercises.map((ex, i) => {
      if (i === firstAmbiguousIndex && resolved) {
        return resolved
      }
      return ex
    })

    // If we couldn't resolve, keep it ambiguous
    if (!resolved) {
      console.log(`[AI] Could not match choice "${choice}" for "${exercise.originalSearch}", keeping ambiguous`)
    }

    // Check if user sent a new workout request instead of a clarification
    const looksLikeNewRequest = /\b(add|create|make|schedule|give me|build)\b.*\b(workout|exercise|to|for)\b/i.test(choice)
    if (looksLikeNewRequest) {
      return res.status(400).json({
        message: "It looks like you're asking for a new workout. Please first choose from the options above (enter a number like 1, 2, 3, or say 'dumbbell', 'barbell', etc.), or click the reset button to start fresh.",
        pendingWorkout // Keep the pending workout
      })
    }

    // Check if there are still ambiguous exercises
    const stillAmbiguous = updatedExercises.filter(e => e.isAmbiguous)
    if (stillAmbiguous.length > 0) {
      const clarificationMessage = formatAmbiguityMessage(
        stillAmbiguous.map(e => ({ original: e.originalSearch, alternatives: e.alternatives })),
        dayName
      )
      return res.json({
        message: clarificationMessage,
        pendingWorkout: { ...pendingWorkout, exercises: updatedExercises }
      })
    }

    // All exercises resolved - create the workout
    const workoutResult = await createWorkoutForUser(req.user.id, {
      ...pendingWorkout,
      exercises: updatedExercises
    })

    if (workoutResult.success) {
      const exerciseNames = updatedExercises.map(e => e.exerciseName).join(', ')
      return res.json({
        message: `Done! I've added ${exerciseNames} to ${dayName}.`,
        workoutCreated: workoutResult
      })
    } else {
      return res.status(500).json({ message: workoutResult.message || 'Failed to create workout' })
    }
  } catch (error) {
    console.error('Error in clarify:', error)
    res.status(500).json({ message: 'An error occurred. Please try again.' })
  }
})

// POST /api/ai/chat - Send a message to AI (OpenAI or Ollama)
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
        message: 'AI is not configured. Please configure OpenAI or Ollama in Settings, or ask your admin to enable the global AI.'
      })
    }

    // Fetch user context for personalization
    const userContext = await getUserContext(req.user.id)

    // Build personalized system prompt
    const systemPrompt = buildPersonalizedPrompt(userContext, context)

    // Enhance user message if it's a workout creation request
    let enhancedMessage = message
    if (isWorkoutCreationRequest(message)) {
      enhancedMessage = `${message}

[REMINDER: Respond with WORKOUT:[Day] followed by exercises in Name|sets|reps format]`
      console.log('[AI] Detected workout creation request, added format reminder')
    }

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: enhancedMessage }
    ]

    // Prepare options
    const options = {
      max_tokens: 1000,
      temperature: 0.7
    }

    // Only enable tools for OpenAI (Ollama tool support is unreliable, we use text parsing instead)
    const supportsTools = config.provider === 'openai'

    if (supportsTools) {
      options.tools = AI_TOOLS
      options.tool_choice = 'auto'
    }

    // Call AI API
    const aiResponse = await callAI(config, messages, options)

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
    const choice = data.choices?.[0]

    // Check if the AI wants to call a function
    if (choice?.message?.tool_calls?.length > 0 && supportsTools) {
      const toolCall = choice.message.tool_calls[0]

      if (toolCall.function.name === 'create_workout') {
        try {
          const args = JSON.parse(toolCall.function.arguments)

          // Check for ambiguous exercises before creating workout
          const { resolvedExercises, ambiguousExercises } = checkForAmbiguousExercises(args.exercises || [])
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          const dayName = args.dayOfWeek !== undefined ? dayNames[args.dayOfWeek] : 'your schedule'

          if (ambiguousExercises.length > 0) {
            // Don't create workout yet - ask user to clarify
            const pendingWorkout = {
              ...args,
              exercises: resolvedExercises,
              ambiguousExercises
            }

            const clarificationMessage = formatAmbiguityMessage(ambiguousExercises, dayName)

            return res.json({
              message: clarificationMessage,
              source: config.source,
              provider: config.provider,
              pendingWorkout
            })
          }

          // No ambiguous exercises - create the workout
          const workoutResult = await createWorkoutForUser(req.user.id, args)

          // Get a follow-up response from the AI
          const followUpMessages = [
            ...messages,
            choice.message,
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(workoutResult)
            }
          ]

          const followUpResponse = await callAI(config, followUpMessages, {
            max_tokens: 500,
            temperature: 0.7
          })

          if (followUpResponse.ok) {
            const followUpData = await followUpResponse.json()
            const assistantMessage = followUpData.choices?.[0]?.message?.content ||
              `I've created the "${args.name}" workout for you!`

            return res.json({
              message: assistantMessage,
              source: config.source,
              provider: config.provider,
              workoutCreated: workoutResult.success ? workoutResult : null
            })
          }
        } catch (error) {
          console.error('Error executing create_workout:', error)
        }
      }
    }

    const assistantMessage = choice?.message?.content || 'Sorry, I couldn\'t generate a response.'

    console.log('[AI] Assistant message:', assistantMessage.substring(0, 200))

    // Fallback: Try to parse workout creation from text response (for models that don't properly use tool_calls)
    const parsedWorkout = parseWorkoutFromText(assistantMessage)
    console.log('[AI] Parsed workout result:', parsedWorkout)
    if (parsedWorkout) {
      try {
        // Check for ambiguous exercises before creating
        const { resolvedExercises, ambiguousExercises } = checkForAmbiguousExercises(parsedWorkout.exercises)
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const dayName = parsedWorkout.dayOfWeek !== undefined ? dayNames[parsedWorkout.dayOfWeek] : 'your schedule'

        if (ambiguousExercises.length > 0) {
          // Store pending workout in session for when user clarifies
          const pendingWorkout = {
            ...parsedWorkout,
            exercises: resolvedExercises,
            ambiguousExercises
          }

          const clarificationMessage = formatAmbiguityMessage(ambiguousExercises, dayName)

          return res.json({
            message: clarificationMessage,
            source: config.source,
            provider: config.provider,
            pendingWorkout // Client can store this and send back with clarification
          })
        }

        // No ambiguity - create the workout
        const workoutResult = await createWorkoutForUser(req.user.id, parsedWorkout)
        if (workoutResult.success) {
          // Clean up the response message to remove the structured data
          let cleanMessage = assistantMessage
            // Remove new WORKOUT: format
            .replace(/WORKOUT:\s*\w+/gi, '')
            .replace(/^[A-Za-z][A-Za-z0-9\s\-'()]+\|\d+\|\d+(?:-\d+)?$/gm, '')
            // Remove legacy formats
            .replace(/CREATE_WORKOUT\s+for\s+\w+/gi, '')
            .replace(/- Create Workout:.*$/gm, '')
            .replace(/- Exercise:.*$/gm, '')
            .replace(/^-\s*[A-Za-z][^:]+:\s*\d+\s*sets?\s*x\s*\d+.*$/gm, '')
            .replace(/exerciseName=.*$/gm, '')
            // Clean up whitespace
            .replace(/\n{3,}/g, '\n\n')
            .trim()

          if (!cleanMessage || cleanMessage.length < 20) {
            cleanMessage = `Done! I've added "${parsedWorkout.name}" to your ${workoutResult.dayName || 'schedule'} with ${parsedWorkout.exercises.length} exercise${parsedWorkout.exercises.length > 1 ? 's' : ''}.`
          }

          return res.json({
            message: cleanMessage,
            source: config.source,
            provider: config.provider,
            workoutCreated: workoutResult
          })
        }
      } catch (error) {
        console.error('Error creating workout from parsed text:', error)
      }
    }

    // Check for removal request in the response
    const parsedRemoval = parseRemovalFromText(assistantMessage)
    if (parsedRemoval) {
      // Clean up the message to remove the REMOVE: block
      let cleanMessage = assistantMessage
        .replace(/REMOVE:\s*\w+/gi, '')
        .replace(/^all$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      // Return with pendingRemoval for confirmation
      return res.json({
        message: cleanMessage,
        source: config.source,
        provider: config.provider,
        pendingRemoval: parsedRemoval
      })
    }

    res.json({ message: assistantMessage, source: config.source, provider: config.provider })
  } catch (error) {
    console.error('Error in AI chat:', error)
    res.status(500).json({ message: 'An error occurred. Please try again.' })
  }
})

// Parse workout creation from AI text response (for Ollama and models without proper tool calling)
function parseWorkoutFromText(text) {
  if (!text) return null

  console.log('[parseWorkout] Checking text for workout pattern...')

  const dayMapping = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  }
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  let workoutName = null
  let dayOfWeek = null
  let exercises = []

  // PRIMARY PATTERN (NEW): "WORKOUT:Monday" or "WORKOUT:Today" followed by "Name|sets|reps" lines
  const workoutPattern = /WORKOUT:\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today)/i
  const workoutMatch = text.match(workoutPattern)
  console.log('[parseWorkout] WORKOUT: pattern match:', workoutMatch ? workoutMatch[0] : 'no match')

  if (workoutMatch) {
    const dayStr = workoutMatch[1].toLowerCase()
    if (dayStr === 'today') {
      dayOfWeek = new Date().getDay()
      workoutName = "Today's Workout"
    } else {
      dayOfWeek = dayMapping[dayStr]
      workoutName = dayNames[dayOfWeek] + ' Workout'
    }

    // Parse exercises in pipe-delimited format: "Exercise Name|3|8-10" or "Exercise Name (variation)|3|8-10"
    const pipePattern = /^([A-Za-z][A-Za-z0-9\s\-'()]+?)\|(\d+)\|(\d+(?:-\d+)?)/gm
    let match
    while ((match = pipePattern.exec(text)) !== null) {
      const exerciseName = match[1].trim()
      // Skip lines that look like headers or are too short
      if (exerciseName.length > 2 && !exerciseName.toLowerCase().includes('exercise name')) {
        console.log('[parseWorkout] Found pipe exercise:', exerciseName)
        exercises.push({
          exerciseName,
          sets: parseInt(match[2]) || 3,
          reps: match[3] || '10'
        })
      }
    }
    console.log('[parseWorkout] Pipe exercises found:', exercises.length)
  }

  // SECONDARY PATTERN: "CREATE_WORKOUT for Monday" (legacy format)
  if (dayOfWeek === null) {
    const createPattern = /CREATE_WORKOUT\s+for\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today)/i
    const createMatch = text.match(createPattern)
    console.log('[parseWorkout] CREATE_WORKOUT pattern match:', createMatch ? createMatch[0] : 'no match')
    if (createMatch) {
      const dayStr = createMatch[1].toLowerCase()
      if (dayStr === 'today') {
        dayOfWeek = new Date().getDay()
        workoutName = "Today's Workout"
      } else {
        dayOfWeek = dayMapping[dayStr]
        workoutName = dayNames[dayOfWeek] + ' Workout'
      }
    }
  }

  // FALLBACK: Check for other patterns if neither WORKOUT: nor CREATE_WORKOUT found
  if (dayOfWeek === null) {
    // Pattern: "add to Tuesday" or "for Monday" or "for today" or "workout for Friday"
    const dayContextMatch = text.match(/(?:workout\s+for|add(?:ed|ing)?.*?(?:to|for)|for|on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today)/i)
    if (dayContextMatch) {
      const dayStr = dayContextMatch[1].toLowerCase()
      if (dayStr === 'today') {
        dayOfWeek = new Date().getDay()
        workoutName = "Today's Workout"
      } else {
        dayOfWeek = dayMapping[dayStr]
        workoutName = dayNames[dayOfWeek] + ' Workout'
      }
    }
  }

  // Parse exercises if not already found using various formats
  if (exercises.length === 0) {
    let match

    // Format: "- Exercise Name: 3 sets x 8-10 reps"
    const bulletColonPattern = /[-•*]\s*([^:\n]+):\s*(\d+)\s*sets?\s*x\s*(\d+(?:-\d+)?)\s*reps?/gi
    while ((match = bulletColonPattern.exec(text)) !== null) {
      console.log('[parseWorkout] Found bullet-colon exercise:', match[1].trim())
      exercises.push({
        exerciseName: match[1].trim(),
        sets: parseInt(match[2]) || 3,
        reps: match[3] || '10'
      })
    }

    // Format: "1. Exercise Name - 3 sets x 10 reps" or "1. Exercise Name: 3x10"
    if (exercises.length === 0) {
      const numberedPattern = /\d+\.\s*([A-Za-z][A-Za-z\s\-']+?)[\s\-:]+(\d+)\s*(?:sets?\s*)?[x×]\s*(\d+(?:-\d+)?)/gi
      while ((match = numberedPattern.exec(text)) !== null) {
        console.log('[parseWorkout] Found numbered exercise:', match[1].trim())
        exercises.push({
          exerciseName: match[1].trim(),
          sets: parseInt(match[2]) || 3,
          reps: match[3] || '10'
        })
      }
    }

    // Format: "- Bench Press - 3 sets of 10 reps"
    if (exercises.length === 0) {
      const bulletDashPattern = /[-•*]\s*([A-Z][A-Za-z\s\-']+?)(?:\s*\([^)]+\))?\s*[-–:]\s*(\d+)\s*sets?\s*(?:x|of)\s*(\d+(?:-\d+)?)\s*reps?/gi
      while ((match = bulletDashPattern.exec(text)) !== null) {
        exercises.push({
          exerciseName: match[1].trim(),
          sets: parseInt(match[2]) || 3,
          reps: match[3] || '10'
        })
      }
    }

    // Format: "Bench Press (3 sets of 10 reps)" or "Bench Press: 3 sets, 10 reps"
    if (exercises.length === 0) {
      const inlinePattern = /([A-Z][A-Za-z\s\-']+?)(?:\s*[:(]\s*)(\d+)\s*sets?[,\s]+(?:of\s+)?(\d+(?:-\d+)?)\s*reps?/gi
      while ((match = inlinePattern.exec(text)) !== null) {
        const name = match[1].trim()
        if (name.length > 2 && !name.toLowerCase().startsWith('for ')) {
          exercises.push({
            exerciseName: name,
            sets: parseInt(match[2]) || 3,
            reps: match[3] || '10'
          })
        }
      }
    }

    // Format: "3x10 Bench Press" or "4x8-12 Squats"
    if (exercises.length === 0) {
      const prefixPattern = /(\d+)\s*[x×]\s*(\d+(?:-\d+)?)\s+([A-Z][A-Za-z\s\-']+)/gi
      while ((match = prefixPattern.exec(text)) !== null) {
        exercises.push({
          exerciseName: match[3].trim(),
          sets: parseInt(match[1]) || 3,
          reps: match[2] || '10'
        })
      }
    }
  }

  // Return if we have a day and at least one exercise
  if (dayOfWeek !== null && exercises.length > 0) {
    console.log('[parseWorkout] SUCCESS: Found', exercises.length, 'exercises for day', dayOfWeek)
    return {
      name: workoutName || dayNames[dayOfWeek] + ' Workout',
      dayOfWeek,
      exercises
    }
  }

  console.log('[parseWorkout] No valid workout found. dayOfWeek:', dayOfWeek, 'exercises:', exercises.length)
  return null
}

// Parse removal request from AI text response
function parseRemovalFromText(text) {
  if (!text) return null

  console.log('[parseRemoval] Checking text for removal pattern...')

  const dayMapping = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  }
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Pattern: "REMOVE:Monday" followed by exercise name(s) or "all"
  const removePattern = /REMOVE:\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today)/i
  const removeMatch = text.match(removePattern)

  if (!removeMatch) {
    console.log('[parseRemoval] No REMOVE: pattern found')
    return null
  }

  const dayStr = removeMatch[1].toLowerCase()
  let dayOfWeek
  if (dayStr === 'today') {
    dayOfWeek = new Date().getDay()
  } else {
    dayOfWeek = dayMapping[dayStr]
  }

  // Get exercise names after the REMOVE: line
  const afterRemove = text.substring(text.indexOf(removeMatch[0]) + removeMatch[0].length)
  const lines = afterRemove.split('\n').filter(l => l.trim())

  const exercisesToRemove = []
  let removeAll = false

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase()
    if (trimmed === 'all') {
      removeAll = true
      break
    }
    // Only capture exercise names (not empty lines or other text)
    if (trimmed && !trimmed.includes('confirm') && !trimmed.includes('please') && trimmed.length > 1) {
      exercisesToRemove.push(line.trim())
      break // Usually just one exercise per removal request
    }
  }

  console.log('[parseRemoval] Found removal request for day', dayOfWeek, 'removeAll:', removeAll, 'exercises:', exercisesToRemove)

  return {
    dayOfWeek,
    dayName: dayNames[dayOfWeek],
    removeAll,
    exercisesToRemove
  }
}

// Helper function to generate a slug-based exerciseId from exercise name
function generateExerciseId(exerciseName) {
  return 'ai-' + exerciseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
}

// Load exercise database for lookups
let exerciseDatabase = null

function loadExerciseDatabase() {
  if (exerciseDatabase) return exerciseDatabase

  try {
    const exercisesPath = process.env.NODE_ENV === 'production'
      ? path.join(__dirname, '../../data/exercises.json')
      : path.join(__dirname, '../../../../exercises-db/dist/exercises.json')

    exerciseDatabase = JSON.parse(fs.readFileSync(exercisesPath, 'utf-8'))
    console.log(`[AI] Loaded ${exerciseDatabase.length} exercises for lookup`)
    return exerciseDatabase
  } catch (e) {
    console.error('[AI] Failed to load exercise database:', e.message)
    return []
  }
}

// Helper function to score exercises for sorting (lower = better priority)
function getExercisePriority(exercise, searchTerm) {
  const name = exercise.name.toLowerCase()
  const search = searchTerm.toLowerCase()
  let score = 0

  // Heavily prioritize standard equipment types (barbell and dumbbell are most common)
  if (name.startsWith('barbell ')) score -= 100
  else if (name.startsWith('dumbbell ')) score -= 90
  else if (name.startsWith('cable ')) score -= 70
  else if (name.startsWith('machine ')) score -= 60

  // Penalize specialty/uncommon variations
  if (name.includes(' with chains')) score += 50
  if (name.includes(' with bands') || name.includes('- with bands')) score += 50
  if (name.includes('reverse band')) score += 40
  if (name.includes('smith machine')) score += 30
  if (name.includes('one arm') || name.includes('one-arm')) score += 20
  if (name.includes('close-grip') || name.includes('wide-grip')) score += 15
  if (name.includes('incline') || name.includes('decline')) score += 10

  // Bonus if the exercise name closely matches the search
  if (name === search) score -= 200
  if (name === `barbell ${search}`) score -= 150
  if (name === `dumbbell ${search}`) score -= 140

  // Add name length as a small tiebreaker (shorter names slightly preferred)
  score += name.length * 0.1

  return score
}

// Find all matching exercises from the database (for disambiguation)
function findAllExerciseMatches(searchName) {
  const exercises = loadExerciseDatabase()
  if (!exercises.length) return { matches: [], exact: false }

  const searchLower = searchName.toLowerCase().trim()
  const searchWords = searchLower.split(/\s+/).filter(w => w.length >= 2)

  // Extract core exercise name (remove equipment prefixes/suffixes for better matching)
  const coreWords = searchWords.filter(w =>
    !['dumbbell', 'barbell', 'cable', 'machine', 'band', 'kettlebell', 'ez', 'smith'].includes(w)
  )
  const coreSearch = coreWords.join(' ')

  // 1. Exact match (case-insensitive) - use it directly, no need to ask
  const exactMatch = exercises.find(e => e.name.toLowerCase() === searchLower)
  if (exactMatch) {
    console.log(`[AI] Exact match: "${searchName}" -> "${exactMatch.name}"`)
    return { matches: [exactMatch], exact: true }
  }

  // 2. Check if search includes equipment specifier - if so, find that specific variation
  const equipmentWords = ['dumbbell', 'barbell', 'cable', 'machine', 'band', 'kettlebell', 'ez', 'smith', 'lever', 'leverage']
  const hasEquipmentSpecifier = searchWords.some(w => equipmentWords.includes(w))

  if (hasEquipmentSpecifier) {
    // User/AI specified equipment, find exercises matching both equipment and core name
    const specificMatches = exercises.filter(e => {
      const nameLower = e.name.toLowerCase()
      return searchWords.every(word => nameLower.includes(word))
    })
    if (specificMatches.length > 0) {
      specificMatches.sort((a, b) => getExercisePriority(a, searchLower) - getExercisePriority(b, searchLower))
      // Check if there are OTHER variations with same core (e.g., other "shoulder press" types)
      const coreVariations = exercises.filter(e => {
        const nameLower = e.name.toLowerCase()
        return coreWords.every(word => nameLower.includes(word))
      })
      // If there are many core variations (dumbbell, barbell, cable, etc.), but user specified equipment,
      // only show the equipment-specific matches, NOT all core variations
      if (coreVariations.length > 3) {
        console.log(`[AI] Equipment specified ("${searchLower}"), using ${specificMatches.length} equipment-specific matches instead of ${coreVariations.length} core variations`)
        // Return only equipment-specific matches - user asked for a specific equipment type
        return { matches: specificMatches.slice(0, 6), exact: specificMatches.length === 1 }
      }
      console.log(`[AI] Equipment-specific match for "${searchName}": ${specificMatches[0].name}`)
      return { matches: specificMatches.slice(0, 6), exact: specificMatches.length === 1 }
    }
  }

  // 3. Search name is contained in exercise name (for generic searches without equipment)
  const containsMatches = exercises.filter(e =>
    e.name.toLowerCase().includes(searchLower)
  )
  if (containsMatches.length > 0) {
    containsMatches.sort((a, b) => getExercisePriority(a, searchLower) - getExercisePriority(b, searchLower))
    console.log(`[AI] Contains matches for "${searchName}": ${containsMatches.length} found, top: ${containsMatches.slice(0, 3).map(e => e.name).join(', ')}`)
    // For generic searches, show options if there are multiple
    return { matches: containsMatches.slice(0, 6), exact: containsMatches.length === 1 }
  }

  // 4. Core words match (for searches like "shoulder press" that should show dumbbell/barbell/cable options)
  if (coreSearch.length > 2 && !hasEquipmentSpecifier) {
    const coreMatches = exercises.filter(e => {
      const nameLower = e.name.toLowerCase()
      return coreWords.every(word => nameLower.includes(word))
    })
    if (coreMatches.length > 0) {
      coreMatches.sort((a, b) => getExercisePriority(a, searchLower) - getExercisePriority(b, searchLower))
      console.log(`[AI] Core word matches for "${searchName}" (core: "${coreSearch}"): ${coreMatches.length} found, top: ${coreMatches.slice(0, 3).map(e => e.name).join(', ')}`)
      // Always show options for generic searches with multiple matches
      return { matches: coreMatches.slice(0, 6), exact: coreMatches.length === 1 }
    }
  }

  // 5. All search words appear in exercise name
  const allWordsMatches = exercises.filter(e => {
    const nameLower = e.name.toLowerCase()
    return searchWords.every(word => nameLower.includes(word))
  })
  if (allWordsMatches.length > 0) {
    allWordsMatches.sort((a, b) => getExercisePriority(a, searchLower) - getExercisePriority(b, searchLower))
    console.log(`[AI] All-words matches for "${searchName}": ${allWordsMatches.length} found`)
    return { matches: allWordsMatches.slice(0, 6), exact: allWordsMatches.length === 1 }
  }

  // 6. Fuzzy match - find exercises where most words match
  const fuzzyMatches = []

  for (const exercise of exercises) {
    const nameLower = exercise.name.toLowerCase()
    const nameWords = nameLower.split(/\s+/)

    // Count matching words
    let matchingWords = 0
    for (const searchWord of searchWords) {
      if (searchWord.length < 3) continue
      if (nameWords.some(nw => nw.includes(searchWord) || searchWord.includes(nw))) {
        matchingWords++
      }
    }

    const score = matchingWords / Math.max(searchWords.filter(w => w.length >= 3).length, 1)
    if (score >= 0.5) {
      fuzzyMatches.push({ exercise, score })
    }
  }

  if (fuzzyMatches.length > 0) {
    fuzzyMatches.sort((a, b) => b.score - a.score || a.exercise.name.length - b.exercise.name.length)
    const matches = fuzzyMatches.slice(0, 6).map(m => m.exercise)
    console.log(`[AI] Fuzzy matches for "${searchName}": ${matches.length} found`)
    return { matches, exact: matches.length === 1 }
  }

  console.log(`[AI] No matches found for: "${searchName}"`)
  return { matches: [], exact: false }
}

// Find the best matching exercise from the database (for backwards compatibility)
function findExerciseMatch(searchName) {
  const { matches, exact } = findAllExerciseMatches(searchName)
  return matches[0] || null
}

// Resolve exercise name to actual exercise from database
// Returns { exerciseId, exerciseName, alternatives?, isAmbiguous }
function resolveExercise(exerciseName) {
  const { matches, exact } = findAllExerciseMatches(exerciseName)

  if (matches.length === 0) {
    // No matches - fall back to AI-generated ID
    return {
      exerciseId: generateExerciseId(exerciseName),
      exerciseName: exerciseName,
      isAmbiguous: false
    }
  }

  if (exact || matches.length === 1) {
    // Single match - use it
    return {
      exerciseId: matches[0].id,
      exerciseName: matches[0].name,
      isAmbiguous: false
    }
  }

  // Multiple matches - return alternatives for user to choose
  return {
    exerciseId: matches[0].id,
    exerciseName: matches[0].name,
    originalSearch: exerciseName,
    isAmbiguous: true,
    alternatives: matches.map(m => ({
      id: m.id,
      name: m.name,
      equipment: m.equipment,
      primaryMuscles: m.primaryMuscles?.slice(0, 2)
    }))
  }
}

// Check if any exercises in a workout are ambiguous and need clarification
function checkForAmbiguousExercises(exercises) {
  const resolvedExercises = []
  const ambiguousExercises = []

  for (const exercise of exercises) {
    const resolved = resolveExercise(exercise.exerciseName)
    resolvedExercises.push({ ...exercise, ...resolved })

    if (resolved.isAmbiguous) {
      ambiguousExercises.push({
        original: exercise.exerciseName,
        alternatives: resolved.alternatives
      })
    }
  }

  return { resolvedExercises, ambiguousExercises }
}

// Format ambiguous exercises into a user-friendly message
// Only shows ONE exercise at a time to avoid confusion
function formatAmbiguityMessage(ambiguousExercises, dayName) {
  // Only show the FIRST ambiguous exercise to avoid confusion
  const amb = ambiguousExercises[0]
  const remaining = ambiguousExercises.length - 1

  let message = `I found multiple exercises matching "${amb.original}". Which one did you mean?\n\n`

  amb.alternatives.forEach((alt, i) => {
    const equipment = alt.equipment ? ` (${alt.equipment})` : ''
    message += `${i + 1}. ${alt.name}${equipment}\n`
  })

  message += `\nJust reply with the number (1-${amb.alternatives.length}) or type the equipment type (e.g., "barbell", "dumbbell") to add it to ${dayName}.`

  if (remaining > 0) {
    message += `\n\n(${remaining} more exercise${remaining > 1 ? 's' : ''} to choose after this)`
  }

  return message
}

// Helper function to create a workout for the user
async function createWorkoutForUser(userId, args) {
  const { name, dayOfWeek, specificDate, exercises, targetMuscles } = args

  try {
    if (specificDate) {
      // Create a calendar workout for a specific date
      const date = new Date(specificDate)

      // Resolve exercise names to actual exercises from database
      const resolvedExercises = exercises.map(e => ({
        ...e,
        ...resolveExercise(e.exerciseName)
      }))

      const calendarWorkout = await prisma.calendarWorkout.create({
        data: {
          userId,
          date,
          name,
          exercises: {
            create: resolvedExercises.map((e, i) => ({
              exerciseId: e.exerciseId,
              exerciseName: e.exerciseName,
              sets: e.sets,
              reps: String(e.reps || '10'),
              order: i
            }))
          }
        },
        include: { exercises: true }
      })

      return {
        success: true,
        type: 'calendar',
        date: specificDate,
        workout: calendarWorkout,
        message: `Created "${name}" for ${date.toLocaleDateString()}`
      }
    } else if (dayOfWeek !== undefined) {
      // Create or update weekly schedule for that day
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

      // Resolve exercise names to actual exercises from database
      const resolvedExercises = exercises.map(e => ({
        ...e,
        ...resolveExercise(e.exerciseName)
      }))

      const schedule = await prisma.weeklySchedule.upsert({
        where: {
          userId_dayOfWeek: {
            userId,
            dayOfWeek
          }
        },
        update: {
          name,
          exercises: {
            deleteMany: {},
            create: resolvedExercises.map((e, i) => ({
              exerciseId: e.exerciseId,
              exerciseName: e.exerciseName,
              sets: e.sets,
              reps: String(e.reps || '10'),
              order: i
            }))
          }
        },
        create: {
          userId,
          dayOfWeek,
          name,
          exercises: {
            create: resolvedExercises.map((e, i) => ({
              exerciseId: e.exerciseId,
              exerciseName: e.exerciseName,
              sets: e.sets,
              reps: String(e.reps || '10'),
              order: i
            }))
          }
        },
        include: { exercises: true }
      })

      return {
        success: true,
        type: 'weekly',
        dayOfWeek,
        dayName: dayNames[dayOfWeek],
        workout: schedule,
        message: `Created "${name}" for ${dayNames[dayOfWeek]}s`
      }
    } else {
      return {
        success: false,
        message: 'No day or date specified for the workout'
      }
    }
  } catch (error) {
    console.error('Error creating workout:', error)
    return {
      success: false,
      message: 'Failed to create workout: ' + error.message
    }
  }
}

// Remove exercises from a user's schedule
async function removeExercisesFromSchedule(userId, args) {
  const { dayOfWeek, removeAll, exercisesToRemove } = args
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  try {
    // Get the current schedule for this day
    const schedule = await prisma.weeklySchedule.findFirst({
      where: {
        userId,
        dayOfWeek
      },
      include: { exercises: true }
    })

    if (!schedule) {
      return {
        success: false,
        message: `No workout found for ${dayNames[dayOfWeek]}`
      }
    }

    if (removeAll) {
      // Delete all exercises from this day
      await prisma.scheduledExercise.deleteMany({
        where: { weeklyScheduleId: schedule.id }
      })

      return {
        success: true,
        dayName: dayNames[dayOfWeek],
        removedCount: schedule.exercises.length,
        message: `Removed all ${schedule.exercises.length} exercises from ${dayNames[dayOfWeek]}`
      }
    }

    // Find and remove specific exercises
    const removedExercises = []
    for (const exerciseName of exercisesToRemove) {
      const normalizedName = exerciseName.toLowerCase().trim()

      // Find matching exercises (fuzzy match)
      const matchingExercises = schedule.exercises.filter(e => {
        const schedName = e.exerciseName.toLowerCase()
        return schedName === normalizedName ||
               schedName.includes(normalizedName) ||
               normalizedName.includes(schedName)
      })

      for (const exercise of matchingExercises) {
        await prisma.scheduledExercise.delete({
          where: { id: exercise.id }
        })
        removedExercises.push(exercise.exerciseName)
      }
    }

    if (removedExercises.length === 0) {
      return {
        success: false,
        message: `Could not find "${exercisesToRemove.join(', ')}" in ${dayNames[dayOfWeek]}'s workout`
      }
    }

    return {
      success: true,
      dayName: dayNames[dayOfWeek],
      removedExercises,
      removedCount: removedExercises.length,
      message: `Removed ${removedExercises.join(', ')} from ${dayNames[dayOfWeek]}`
    }
  } catch (error) {
    console.error('Error removing exercises:', error)
    return {
      success: false,
      message: 'Failed to remove exercises: ' + error.message
    }
  }
}

// POST /api/ai/suggest-workout - Get AI-generated workout suggestion
router.post('/suggest-workout', async (req, res) => {
  try {
    const { muscleGroups, duration, equipment, fitnessLevel } = req.body

    // Get AI configuration
    const config = await getUserAIConfig(req.user.id)

    if (!config.provider) {
      return res.status(400).json({ message: 'AI is not configured' })
    }

    // Get user context to auto-fill equipment if not provided
    const userContext = await getUserContext(req.user.id)
    const userEquipment = equipment?.length > 0
      ? equipment
      : userContext?.equipment?.available?.length > 0
        ? userContext.equipment.available
        : ['bodyweight']

    // Determine fitness level from user stats if not provided
    let level = fitnessLevel
    if (!level && userContext?.stats?.totalWorkouts) {
      if (userContext.stats.totalWorkouts < 20) level = 'beginner'
      else if (userContext.stats.totalWorkouts < 100) level = 'intermediate'
      else level = 'advanced'
    }

    const prompt = `Create a workout plan with the following criteria:
- Target muscles: ${muscleGroups?.join(', ') || 'full body'}
- Duration: ${duration || 45} minutes
- Available equipment: ${userEquipment.join(', ')}
- Fitness level: ${level || 'intermediate'}

Return a JSON object with this structure:
{
  "name": "Workout name",
  "exercises": [
    {
      "name": "Exercise name",
      "sets": 3,
      "reps": "10-12",
      "restSeconds": 60,
      "notes": "Brief form tip"
    }
  ],
  "warmup": "2-3 minute warmup description",
  "cooldown": "2-3 minute cooldown description"
}

Only return the JSON, no other text.`

    const messages = [
      { role: 'system', content: 'You are a professional fitness trainer. Return only valid JSON.' },
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
      // Try to parse the JSON response
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

// POST /api/ai/suggest-set - Get set suggestion based on history and training style
// By default uses rule-based logic. Set useAi=true to use AI (if available)
router.post('/suggest-set', async (req, res) => {
  try {
    const { exerciseName, lastSets, trainingStyle, pr, setNumber, difficultyFeedback, useAi } = req.body

    // Always start with rule-based suggestion
    const suggestion = calculateSetSuggestion(lastSets, trainingStyle, setNumber, difficultyFeedback)

    // Only use AI if explicitly requested AND provider is available
    if (!useAi) {
      return res.json({ suggestion, source: 'rules' })
    }

    // Get AI configuration
    const config = await getUserAIConfig(req.user.id)

    if (!config.provider) {
      // No AI configured - return rule-based
      return res.json({ suggestion, source: 'rules' })
    }

    // Build prompt for AI - add variety with different tip categories
    const tipCategories = [
      'form and technique',
      'breathing patterns',
      'mind-muscle connection',
      'tempo and control',
      'progressive overload strategy',
      'injury prevention',
      'muscle activation cues',
      'rest and recovery',
      'mental focus tips'
    ]
    const randomCategory = tipCategories[Math.floor(Math.random() * tipCategories.length)]

    const prompt = `You are a fitness coach. Suggest the next set for this exercise.

Exercise: ${exerciseName}
Training Style: ${trainingStyle || 'general'}
Current Set Number: ${setNumber}
${pr ? `Personal Record: ${pr.weight}lbs × ${pr.reps} reps` : ''}
${lastSets?.length > 0 ? `Previous sets this session: ${lastSets.map(s => `${s.weight || 0}lbs × ${s.reps} reps`).join(', ')}` : ''}
${difficultyFeedback ? `Last difficulty rating: ${difficultyFeedback}/5 (1=too easy, 5=too hard)` : ''}

Based on the training style and history, suggest weight and reps for the next set.
For ${trainingStyle === 'POWERLIFTING' ? 'powerlifting, focus on lower reps (1-5) with heavier weight' :
      trainingStyle === 'BODYBUILDING' ? 'bodybuilding, focus on moderate reps (8-12) for hypertrophy' :
      trainingStyle === 'STRENGTH' ? 'strength training, focus on 3-6 reps with progressive overload' :
      trainingStyle === 'ENDURANCE' ? 'endurance, focus on higher reps (15-20+) with lighter weight' :
      'general fitness, balance reps (8-12) and progressive overload'}.

Provide a UNIQUE and SPECIFIC tip about "${randomCategory}" for ${exerciseName}. Make it actionable and practical. Don't repeat generic advice.

Return JSON only: { "weight": number or null, "reps": number or null, "tip": "string" }`

    const messages = [
      { role: 'system', content: 'You are an expert fitness coach. Provide unique, specific advice. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ]

    const response = await callAI(config, messages, {
      max_tokens: 250,
      temperature: 0.9  // Higher temperature for more varied responses
    })

    if (!response.ok) {
      // Fallback to rule-based
      const suggestion = calculateSetSuggestion(lastSets, trainingStyle, setNumber, difficultyFeedback)
      return res.json({ suggestion, source: 'rules' })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    try {
      const suggestion = JSON.parse(content.replace(/```json\n?|```\n?/g, '').trim())
      res.json({ suggestion, source: 'ai', provider: config.provider })
    } catch (e) {
      const suggestion = calculateSetSuggestion(lastSets, trainingStyle, setNumber, difficultyFeedback)
      res.json({ suggestion, source: 'rules' })
    }
  } catch (error) {
    console.error('Error suggesting set:', error)
    const { lastSets, trainingStyle, setNumber, difficultyFeedback } = req.body
    const suggestion = calculateSetSuggestion(lastSets, trainingStyle, setNumber, difficultyFeedback)
    res.json({ suggestion, source: 'rules' })
  }
})

// Rule-based set calculation (does NOT call AI - just applies logic)
function calculateSetSuggestion(lastSets, trainingStyle, setNumber, difficultyFeedback) {
  const style = trainingStyle || 'GENERAL'
  let weight = null // null means "no suggestion" - user enters their own
  let reps = null
  let tip = ''
  let reason = ''

  // Target rep ranges by style
  const repRanges = {
    POWERLIFTING: { min: 1, max: 5, default: 3, focus: 'heavy weight, low reps for max strength' },
    STRENGTH: { min: 3, max: 6, default: 5, focus: 'strength building with moderate volume' },
    BODYBUILDING: { min: 8, max: 12, default: 10, focus: 'muscle growth (hypertrophy) with controlled tempo' },
    ENDURANCE: { min: 15, max: 25, default: 20, focus: 'muscular endurance with lighter weight' },
    ATHLETIC: { min: 6, max: 10, default: 8, focus: 'power and athleticism' },
    GENERAL: { min: 8, max: 12, default: 10, focus: 'general fitness and balanced training' }
  }

  const range = repRanges[style] || repRanges.GENERAL

  if (lastSets && lastSets.length > 0) {
    // We have history from THIS session - suggest based on last set
    const lastSet = lastSets[lastSets.length - 1]
    weight = lastSet.weight || null
    reps = lastSet.reps || range.default

    // Adjust based on difficulty feedback from last set
    if (difficultyFeedback) {
      if (difficultyFeedback <= 2) {
        // Too easy - increase weight or reps
        if (style === 'POWERLIFTING' || style === 'STRENGTH') {
          if (weight && weight > 0) {
            const oldWeight = weight
            weight = Math.round((weight * 1.05) / 2.5) * 2.5 // Increase 5%, round to 2.5
            tip = 'Last set felt easy - adding weight.'
            reason = `+5% weight (${oldWeight} → ${weight}lbs) because you rated it ${difficultyFeedback}/5 (easy)`
          } else {
            tip = 'Last set felt easy - try adding some weight.'
            reason = `You rated ${difficultyFeedback}/5 - consider increasing resistance`
          }
        } else {
          const oldReps = reps
          reps = Math.min(reps + 2, range.max)
          tip = 'Last set felt easy - adding reps.'
          reason = `+2 reps (${oldReps} → ${reps}) because you rated it ${difficultyFeedback}/5 (easy)`
        }
      } else if (difficultyFeedback >= 4) {
        // Too hard - decrease slightly
        if (weight && weight > 0) {
          const oldWeight = weight
          weight = Math.round((weight * 0.95) / 2.5) * 2.5
          tip = 'Last set was tough - reducing weight for better form.'
          reason = `-5% weight (${oldWeight} → ${weight}lbs) because you rated it ${difficultyFeedback}/5 (hard)`
        } else if (reps) {
          const oldReps = reps
          reps = Math.max(reps - 2, range.min)
          tip = 'Last set was tough - fewer reps for quality.'
          reason = `-2 reps (${oldReps} → ${reps}) because you rated it ${difficultyFeedback}/5 (hard)`
        }
      } else {
        // Difficulty 3 = perfect, keep same
        tip = 'Good difficulty - keeping the same.'
        reason = `No change - you rated ${difficultyFeedback}/5 which is ideal`
      }
    } else {
      // No difficulty feedback - provide style-specific guidance
      if (style === 'BODYBUILDING') {
        // For bodybuilding, suggest progressive overload strategies
        const setNum = setNumber || lastSets.length + 1
        if (setNum <= 2) {
          // Early sets: suggest slight weight increase or same weight with push for more reps
          if (weight && reps < range.max) {
            reps = Math.min(reps + 1, range.max)
            tip = `Push for ${reps} reps this set - progressive overload builds muscle.`
            reason = `Set ${setNum}: aiming for +1 rep to drive hypertrophy`
          } else {
            tip = 'Focus on controlled tempo and mind-muscle connection.'
            reason = `Set ${setNum}: maintain intensity with good form`
          }
        } else if (setNum === 3) {
          // Set 3: this is often the "money set" for hypertrophy
          tip = 'This is your working set - push close to failure with good form.'
          reason = `Set ${setNum}: maximize muscle tension for growth`
        } else {
          // Later sets (4+): fatigue sets in, maintain or slight reduction
          if (reps > range.min) {
            tip = `Maintain weight, aim for ${reps} reps. Drop to ${reps - 1} if needed.`
            reason = `Set ${setNum}: accumulate volume even as fatigue builds`
          } else {
            tip = 'Maintain intensity - every rep counts for muscle growth.'
            reason = `Set ${setNum}: finishing strong`
          }
        }
      } else if (style === 'POWERLIFTING' || style === 'STRENGTH') {
        // For strength/powerlifting, rest well and maintain heavy weight
        const setNum = setNumber || lastSets.length + 1
        if (setNum === 1) {
          tip = 'First working set - focus on technique and bar speed.'
          reason = `Set ${setNum}: establish your groove for the heavy sets`
        } else if (setNum <= 3) {
          tip = 'Rest fully (3-5 min) and maintain your working weight.'
          reason = `Set ${setNum}: quality reps at heavy weight matter more than speed`
        } else {
          // Later sets - fatigue management
          tip = 'Maintain weight if form is solid. Drop 5-10% if bar speed slows.'
          reason = `Set ${setNum}: prioritize technique over grinding reps`
        }
      } else if (style === 'ENDURANCE') {
        // For endurance, focus on maintaining pace and building stamina
        const setNum = setNumber || lastSets.length + 1
        if (setNum === 1) {
          tip = 'Start at a sustainable pace - save energy for later sets.'
          reason = `Set ${setNum}: building endurance requires consistent effort across all sets`
        } else if (reps < range.max) {
          // Push for more reps within the endurance range
          reps = Math.min(reps + 2, range.max)
          tip = `Try for ${reps} reps - build your stamina progressively.`
          reason = `Set ${setNum}: increasing reps builds muscular endurance`
        } else {
          tip = 'Keep the pace steady. Focus on breathing and rhythm.'
          reason = `Set ${setNum}: maintain high rep output for endurance adaptation`
        }
      } else if (style === 'ATHLETIC') {
        // For athletic training, focus on power and explosiveness
        const setNum = setNumber || lastSets.length + 1
        if (setNum === 1) {
          tip = 'Focus on explosive movement - speed matters more than weight.'
          reason = `Set ${setNum}: prime your nervous system for power output`
        } else if (setNum <= 3) {
          tip = 'Rest 2-3 min between sets. Maintain explosiveness.'
          reason = `Set ${setNum}: athletic training requires quality power output each set`
        } else {
          // Later sets - maintain quality
          if (reps > range.min) {
            tip = `Keep it explosive. Drop to ${reps - 1} reps if power fades.`
            reason = `Set ${setNum}: sloppy reps don't build athletic power`
          } else {
            tip = 'Maintain explosive intent on every rep.'
            reason = `Set ${setNum}: finish with quality movement`
          }
        }
      } else {
        // GENERAL - balanced guidance for general fitness
        const setNum = setNumber || lastSets.length + 1
        if (setNum === 1) {
          tip = 'First set - find a challenging but manageable weight.'
          reason = `Set ${setNum}: establish your working weight for today`
        } else if (setNum <= 3) {
          tip = 'Maintain your weight. Rate difficulty to get personalized adjustments.'
          reason = `Set ${setNum}: consistent effort builds fitness`
        } else {
          tip = 'Push through! Final sets build mental and physical toughness.'
          reason = `Set ${setNum}: finishing strong matters`
        }
      }
    }
  } else {
    // NO history - don't suggest weight, only give rep range guidance
    weight = null // No weight suggestion without history!
    reps = null   // Let user enter their own
    tip = `Aim for ${range.min}-${range.max} reps per set.`
    reason = `${style} training: ${range.focus}`
  }

  return { weight, reps, tip, reason }
}

// POST /api/ai/ollama-proxy/tags - Proxy request to Ollama to get available models (avoids CORS)
router.post('/ollama-proxy/tags', async (req, res, next) => {
  try {
    const { endpoint, apiKey } = req.body

    if (!endpoint) {
      return res.status(400).json({ message: 'Endpoint is required' })
    }

    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(`${endpoint}/api/tags`, { headers })

    if (!response.ok) {
      return res.status(response.status).json({
        message: `Ollama server returned ${response.status}`,
        error: await response.text()
      })
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    res.status(500).json({
      message: 'Failed to connect to Ollama server',
      error: error.message
    })
  }
})

export default router
