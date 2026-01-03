import express from 'express'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

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

  let apiKey = null
  let source = null

  if (user?.openaiApiKey) {
    apiKey = user.openaiApiKey
    source = 'user'
  } else if (appSettings?.globalOpenaiEnabled && appSettings?.globalOpenaiApiKey) {
    apiKey = appSettings.globalOpenaiApiKey
    source = 'global'
  }

  const model = userSettings?.aiModel || 'gpt-4o-mini'

  return { apiKey, source, model }
}

// GET /api/ai/status - Check if AI is available for the user
router.get('/status', async (req, res) => {
  try {
    const config = await getUserAIConfig(req.user.id)

    if (config.apiKey) {
      return res.json({ available: true, source: config.source })
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

// POST /api/ai/chat - Send a message to ChatGPT
router.post('/chat', async (req, res) => {
  try {
    const { message, context, history = [] } = req.body

    if (!message) {
      return res.status(400).json({ message: 'Message is required' })
    }

    // Get AI configuration
    const config = await getUserAIConfig(req.user.id)

    if (!config.apiKey) {
      return res.status(400).json({
        message: 'AI is not configured. Please add your OpenAI API key in Settings, or ask your admin to enable the global key.'
      })
    }

    // Build system prompt based on context
    let systemPrompt = `You are a knowledgeable and encouraging fitness assistant for the HomeFit app.
You help users with workout planning, exercise technique, and general fitness questions.
Keep responses concise but helpful - aim for 2-4 sentences unless more detail is needed.
Be encouraging and supportive. Use simple, clear language.
When suggesting exercises, mention the target muscles.
If asked about medical conditions or injuries, recommend consulting a healthcare professional.

IMPORTANT: When the user asks you to CREATE, ADD, SCHEDULE, or MAKE a workout for a specific day or date, you MUST use the create_workout function to actually add it to their schedule. Examples:
- "Make me a chest workout for Monday" -> Use create_workout with dayOfWeek=1
- "Create a leg day for tomorrow" -> Use create_workout with the appropriate date
- "Add a back workout to my schedule on Wednesday" -> Use create_workout with dayOfWeek=3
- "Schedule a full body workout for July 15th" -> Use create_workout with specificDate

Today's date is ${new Date().toISOString().split('T')[0]}.`

    if (context === 'schedule') {
      systemPrompt += `\n\nThe user is currently on the Schedule page, planning their weekly workouts.
Help them create balanced training splits and organize their week effectively.
Consider rest days and muscle group recovery when making suggestions.
You can create workouts directly on their schedule using the create_workout function.`
    } else if (context === 'today') {
      systemPrompt += `\n\nThe user is on their Today page, looking at their workout for today.
Help them with exercise form, warm-up suggestions, and motivation.
Keep responses action-oriented and motivating.`
    }

    // Build messages array for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ]

    // Call OpenAI API with tools
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        tools: AI_TOOLS,
        tool_choice: 'auto',
        max_tokens: 1000,
        temperature: 0.7
      })
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}))
      console.error('OpenAI API error:', errorData)

      if (openaiResponse.status === 401) {
        return res.status(400).json({ message: 'Invalid API key. Please check your OpenAI API key in settings.' })
      }
      if (openaiResponse.status === 429) {
        return res.status(429).json({ message: 'Rate limit exceeded. Please wait a moment and try again.' })
      }

      return res.status(500).json({ message: 'Failed to get AI response. Please try again.' })
    }

    const data = await openaiResponse.json()
    const choice = data.choices?.[0]

    // Check if the AI wants to call a function
    if (choice?.message?.tool_calls?.length > 0) {
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

          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
              model: config.model,
              messages: followUpMessages,
              max_tokens: 500,
              temperature: 0.7
            })
          })

          if (followUpResponse.ok) {
            const followUpData = await followUpResponse.json()
            const assistantMessage = followUpData.choices?.[0]?.message?.content ||
              `I've created the "${args.name}" workout for you!`

            return res.json({
              message: assistantMessage,
              source: config.source,
              workoutCreated: workoutResult.success ? workoutResult : null
            })
          }
        } catch (error) {
          console.error('Error executing create_workout:', error)
        }
      }
    }

    const assistantMessage = choice?.message?.content || 'Sorry, I couldn\'t generate a response.'

    res.json({ message: assistantMessage, source: config.source })
  } catch (error) {
    console.error('Error in AI chat:', error)
    res.status(500).json({ message: 'An error occurred. Please try again.' })
  }
})

// Helper function to create a workout for the user
async function createWorkoutForUser(userId, args) {
  const { name, dayOfWeek, specificDate, exercises, targetMuscles } = args

  try {
    if (specificDate) {
      // Create a calendar workout for a specific date
      const date = new Date(specificDate)

      const calendarWorkout = await prisma.calendarWorkout.create({
        data: {
          userId,
          date,
          name,
          exercises: {
            create: exercises.map((e, i) => ({
              exerciseId: null,
              exerciseName: e.exerciseName,
              sets: e.sets,
              reps: parseInt(e.reps) || 10,
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
            create: exercises.map((e, i) => ({
              exerciseId: null,
              exerciseName: e.exerciseName,
              sets: e.sets,
              reps: parseInt(e.reps) || 10,
              order: i
            }))
          }
        },
        create: {
          userId,
          dayOfWeek,
          name,
          exercises: {
            create: exercises.map((e, i) => ({
              exerciseId: null,
              exerciseName: e.exerciseName,
              sets: e.sets,
              reps: parseInt(e.reps) || 10,
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

    if (!config.apiKey) {
      return res.status(400).json({ message: 'AI is not configured' })
    }

    const prompt = `Create a workout plan with the following criteria:
- Target muscles: ${muscleGroups?.join(', ') || 'full body'}
- Duration: ${duration || 45} minutes
- Available equipment: ${equipment?.join(', ') || 'bodyweight only'}
- Fitness level: ${fitnessLevel || 'intermediate'}

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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'You are a professional fitness trainer. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      return res.status(500).json({ message: 'Failed to generate workout' })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    try {
      // Try to parse the JSON response
      const workout = JSON.parse(content.replace(/```json\n?|```\n?/g, '').trim())
      res.json({ workout })
    } catch (e) {
      res.status(500).json({ message: 'Failed to parse workout suggestion' })
    }
  } catch (error) {
    console.error('Error suggesting workout:', error)
    res.status(500).json({ message: 'An error occurred' })
  }
})

// POST /api/ai/suggest-set - Get set suggestion based on history and training style
// By default uses rule-based logic. Set useAi=true to use ChatGPT (if available)
router.post('/suggest-set', async (req, res) => {
  try {
    const { exerciseName, lastSets, trainingStyle, pr, setNumber, difficultyFeedback, useAi } = req.body

    // Always start with rule-based suggestion
    const suggestion = calculateSetSuggestion(lastSets, trainingStyle, setNumber, difficultyFeedback)

    // Only use AI if explicitly requested AND API key is available
    if (!useAi) {
      return res.json({ suggestion, source: 'rules' })
    }

    // Get AI configuration
    const config = await getUserAIConfig(req.user.id)

    if (!config.apiKey) {
      // No API key - return rule-based
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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'You are an expert fitness coach. Provide unique, specific advice. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 250,
        temperature: 0.9  // Higher temperature for more varied responses
      })
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
      res.json({ suggestion, source: 'ai' })
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

export default router
