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

User: "Add bench press to Monday"
Response: Here's your chest exercise for Monday!
WORKOUT:Monday
Bench Press|3|8-10

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
Bench Press|4|8-10
Overhead Press|3|8-10
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

// Find the best matching exercise from the database
function findExerciseMatch(searchName) {
  const exercises = loadExerciseDatabase()
  if (!exercises.length) return null

  const searchLower = searchName.toLowerCase().trim()
  const searchWords = searchLower.split(/\s+/)

  // 1. Exact match (case-insensitive)
  const exactMatch = exercises.find(e => e.name.toLowerCase() === searchLower)
  if (exactMatch) {
    console.log(`[AI] Exact match: "${searchName}" -> "${exactMatch.name}"`)
    return exactMatch
  }

  // 2. Search name is contained in exercise name (e.g., "bench press" matches "Barbell Bench Press")
  const containsMatches = exercises.filter(e =>
    e.name.toLowerCase().includes(searchLower)
  )
  if (containsMatches.length === 1) {
    console.log(`[AI] Contains match: "${searchName}" -> "${containsMatches[0].name}"`)
    return containsMatches[0]
  }

  // 3. All search words appear in exercise name
  const allWordsMatches = exercises.filter(e => {
    const nameLower = e.name.toLowerCase()
    return searchWords.every(word => nameLower.includes(word))
  })
  if (allWordsMatches.length > 0) {
    // Prefer shorter names (more specific matches)
    allWordsMatches.sort((a, b) => a.name.length - b.name.length)
    console.log(`[AI] All-words match: "${searchName}" -> "${allWordsMatches[0].name}"`)
    return allWordsMatches[0]
  }

  // 4. Fuzzy match - most words match
  let bestMatch = null
  let bestScore = 0

  for (const exercise of exercises) {
    const nameLower = exercise.name.toLowerCase()
    const nameWords = nameLower.split(/\s+/)

    // Count matching words
    let matchingWords = 0
    for (const searchWord of searchWords) {
      if (searchWord.length < 3) continue // Skip short words like "a", "to"
      if (nameWords.some(nw => nw.includes(searchWord) || searchWord.includes(nw))) {
        matchingWords++
      }
    }

    // Score based on matching words and name similarity
    const score = matchingWords / Math.max(searchWords.length, 1)

    if (score > bestScore && score >= 0.5) {
      bestScore = score
      bestMatch = exercise
    }
  }

  if (bestMatch) {
    console.log(`[AI] Fuzzy match (${(bestScore * 100).toFixed(0)}%): "${searchName}" -> "${bestMatch.name}"`)
    return bestMatch
  }

  console.log(`[AI] No match found for: "${searchName}"`)
  return null
}

// Resolve exercise name to actual exercise from database
function resolveExercise(exerciseName) {
  const match = findExerciseMatch(exerciseName)
  if (match) {
    return {
      exerciseId: match.id,
      exerciseName: match.name
    }
  }
  // Fall back to AI-generated ID if no match
  return {
    exerciseId: generateExerciseId(exerciseName),
    exerciseName: exerciseName
  }
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
      // No difficulty feedback - suggest same as last set
      tip = 'Match your previous set.'
      reason = `Repeating last set${weight ? ` (${weight}lbs × ${reps})` : ` (${reps} reps)`} - rate difficulty to get adjustments`
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
