import express from 'express'
import prisma from '../lib/prisma.js'
import fatSecretService from '../services/fatsecret.js'
import achievementService from '../services/achievements.js'

const router = express.Router()

// ===========================================
// FatSecret API Endpoints
// ===========================================

// GET /api/nutrition/search/foods - Search FatSecret foods
router.get('/search/foods', async (req, res, next) => {
  try {
    const { q, page = 0, limit = 20 } = req.query

    if (!q) {
      return res.status(400).json({ message: 'Search query required' })
    }

    const results = await fatSecretService.searchFoods(q, parseInt(page), parseInt(limit))
    res.json(results)
  } catch (error) {
    if (error.message.includes('not configured')) {
      return res.status(503).json({ message: 'Food search service not configured' })
    }
    if (error.message.includes('authentication') || error.message.includes('IP whitelist')) {
      return res.status(503).json({ message: error.message })
    }
    next(error)
  }
})

// GET /api/nutrition/search/recipes - Search FatSecret recipes
router.get('/search/recipes', async (req, res, next) => {
  try {
    const {
      q,
      page = 0,
      limit = 20,
      recipeTypes,
      mustHaveImages,
      caloriesFrom,
      caloriesTo,
      cookingTimeFrom,
      cookingTimeTo
    } = req.query

    if (!q) {
      return res.status(400).json({ message: 'Search query required' })
    }

    const filters = {}
    if (recipeTypes) filters.recipeTypes = recipeTypes
    if (mustHaveImages === 'true') filters.mustHaveImages = true
    if (caloriesFrom) filters.caloriesFrom = parseInt(caloriesFrom)
    if (caloriesTo) filters.caloriesTo = parseInt(caloriesTo)
    if (cookingTimeFrom) filters.cookingTimeFrom = parseInt(cookingTimeFrom)
    if (cookingTimeTo) filters.cookingTimeTo = parseInt(cookingTimeTo)

    const results = await fatSecretService.searchRecipes(q, parseInt(page), parseInt(limit), filters)
    res.json(results)
  } catch (error) {
    if (error.message.includes('not configured')) {
      return res.status(503).json({ message: 'Recipe search service not configured' })
    }
    next(error)
  }
})

// GET /api/nutrition/foods/:id - Get FatSecret food details
router.get('/foods/:id', async (req, res, next) => {
  try {
    const food = await fatSecretService.getFood(req.params.id)
    if (!food) {
      return res.status(404).json({ message: 'Food not found' })
    }
    res.json(food)
  } catch (error) {
    next(error)
  }
})

// GET /api/nutrition/fatsecret-recipes/:id - Get FatSecret recipe details
router.get('/fatsecret-recipes/:id', async (req, res, next) => {
  try {
    const recipe = await fatSecretService.getRecipe(req.params.id)
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' })
    }
    res.json(recipe)
  } catch (error) {
    next(error)
  }
})

// GET /api/nutrition/autocomplete - Food autocomplete
router.get('/autocomplete', async (req, res, next) => {
  try {
    const { q, limit = 10 } = req.query

    if (!q || q.length < 2) {
      return res.json([])
    }

    const suggestions = await fatSecretService.autocomplete(q, parseInt(limit))
    res.json(suggestions)
  } catch (error) {
    next(error)
  }
})

// ===========================================
// User Recipes CRUD
// ===========================================

// GET /api/nutrition/recipes - Get user's recipes
router.get('/recipes', async (req, res, next) => {
  try {
    const { search, mealType, difficulty, page = 0, limit = 20 } = req.query

    const where = {
      userId: req.user.id
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (mealType) {
      where.mealType = { has: mealType }
    }

    if (difficulty) {
      where.difficulty = difficulty
    }

    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        include: {
          ingredients: { orderBy: { order: 'asc' } },
          _count: { select: { savedBy: true } }
        },
        orderBy: { updatedAt: 'desc' },
        skip: parseInt(page) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.recipe.count({ where })
    ])

    res.json({ recipes, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (error) {
    next(error)
  }
})

// GET /api/nutrition/recipes/discover - Discover public recipes from friends
router.get('/recipes/discover', async (req, res, next) => {
  try {
    const { search, page = 0, limit = 20 } = req.query

    // Get friend IDs
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: req.user.id, status: 'ACCEPTED' },
          { friendId: req.user.id, status: 'ACCEPTED' }
        ]
      }
    })

    const friendIds = friendships.map(f =>
      f.userId === req.user.id ? f.friendId : f.userId
    )

    const where = {
      OR: [
        { isPublic: true },
        { userId: { in: friendIds } }
      ],
      userId: { not: req.user.id } // Exclude own recipes
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        }
      ]
    }

    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, username: true } },
          ingredients: { orderBy: { order: 'asc' } },
          _count: { select: { savedBy: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(page) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.recipe.count({ where })
    ])

    res.json({ recipes, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (error) {
    next(error)
  }
})

// GET /api/nutrition/recipes/saved - Get user's saved recipes
router.get('/recipes/saved', async (req, res, next) => {
  try {
    const saved = await prisma.savedRecipe.findMany({
      where: { userId: req.user.id },
      include: {
        recipe: {
          include: {
            user: { select: { id: true, name: true, username: true } },
            ingredients: { orderBy: { order: 'asc' } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ recipes: saved.map(s => ({ ...s.recipe, savedAt: s.createdAt, savedNotes: s.notes })) })
  } catch (error) {
    next(error)
  }
})

// GET /api/nutrition/recipes/:id - Get single recipe
router.get('/recipes/:id', async (req, res, next) => {
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, username: true } },
        ingredients: { orderBy: { order: 'asc' } },
        _count: { select: { savedBy: true } }
      }
    })

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' })
    }

    // Check access
    if (recipe.userId !== req.user.id && !recipe.isPublic) {
      // Check if shared with user
      const share = await prisma.recipeShare.findFirst({
        where: {
          recipeId: recipe.id,
          sharedWithId: req.user.id,
          status: 'ACCEPTED'
        }
      })

      if (!share) {
        // Check if friends
        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userId: req.user.id, friendId: recipe.userId, status: 'ACCEPTED' },
              { userId: recipe.userId, friendId: req.user.id, status: 'ACCEPTED' }
            ]
          }
        })

        if (!friendship) {
          return res.status(403).json({ message: 'Access denied' })
        }
      }
    }

    // Check if saved by user
    const savedByUser = await prisma.savedRecipe.findUnique({
      where: {
        userId_recipeId: {
          userId: req.user.id,
          recipeId: recipe.id
        }
      }
    })

    res.json({ ...recipe, isSaved: !!savedByUser })
  } catch (error) {
    next(error)
  }
})

// POST /api/nutrition/recipes - Create recipe
router.post('/recipes', async (req, res, next) => {
  try {
    const {
      name,
      description,
      instructions,
      imageUrl,
      servings,
      prepTime,
      cookTime,
      difficulty,
      cuisineType,
      mealType,
      tags,
      isPublic,
      ingredients,
      // Nutrition - can be auto-calculated or manual
      calories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      sodium,
      fatSecretId,
      sourceUrl
    } = req.body

    const recipe = await prisma.recipe.create({
      data: {
        userId: req.user.id,
        name,
        description,
        instructions,
        imageUrl,
        servings: servings || 1,
        prepTime,
        cookTime,
        difficulty: difficulty || 'MEDIUM',
        cuisineType,
        mealType: mealType || [],
        tags: tags || [],
        isPublic: isPublic || false,
        calories,
        protein,
        carbs,
        fat,
        fiber,
        sugar,
        sodium,
        fatSecretId,
        sourceUrl,
        ingredients: {
          create: (ingredients || []).map((ing, index) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            notes: ing.notes,
            fatSecretFoodId: ing.fatSecretFoodId,
            calories: ing.calories,
            protein: ing.protein,
            carbs: ing.carbs,
            fat: ing.fat,
            order: index
          }))
        }
      },
      include: {
        ingredients: { orderBy: { order: 'asc' } }
      }
    })

    res.status(201).json(recipe)
  } catch (error) {
    next(error)
  }
})

// PUT /api/nutrition/recipes/:id - Update recipe
router.put('/recipes/:id', async (req, res, next) => {
  try {
    const existing = await prisma.recipe.findUnique({
      where: { id: req.params.id }
    })

    if (!existing) {
      return res.status(404).json({ message: 'Recipe not found' })
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    const {
      name,
      description,
      instructions,
      imageUrl,
      servings,
      prepTime,
      cookTime,
      difficulty,
      cuisineType,
      mealType,
      tags,
      isPublic,
      ingredients,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      sodium
    } = req.body

    // Delete existing ingredients and recreate
    await prisma.recipeIngredient.deleteMany({
      where: { recipeId: req.params.id }
    })

    const recipe = await prisma.recipe.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        instructions,
        imageUrl,
        servings,
        prepTime,
        cookTime,
        difficulty,
        cuisineType,
        mealType,
        tags,
        isPublic,
        calories,
        protein,
        carbs,
        fat,
        fiber,
        sugar,
        sodium,
        ingredients: {
          create: (ingredients || []).map((ing, index) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            notes: ing.notes,
            fatSecretFoodId: ing.fatSecretFoodId,
            calories: ing.calories,
            protein: ing.protein,
            carbs: ing.carbs,
            fat: ing.fat,
            order: index
          }))
        }
      },
      include: {
        ingredients: { orderBy: { order: 'asc' } }
      }
    })

    res.json(recipe)
  } catch (error) {
    next(error)
  }
})

// DELETE /api/nutrition/recipes/:id - Delete recipe
router.delete('/recipes/:id', async (req, res, next) => {
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: req.params.id }
    })

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' })
    }

    if (recipe.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    await prisma.recipe.delete({
      where: { id: req.params.id }
    })

    res.json({ message: 'Recipe deleted' })
  } catch (error) {
    next(error)
  }
})

// POST /api/nutrition/recipes/:id/save - Save a community recipe (copies to user's collection)
router.post('/recipes/:id/save', async (req, res, next) => {
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true } },
        ingredients: { orderBy: { order: 'asc' } }
      }
    })

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' })
    }

    // Don't allow saving your own recipe
    if (recipe.userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot save your own recipe' })
    }

    // Check if user already has this recipe (based on original recipe ID or name match)
    const existingCopy = await prisma.recipe.findFirst({
      where: {
        userId: req.user.id,
        OR: [
          { name: recipe.name, originalAuthorId: recipe.userId },
          { name: recipe.name, originalAuthorId: recipe.originalAuthorId || recipe.userId }
        ]
      }
    })

    if (existingCopy) {
      return res.status(400).json({ message: 'You already have this recipe saved' })
    }

    // Determine original author (could be a chain of saves)
    const originalAuthorId = recipe.originalAuthorId || recipe.userId
    const originalAuthorName = recipe.originalAuthorName || recipe.user.name

    // Create a copy of the recipe for the current user
    const savedRecipe = await prisma.recipe.create({
      data: {
        userId: req.user.id,
        name: recipe.name,
        description: recipe.description,
        instructions: recipe.instructions,
        imageUrl: recipe.imageUrl,
        servings: recipe.servings,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        difficulty: recipe.difficulty,
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
        fiber: recipe.fiber,
        sugar: recipe.sugar,
        sodium: recipe.sodium,
        cuisineType: recipe.cuisineType,
        mealType: recipe.mealType,
        tags: recipe.tags,
        fatSecretId: recipe.fatSecretId,
        sourceUrl: recipe.sourceUrl,
        originalAuthorId,
        originalAuthorName,
        isPublic: false, // Saved recipes are private by default
        ingredients: {
          create: recipe.ingredients.map((ing, index) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            notes: ing.notes,
            fatSecretFoodId: ing.fatSecretFoodId,
            calories: ing.calories,
            protein: ing.protein,
            carbs: ing.carbs,
            fat: ing.fat,
            order: index
          }))
        }
      },
      include: {
        ingredients: { orderBy: { order: 'asc' } }
      }
    })

    res.status(201).json(savedRecipe)
  } catch (error) {
    next(error)
  }
})

// DELETE /api/nutrition/recipes/:id/save - Unsave a recipe
router.delete('/recipes/:id/save', async (req, res, next) => {
  try {
    await prisma.savedRecipe.delete({
      where: {
        userId_recipeId: {
          userId: req.user.id,
          recipeId: req.params.id
        }
      }
    })

    res.json({ message: 'Recipe unsaved' })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Saved recipe not found' })
    }
    next(error)
  }
})

// POST /api/nutrition/recipes/:id/share - Share recipe with friend
router.post('/recipes/:id/share', async (req, res, next) => {
  try {
    const { friendId, message } = req.body

    const recipe = await prisma.recipe.findUnique({
      where: { id: req.params.id }
    })

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' })
    }

    if (recipe.userId !== req.user.id) {
      return res.status(403).json({ message: 'Can only share your own recipes' })
    }

    // Verify friendship
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: req.user.id, friendId, status: 'ACCEPTED' },
          { userId: friendId, friendId: req.user.id, status: 'ACCEPTED' }
        ]
      }
    })

    if (!friendship) {
      return res.status(400).json({ message: 'Can only share with friends' })
    }

    const share = await prisma.recipeShare.upsert({
      where: {
        recipeId_sharedWithId: {
          recipeId: req.params.id,
          sharedWithId: friendId
        }
      },
      create: {
        recipeId: req.params.id,
        sharedById: req.user.id,
        sharedWithId: friendId,
        message,
        status: 'ACCEPTED' // Auto-accept for friends
      },
      update: { message }
    })

    // Notify friend via socket
    const io = req.app.get('io')
    io.to(`user-${friendId}`).emit('recipe-shared', {
      from: req.user,
      recipe: { id: recipe.id, name: recipe.name },
      message
    })

    res.json(share)
  } catch (error) {
    next(error)
  }
})

// ===========================================
// Meal Plans CRUD
// ===========================================

// GET /api/nutrition/meal-plans - Get user's meal plans
router.get('/meal-plans', async (req, res, next) => {
  try {
    const mealPlans = await prisma.mealPlan.findMany({
      where: { userId: req.user.id },
      include: {
        meals: {
          include: {
            recipe: { select: { id: true, name: true, imageUrl: true, calories: true, protein: true, carbs: true, fat: true } }
          },
          orderBy: [{ date: 'asc' }, { mealType: 'asc' }]
        },
        _count: { select: { meals: true } }
      },
      orderBy: { startDate: 'desc' }
    })

    res.json({ mealPlans })
  } catch (error) {
    next(error)
  }
})

// GET /api/nutrition/meal-plans/current - Get current active meal plan
router.get('/meal-plans/current', async (req, res, next) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        userId: req.user.id,
        startDate: { lte: today },
        endDate: { gte: today }
      },
      include: {
        meals: {
          include: {
            recipe: { select: { id: true, name: true, imageUrl: true, calories: true, protein: true, carbs: true, fat: true } }
          },
          orderBy: [{ date: 'asc' }, { mealType: 'asc' }]
        }
      }
    })

    res.json({ mealPlan })
  } catch (error) {
    next(error)
  }
})

// GET /api/nutrition/meal-plans/:id - Get single meal plan
router.get('/meal-plans/:id', async (req, res, next) => {
  try {
    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, username: true } },
        meals: {
          include: {
            recipe: {
              include: {
                ingredients: { orderBy: { order: 'asc' } }
              }
            }
          },
          orderBy: [{ date: 'asc' }, { mealType: 'asc' }]
        }
      }
    })

    if (!mealPlan) {
      return res.status(404).json({ message: 'Meal plan not found' })
    }

    if (mealPlan.userId !== req.user.id && !mealPlan.isPublic) {
      return res.status(403).json({ message: 'Access denied' })
    }

    res.json(mealPlan)
  } catch (error) {
    next(error)
  }
})

// POST /api/nutrition/meal-plans - Create meal plan
router.post('/meal-plans', async (req, res, next) => {
  try {
    const {
      name,
      description,
      startDate,
      endDate,
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFat,
      isPublic
    } = req.body

    const mealPlan = await prisma.mealPlan.create({
      data: {
        userId: req.user.id,
        name,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        targetCalories,
        targetProtein,
        targetCarbs,
        targetFat,
        isPublic: isPublic || false
      },
      include: {
        meals: true
      }
    })

    res.status(201).json(mealPlan)
  } catch (error) {
    next(error)
  }
})

// PUT /api/nutrition/meal-plans/:id - Update meal plan
router.put('/meal-plans/:id', async (req, res, next) => {
  try {
    const existing = await prisma.mealPlan.findUnique({
      where: { id: req.params.id }
    })

    if (!existing) {
      return res.status(404).json({ message: 'Meal plan not found' })
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    const {
      name,
      description,
      startDate,
      endDate,
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFat,
      isPublic
    } = req.body

    const mealPlan = await prisma.mealPlan.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        targetCalories,
        targetProtein,
        targetCarbs,
        targetFat,
        isPublic
      },
      include: {
        meals: {
          include: {
            recipe: { select: { id: true, name: true, imageUrl: true, calories: true, protein: true, carbs: true, fat: true } }
          }
        }
      }
    })

    res.json(mealPlan)
  } catch (error) {
    next(error)
  }
})

// DELETE /api/nutrition/meal-plans/:id - Delete meal plan
router.delete('/meal-plans/:id', async (req, res, next) => {
  try {
    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id: req.params.id }
    })

    if (!mealPlan) {
      return res.status(404).json({ message: 'Meal plan not found' })
    }

    if (mealPlan.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    await prisma.mealPlan.delete({
      where: { id: req.params.id }
    })

    res.json({ message: 'Meal plan deleted' })
  } catch (error) {
    next(error)
  }
})

// POST /api/nutrition/meal-plans/:id/meals - Add meal to plan
router.post('/meal-plans/:id/meals', async (req, res, next) => {
  try {
    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id: req.params.id }
    })

    if (!mealPlan) {
      return res.status(404).json({ message: 'Meal plan not found' })
    }

    if (mealPlan.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    const {
      date,
      mealType,
      recipeId,
      customFoodName,
      customCalories,
      customProtein,
      customCarbs,
      customFat,
      servings,
      notes
    } = req.body

    const meal = await prisma.plannedMeal.create({
      data: {
        mealPlanId: req.params.id,
        date: new Date(date),
        mealType,
        recipeId,
        customFoodName,
        customCalories,
        customProtein,
        customCarbs,
        customFat,
        servings: servings || 1,
        notes
      },
      include: {
        recipe: { select: { id: true, name: true, imageUrl: true, calories: true, protein: true, carbs: true, fat: true } }
      }
    })

    res.status(201).json(meal)
  } catch (error) {
    next(error)
  }
})

// PUT /api/nutrition/meal-plans/:planId/meals/:mealId - Update planned meal
router.put('/meal-plans/:planId/meals/:mealId', async (req, res, next) => {
  try {
    const meal = await prisma.plannedMeal.findUnique({
      where: { id: req.params.mealId },
      include: { mealPlan: true }
    })

    if (!meal) {
      return res.status(404).json({ message: 'Meal not found' })
    }

    if (meal.mealPlan.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    const {
      date,
      mealType,
      recipeId,
      customFoodName,
      customCalories,
      customProtein,
      customCarbs,
      customFat,
      servings,
      notes,
      completed
    } = req.body

    const updated = await prisma.plannedMeal.update({
      where: { id: req.params.mealId },
      data: {
        date: date ? new Date(date) : undefined,
        mealType,
        recipeId,
        customFoodName,
        customCalories,
        customProtein,
        customCarbs,
        customFat,
        servings,
        notes,
        completed
      },
      include: {
        recipe: { select: { id: true, name: true, imageUrl: true, calories: true, protein: true, carbs: true, fat: true } }
      }
    })

    res.json(updated)
  } catch (error) {
    next(error)
  }
})

// DELETE /api/nutrition/meal-plans/:planId/meals/:mealId - Remove meal from plan
router.delete('/meal-plans/:planId/meals/:mealId', async (req, res, next) => {
  try {
    const meal = await prisma.plannedMeal.findUnique({
      where: { id: req.params.mealId },
      include: { mealPlan: true }
    })

    if (!meal) {
      return res.status(404).json({ message: 'Meal not found' })
    }

    if (meal.mealPlan.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    await prisma.plannedMeal.delete({
      where: { id: req.params.mealId }
    })

    res.json({ message: 'Meal removed' })
  } catch (error) {
    next(error)
  }
})

// POST /api/nutrition/meal-plans/:id/share - Share meal plan with friend
router.post('/meal-plans/:id/share', async (req, res, next) => {
  try {
    const { friendId, message } = req.body

    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id: req.params.id }
    })

    if (!mealPlan) {
      return res.status(404).json({ message: 'Meal plan not found' })
    }

    if (mealPlan.userId !== req.user.id) {
      return res.status(403).json({ message: 'Can only share your own meal plans' })
    }

    const share = await prisma.mealPlanShare.upsert({
      where: {
        mealPlanId_sharedWithId: {
          mealPlanId: req.params.id,
          sharedWithId: friendId
        }
      },
      create: {
        mealPlanId: req.params.id,
        sharedById: req.user.id,
        sharedWithId: friendId,
        message,
        status: 'ACCEPTED'
      },
      update: { message }
    })

    // Notify friend
    const io = req.app.get('io')
    io.to(`user-${friendId}`).emit('meal-plan-shared', {
      from: req.user,
      mealPlan: { id: mealPlan.id, name: mealPlan.name },
      message
    })

    res.json(share)
  } catch (error) {
    next(error)
  }
})

// ===========================================
// Food Log (Quick Calorie Tracking)
// ===========================================

// GET /api/nutrition/food-log - Get food log entries
router.get('/food-log', async (req, res, next) => {
  try {
    const { date, startDate, endDate } = req.query

    let dateFilter = {}
    if (date) {
      const targetDate = new Date(date)
      const nextDate = new Date(targetDate)
      nextDate.setDate(nextDate.getDate() + 1)
      dateFilter = {
        date: {
          gte: targetDate,
          lt: nextDate
        }
      }
    } else if (startDate && endDate) {
      dateFilter = {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      }
    }

    const entries = await prisma.foodLogEntry.findMany({
      where: {
        userId: req.user.id,
        ...dateFilter
      },
      orderBy: [{ date: 'desc' }, { mealType: 'asc' }]
    })

    // Calculate totals
    const totals = entries.reduce((acc, entry) => ({
      calories: acc.calories + (entry.calories || 0),
      protein: acc.protein + (entry.protein || 0),
      carbs: acc.carbs + (entry.carbs || 0),
      fat: acc.fat + (entry.fat || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

    res.json({ entries, totals })
  } catch (error) {
    next(error)
  }
})

// GET /api/nutrition/food-log/summary - Get nutrition summary
router.get('/food-log/summary', async (req, res, next) => {
  try {
    const { days = 7 } = req.query
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(days))
    startDate.setHours(0, 0, 0, 0)

    const entries = await prisma.foodLogEntry.findMany({
      where: {
        userId: req.user.id,
        date: { gte: startDate }
      }
    })

    // Group by date
    const byDate = {}
    entries.forEach(entry => {
      const dateKey = entry.date.toISOString().split('T')[0]
      if (!byDate[dateKey]) {
        byDate[dateKey] = { calories: 0, protein: 0, carbs: 0, fat: 0, entries: 0 }
      }
      byDate[dateKey].calories += entry.calories || 0
      byDate[dateKey].protein += entry.protein || 0
      byDate[dateKey].carbs += entry.carbs || 0
      byDate[dateKey].fat += entry.fat || 0
      byDate[dateKey].entries += 1
    })

    // Get user's goals
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id }
    })

    res.json({
      summary: byDate,
      goals: {
        calories: settings?.dailyCalorieGoal,
        protein: settings?.dailyProteinGoal,
        carbs: settings?.dailyCarbsGoal,
        fat: settings?.dailyFatGoal
      }
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/nutrition/food-log - Log food entry
router.post('/food-log', async (req, res, next) => {
  try {
    const {
      date,
      mealType,
      name,
      brand,
      servingSize,
      servings,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      sodium,
      fatSecretFoodId,
      recipeId,
      notes
    } = req.body

    const entry = await prisma.foodLogEntry.create({
      data: {
        userId: req.user.id,
        date: date ? new Date(date) : new Date(),
        mealType,
        name,
        brand,
        servingSize,
        servings: servings || 1,
        calories,
        protein,
        carbs,
        fat,
        fiber,
        sugar,
        sodium,
        fatSecretFoodId,
        recipeId,
        notes
      }
    })

    // Check achievements for meal logging
    const newAchievements = await achievementService.checkAchievements(req.user.id, {
      mealLogged: true
    })

    res.status(201).json({
      ...entry,
      newAchievements: newAchievements.map(ua => ({
        id: ua.achievement.id,
        name: ua.achievement.name,
        description: ua.achievement.description,
        icon: ua.achievement.icon,
        rarity: ua.achievement.rarity,
        points: ua.achievement.points
      }))
    })
  } catch (error) {
    next(error)
  }
})

// PUT /api/nutrition/food-log/:id - Update food log entry
router.put('/food-log/:id', async (req, res, next) => {
  try {
    const entry = await prisma.foodLogEntry.findUnique({
      where: { id: req.params.id }
    })

    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' })
    }

    if (entry.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    // Whitelist allowed fields to prevent prototype pollution
    const { date, mealType, name, calories, protein, carbs, fat, fiber, sodium, notes, servingSize, servingUnit } = req.body
    const allowedData = {}
    if (date !== undefined) allowedData.date = new Date(date)
    if (mealType !== undefined) allowedData.mealType = mealType
    if (name !== undefined) allowedData.name = name
    if (calories !== undefined) allowedData.calories = calories
    if (protein !== undefined) allowedData.protein = protein
    if (carbs !== undefined) allowedData.carbs = carbs
    if (fat !== undefined) allowedData.fat = fat
    if (fiber !== undefined) allowedData.fiber = fiber
    if (sodium !== undefined) allowedData.sodium = sodium
    if (notes !== undefined) allowedData.notes = notes
    if (servingSize !== undefined) allowedData.servingSize = servingSize
    if (servingUnit !== undefined) allowedData.servingUnit = servingUnit

    const updated = await prisma.foodLogEntry.update({
      where: { id: req.params.id },
      data: allowedData
    })

    res.json(updated)
  } catch (error) {
    next(error)
  }
})

// DELETE /api/nutrition/food-log/:id - Delete food log entry
router.delete('/food-log/:id', async (req, res, next) => {
  try {
    const entry = await prisma.foodLogEntry.findUnique({
      where: { id: req.params.id }
    })

    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' })
    }

    if (entry.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    await prisma.foodLogEntry.delete({
      where: { id: req.params.id }
    })

    res.json({ message: 'Entry deleted' })
  } catch (error) {
    next(error)
  }
})

// POST /api/nutrition/food-log/quick - Quick add from FatSecret food
router.post('/food-log/quick', async (req, res, next) => {
  try {
    const { fatSecretFoodId, servingId, servings, mealType, date } = req.body

    // Fetch food details from FatSecret
    const food = await fatSecretService.getFood(fatSecretFoodId)
    if (!food) {
      return res.status(404).json({ message: 'Food not found' })
    }

    // Find the serving
    const serving = food.servings.find(s => s.id === servingId) || food.servings[0]

    const entry = await prisma.foodLogEntry.create({
      data: {
        userId: req.user.id,
        date: date ? new Date(date) : new Date(),
        mealType,
        name: food.name,
        brand: food.brand,
        servingSize: serving.description,
        servings: servings || 1,
        calories: serving.calories * (servings || 1),
        protein: serving.protein * (servings || 1),
        carbs: serving.carbs * (servings || 1),
        fat: serving.fat * (servings || 1),
        fiber: serving.fiber * (servings || 1),
        sugar: serving.sugar * (servings || 1),
        sodium: serving.sodium * (servings || 1),
        fatSecretFoodId
      }
    })

    res.status(201).json(entry)
  } catch (error) {
    next(error)
  }
})

// ===========================================
// Nutrition Goals
// ===========================================

// GET /api/nutrition/goals - Get user's nutrition goals
router.get('/goals', async (req, res, next) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id }
    })

    res.json({
      dailyCalorieGoal: settings?.dailyCalorieGoal,
      dailyProteinGoal: settings?.dailyProteinGoal,
      dailyCarbsGoal: settings?.dailyCarbsGoal,
      dailyFatGoal: settings?.dailyFatGoal,
      mealReminders: settings?.mealReminders
    })
  } catch (error) {
    next(error)
  }
})

// PUT /api/nutrition/goals - Update nutrition goals
router.put('/goals', async (req, res, next) => {
  try {
    const { dailyCalorieGoal, dailyProteinGoal, dailyCarbsGoal, dailyFatGoal, mealReminders } = req.body

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        dailyCalorieGoal,
        dailyProteinGoal,
        dailyCarbsGoal,
        dailyFatGoal,
        mealReminders
      },
      update: {
        dailyCalorieGoal,
        dailyProteinGoal,
        dailyCarbsGoal,
        dailyFatGoal,
        mealReminders
      }
    })

    res.json({
      dailyCalorieGoal: settings.dailyCalorieGoal,
      dailyProteinGoal: settings.dailyProteinGoal,
      dailyCarbsGoal: settings.dailyCarbsGoal,
      dailyFatGoal: settings.dailyFatGoal,
      mealReminders: settings.mealReminders
    })
  } catch (error) {
    next(error)
  }
})

// ===========================================
// Nutrition Preferences
// ===========================================

// GET /api/nutrition/preferences - Get user's nutrition preferences
router.get('/preferences', async (req, res, next) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id }
    })

    res.json({
      nutritionTrackingMode: settings?.nutritionTrackingMode || 'full',
      showDetailedMacros: settings?.showDetailedMacros ?? true,
      showDailyGoals: settings?.showDailyGoals ?? true,
      enableFoodLogging: settings?.enableFoodLogging ?? true,
      dietaryGoal: settings?.dietaryGoal,
      dietaryPreference: settings?.dietaryPreference,
      allergies: settings?.allergies || [],
      preferredProteins: settings?.preferredProteins || [],
      dislikedFoods: settings?.dislikedFoods || []
    })
  } catch (error) {
    next(error)
  }
})

// PUT /api/nutrition/preferences - Update nutrition preferences
router.put('/preferences', async (req, res, next) => {
  try {
    const {
      nutritionTrackingMode,
      showDetailedMacros,
      showDailyGoals,
      enableFoodLogging,
      dietaryGoal,
      dietaryPreference,
      allergies,
      preferredProteins,
      dislikedFoods
    } = req.body

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        nutritionTrackingMode,
        showDetailedMacros,
        showDailyGoals,
        enableFoodLogging,
        dietaryGoal,
        dietaryPreference,
        allergies: allergies || [],
        preferredProteins: preferredProteins || [],
        dislikedFoods: dislikedFoods || []
      },
      update: {
        ...(nutritionTrackingMode !== undefined && { nutritionTrackingMode }),
        ...(showDetailedMacros !== undefined && { showDetailedMacros }),
        ...(showDailyGoals !== undefined && { showDailyGoals }),
        ...(enableFoodLogging !== undefined && { enableFoodLogging }),
        ...(dietaryGoal !== undefined && { dietaryGoal }),
        ...(dietaryPreference !== undefined && { dietaryPreference }),
        ...(allergies !== undefined && { allergies }),
        ...(preferredProteins !== undefined && { preferredProteins }),
        ...(dislikedFoods !== undefined && { dislikedFoods })
      }
    })

    res.json({
      nutritionTrackingMode: settings.nutritionTrackingMode,
      showDetailedMacros: settings.showDetailedMacros,
      showDailyGoals: settings.showDailyGoals,
      enableFoodLogging: settings.enableFoodLogging,
      dietaryGoal: settings.dietaryGoal,
      dietaryPreference: settings.dietaryPreference,
      allergies: settings.allergies,
      preferredProteins: settings.preferredProteins,
      dislikedFoods: settings.dislikedFoods
    })
  } catch (error) {
    next(error)
  }
})

// ===========================================
// Body Stats & Calorie Calculator
// ===========================================

// GET /api/nutrition/body-stats - Get user's body stats
router.get('/body-stats', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        heightCm: true,
        weightKg: true,
        goalWeightKg: true,
        sex: true,
        birthDate: true,
        activityLevel: true
      }
    })

    res.json(user || {})
  } catch (error) {
    next(error)
  }
})

// PUT /api/nutrition/body-stats - Update user's body stats
router.put('/body-stats', async (req, res, next) => {
  try {
    const { heightCm, weightKg, goalWeightKg, sex, birthDate, activityLevel } = req.body

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(heightCm !== undefined && { heightCm }),
        ...(weightKg !== undefined && { weightKg }),
        ...(goalWeightKg !== undefined && { goalWeightKg }),
        ...(sex !== undefined && { sex }),
        ...(birthDate !== undefined && { birthDate: birthDate ? new Date(birthDate) : null }),
        ...(activityLevel !== undefined && { activityLevel })
      },
      select: {
        heightCm: true,
        weightKg: true,
        goalWeightKg: true,
        sex: true,
        birthDate: true,
        activityLevel: true
      }
    })

    res.json(user)
  } catch (error) {
    next(error)
  }
})

// ===========================================
// Weight Logging & Progress Tracking
// ===========================================

// GET /api/nutrition/weight-log - Get weight history
router.get('/weight-log', async (req, res, next) => {
  try {
    const { days = 30 } = req.query
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(days))
    startDate.setHours(0, 0, 0, 0)

    const entries = await prisma.weightLog.findMany({
      where: {
        userId: req.user.id,
        date: { gte: startDate }
      },
      orderBy: { date: 'asc' }
    })

    // Get user's goal weight for context
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { weightKg: true, goalWeightKg: true }
    })

    // Calculate progress stats
    const stats = {
      currentWeight: user?.weightKg,
      goalWeight: user?.goalWeightKg,
      entries: entries.length,
      firstEntry: entries[0] || null,
      lastEntry: entries[entries.length - 1] || null,
      weightChange: null,
      remainingToGoal: null,
      averageWeeklyChange: null
    }

    if (entries.length >= 2) {
      stats.weightChange = Math.round((entries[entries.length - 1].weightKg - entries[0].weightKg) * 10) / 10
      const daysDiff = (new Date(entries[entries.length - 1].date) - new Date(entries[0].date)) / (1000 * 60 * 60 * 24)
      if (daysDiff > 0) {
        stats.averageWeeklyChange = Math.round((stats.weightChange / daysDiff) * 7 * 10) / 10
      }
    }

    if (user?.goalWeightKg && user?.weightKg) {
      stats.remainingToGoal = Math.round((user.weightKg - user.goalWeightKg) * 10) / 10
    }

    res.json({ entries, stats })
  } catch (error) {
    next(error)
  }
})

// POST /api/nutrition/weight-log - Log weight
router.post('/weight-log', async (req, res, next) => {
  try {
    const { weightKg, date, notes } = req.body

    if (!weightKg || weightKg <= 0) {
      return res.status(400).json({ message: 'Valid weight is required' })
    }

    // Normalize date to start of day for unique constraint
    const logDate = date ? new Date(date) : new Date()
    logDate.setHours(0, 0, 0, 0)

    // Upsert - update if exists for this date, create if not
    const entry = await prisma.weightLog.upsert({
      where: {
        userId_date: {
          userId: req.user.id,
          date: logDate
        }
      },
      create: {
        userId: req.user.id,
        date: logDate,
        weightKg: parseFloat(weightKg),
        notes
      },
      update: {
        weightKg: parseFloat(weightKg),
        notes
      }
    })

    // Also update user's current weight
    await prisma.user.update({
      where: { id: req.user.id },
      data: { weightKg: parseFloat(weightKg) }
    })

    // Auto-track weight goals (WEIGHT_LOSS and WEIGHT_GAIN)
    const weightGoals = await prisma.goal.findMany({
      where: {
        userId: req.user.id,
        type: { in: ['WEIGHT_LOSS', 'WEIGHT_GAIN'] },
        isCompleted: false
      }
    })

    for (const goal of weightGoals) {
      // Update current value
      await prisma.goal.update({
        where: { id: goal.id },
        data: { currentValue: parseFloat(weightKg) }
      })

      // Log progress
      await prisma.goalProgress.create({
        data: {
          goalId: goal.id,
          value: parseFloat(weightKg),
          source: 'AUTO_WEIGHT_LOG'
        }
      })

      // Check if goal is completed
      const isCompleted = goal.type === 'WEIGHT_LOSS'
        ? parseFloat(weightKg) <= goal.targetValue
        : parseFloat(weightKg) >= goal.targetValue

      if (isCompleted && !goal.isCompleted) {
        await prisma.goal.update({
          where: { id: goal.id },
          data: {
            isCompleted: true,
            completedAt: new Date()
          }
        })

        // Check achievements for goal completion
        await achievementService.checkAchievements(req.user.id, {
          goalCompleted: true,
          goalType: goal.type
        })
      }
    }

    res.status(201).json(entry)
  } catch (error) {
    next(error)
  }
})

// GET /api/nutrition/weight-log/today - Get today's weight entry
router.get('/weight-log/today', async (req, res, next) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const entry = await prisma.weightLog.findUnique({
      where: {
        userId_date: {
          userId: req.user.id,
          date: today
        }
      }
    })

    res.json({ entry })
  } catch (error) {
    next(error)
  }
})

// GET /api/nutrition/calculate-calories - Calculate suggested daily calories
router.get('/calculate-calories', async (req, res, next) => {
  try {
    // Accept optional query params to use current UI values instead of saved values
    const {
      goal: queryGoal,
      activityLevel: queryActivity,
      heightCm: queryHeight,
      weightKg: queryWeight,
      sex: querySex,
      birthDate: queryBirthDate
    } = req.query

    // Fetch user data as fallback for any values not provided in query
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        heightCm: true,
        weightKg: true,
        sex: true,
        birthDate: true,
        activityLevel: true
      }
    })

    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id },
      select: { dietaryGoal: true }
    })

    // Use query params if provided, otherwise fall back to saved values
    const heightCm = queryHeight ? parseFloat(queryHeight) : user?.heightCm
    const weightKg = queryWeight ? parseFloat(queryWeight) : user?.weightKg
    const sex = querySex || user?.sex
    const birthDate = queryBirthDate || user?.birthDate

    if (!heightCm || !weightKg || !sex || !birthDate) {
      return res.status(400).json({
        message: 'Missing body stats. Please enter height, weight, sex, and birth date.',
        missing: {
          heightCm: !heightCm,
          weightKg: !weightKg,
          sex: !sex,
          birthDate: !birthDate
        }
      })
    }

    // Calculate age
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }

    // Calculate BMR using Mifflin-St Jeor equation (most accurate for most people)
    // Formula: Men: 10 × weight(kg) + 6.25 × height(cm) − 5 × age(y) + 5
    //          Women: 10 × weight(kg) + 6.25 × height(cm) − 5 × age(y) − 161
    let bmr
    if (sex === 'male') {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    } else {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    }
    bmr = Math.round(bmr)

    // Activity multipliers (Harris-Benedict activity factors)
    const activityMultipliers = {
      sedentary: 1.2,      // Little to no exercise, desk job
      light: 1.375,        // Light exercise 1-3 days/week
      moderate: 1.55,      // Moderate exercise 3-5 days/week
      active: 1.725,       // Heavy exercise 6-7 days/week
      veryActive: 1.9      // Very heavy exercise, physical job, or training twice/day
    }

    const activityDescriptions = {
      sedentary: 'Little to no exercise, desk job',
      light: 'Light exercise 1-3 days per week',
      moderate: 'Moderate exercise 3-5 days per week',
      active: 'Heavy exercise 6-7 days per week',
      veryActive: 'Very heavy exercise or physical job'
    }

    // Use query param activity level if provided, otherwise use saved value
    const activityLevel = queryActivity || user.activityLevel || 'moderate'
    const multiplier = activityMultipliers[activityLevel] || 1.55
    const tdee = Math.round(bmr * multiplier)

    // Goal configurations with detailed settings
    const goalConfigs = {
      maintain: {
        label: 'Maintain Weight',
        description: 'Eat at maintenance calories to maintain current weight',
        calorieAdjustment: 0,
        proteinMultiplier: 1.6, // g per kg of body weight
        weeklyWeightChange: 0,
        macroSplit: { protein: 0.30, carbs: 0.40, fat: 0.30 }
      },
      weight_loss: {
        label: 'Weight Loss',
        description: 'Moderate calorie deficit for sustainable weight loss',
        calorieAdjustment: -400,
        proteinMultiplier: 2.0, // Higher protein to preserve muscle
        weeklyWeightChange: -0.35, // ~0.75 lb per week
        macroSplit: { protein: 0.35, carbs: 0.35, fat: 0.30 }
      },
      aggressive_loss: {
        label: 'Aggressive Weight Loss',
        description: 'Larger deficit for faster results (not recommended long-term)',
        calorieAdjustment: -750,
        proteinMultiplier: 2.2, // Even higher protein
        weeklyWeightChange: -0.7, // ~1.5 lb per week
        macroSplit: { protein: 0.40, carbs: 0.30, fat: 0.30 }
      },
      cut: {
        label: 'Bodybuilding Cut',
        description: 'Calorie deficit while preserving muscle mass for athletes',
        calorieAdjustment: -500,
        proteinMultiplier: 2.4, // Very high protein for muscle preservation
        weeklyWeightChange: -0.45, // ~1 lb per week
        macroSplit: { protein: 0.40, carbs: 0.35, fat: 0.25 }
      },
      bulk: {
        label: 'Lean Bulk',
        description: 'Calorie surplus for muscle gain with minimal fat',
        calorieAdjustment: 300,
        proteinMultiplier: 2.0,
        weeklyWeightChange: 0.25, // ~0.5 lb per week
        macroSplit: { protein: 0.25, carbs: 0.50, fat: 0.25 }
      },
      recomp: {
        label: 'Body Recomposition',
        description: 'Build muscle while losing fat at maintenance calories',
        calorieAdjustment: 0,
        proteinMultiplier: 2.2, // High protein for muscle building
        weeklyWeightChange: 0,
        macroSplit: { protein: 0.35, carbs: 0.35, fat: 0.30 }
      }
    }

    // Get the dietary goal
    const dietaryGoal = queryGoal || settings?.dietaryGoal || 'maintain'
    const goalConfig = goalConfigs[dietaryGoal] || goalConfigs.maintain

    // Calculate suggested calories with goal adjustment
    let suggestedCalories = tdee + goalConfig.calorieAdjustment
    const goalAdjustment = goalConfig.calorieAdjustment

    // Enforce minimum calories for safety
    // Generally: 1200 for women, 1500 for men (absolute minimums)
    // Better minimums: BMR or slightly above
    const absoluteMinimum = sex === 'male' ? 1500 : 1200
    const safeMinimum = Math.max(bmr, absoluteMinimum)
    let calorieWarning = null

    if (suggestedCalories < safeMinimum) {
      calorieWarning = {
        type: 'too_low',
        message: `Suggested calories (${suggestedCalories}) is below safe minimum. We recommend at least ${safeMinimum} calories.`,
        recommendedMinimum: safeMinimum
      }
      // Don't auto-adjust, but warn the user
    }

    // Calculate protein based on body weight (more accurate than percentage)
    // This is the preferred method for active individuals
    const proteinByWeight = Math.round(weightKg * goalConfig.proteinMultiplier)

    // Also calculate percentage-based for comparison
    const { protein: proteinPct, carbs: carbsPct, fat: fatPct } = goalConfig.macroSplit
    const proteinByPercent = Math.round((suggestedCalories * proteinPct) / 4)

    // Use the higher of the two protein calculations (ensures adequate protein)
    const suggestedProtein = Math.max(proteinByWeight, proteinByPercent)

    // Adjust carbs and fat based on remaining calories after protein
    const proteinCalories = suggestedProtein * 4
    const remainingCalories = suggestedCalories - proteinCalories

    // Split remaining between carbs and fat based on goal ratios
    const carbFatRatio = carbsPct / (carbsPct + fatPct)
    const suggestedCarbs = Math.round((remainingCalories * carbFatRatio) / 4)
    const suggestedFat = Math.round((remainingCalories * (1 - carbFatRatio)) / 9)

    // Calculate expected weight change
    const weeklyWeightChangeKg = goalConfig.weeklyWeightChange
    const weeklyWeightChangeLbs = Math.round(weeklyWeightChangeKg * 2.205 * 10) / 10

    // Generate personalized tips based on age, sex, and goal
    const tips = []

    // Age-specific tips
    if (age >= 50) {
      tips.push({
        type: 'age',
        title: 'Protein is crucial',
        message: `At ${age}, aim for at least ${Math.round(weightKg * 1.2)}g protein daily to prevent muscle loss.`
      })
      tips.push({
        type: 'age',
        title: 'Strength training',
        message: 'Include resistance training 2-3x per week to maintain muscle mass and bone density.'
      })
    }

    if (age >= 40 && sex === 'female') {
      tips.push({
        type: 'health',
        title: 'Bone health',
        message: 'Ensure adequate calcium (1200mg) and vitamin D intake for bone health.'
      })
    }

    // Goal-specific tips
    if (dietaryGoal === 'weight_loss' || dietaryGoal === 'aggressive_loss' || dietaryGoal === 'cut') {
      tips.push({
        type: 'goal',
        title: 'High protein priority',
        message: `Eating ${suggestedProtein}g protein daily helps preserve muscle during weight loss.`
      })
      tips.push({
        type: 'goal',
        title: 'Daily steps',
        message: 'Aim for 7,000-10,000 steps daily to increase calorie burn without stressing the body.'
      })
      if (dietaryGoal === 'aggressive_loss') {
        tips.push({
          type: 'warning',
          title: 'Not for long-term',
          message: 'Aggressive deficits should be limited to 4-8 weeks. Consider a diet break after.'
        })
      }
    }

    if (dietaryGoal === 'bulk') {
      tips.push({
        type: 'goal',
        title: 'Progressive overload',
        message: 'Focus on progressively increasing weights to maximize muscle gains from the surplus.'
      })
    }

    // General tip
    tips.push({
      type: 'general',
      title: 'Track consistently',
      message: 'Track your food for at least 2 weeks before adjusting calories. Weight fluctuates daily.'
    })

    res.json({
      // Core metrics with explanations
      bmr,
      bmrExplanation: 'Basal Metabolic Rate - calories your body burns at complete rest just to stay alive (breathing, circulation, cell production)',
      tdee,
      tdeeExplanation: 'Total Daily Energy Expenditure - total calories you burn per day including activity. This is your maintenance calories.',
      suggestedCalories,
      goalAdjustment,

      // Macro recommendations
      suggestedMacros: {
        protein: suggestedProtein,
        proteinPerKg: goalConfig.proteinMultiplier,
        carbs: suggestedCarbs,
        fat: suggestedFat
      },

      // Goal details
      goal: {
        id: dietaryGoal,
        label: goalConfig.label,
        description: goalConfig.description
      },

      // Expected results
      expectedResults: {
        weeklyWeightChangeKg,
        weeklyWeightChangeLbs,
        monthlyWeightChangeKg: Math.round(weeklyWeightChangeKg * 4.3 * 10) / 10,
        monthlyWeightChangeLbs: Math.round(weeklyWeightChangeLbs * 4.3 * 10) / 10
      },

      // Warnings
      calorieWarning,
      safeMinimum,

      // Tips
      tips,

      // Activity info
      activity: {
        level: activityLevel,
        multiplier,
        description: activityDescriptions[activityLevel]
      },

      // Input data for reference (what was actually used in calculations)
      inputData: {
        heightCm,
        weightKg,
        weightLbs: Math.round(weightKg * 2.205),
        sex,
        age,
        activityLevel,
        dietaryGoal
      }
    })
  } catch (error) {
    next(error)
  }
})

export default router
