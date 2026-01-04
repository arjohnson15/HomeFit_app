import prisma from '../lib/prisma.js'
import logger from '../utils/logger.js'

// FatSecret API Service
// Documentation: https://platform.fatsecret.com/api/

class FatSecretService {
  constructor() {
    this.accessToken = null
    this.tokenExpiry = null
    this.baseUrl = 'https://platform.fatsecret.com/rest/server.api'
    this.authUrl = 'https://oauth.fatsecret.com/connect/token'
  }

  async getCredentials() {
    const settings = await prisma.appSettings.findUnique({
      where: { id: '1' }
    })

    if (!settings?.fatSecretClientId || !settings?.fatSecretClientSecret) {
      throw new Error('FatSecret API credentials not configured')
    }

    return {
      clientId: settings.fatSecretClientId,
      clientSecret: settings.fatSecretClientSecret,
      tier: settings.fatSecretTier || 'basic'
    }
  }

  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    const { clientId, clientSecret, tier } = await this.getCredentials()

    const response = await fetch(this.authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: tier  // 'basic' for free tier, 'premier' for paid subscription
      })
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('FatSecret auth error:', error)
      // Provide more specific error message
      if (response.status === 401 || response.status === 403) {
        throw new Error('FatSecret authentication failed - check credentials and IP whitelist (may take up to 24 hours to propagate)')
      }
      throw new Error(`Failed to authenticate with FatSecret API: ${response.status}`)
    }

    const data = await response.json()
    this.accessToken = data.access_token
    // Set expiry 5 minutes before actual expiry for safety
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000

    return this.accessToken
  }

  async request(method, params = {}) {
    const token = await this.getAccessToken()

    const searchParams = new URLSearchParams({
      method,
      format: 'json',
      ...params
    })

    const response = await fetch(`${this.baseUrl}?${searchParams}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error(`FatSecret API error (${method}):`, error)
      throw new Error(`FatSecret API error: ${response.status}`)
    }

    return response.json()
  }

  // Search for foods
  async searchFoods(query, page = 0, maxResults = 20) {
    try {
      const result = await this.request('foods.search', {
        search_expression: query,
        page_number: page,
        max_results: maxResults
      })

      if (!result.foods?.food) {
        return { foods: [], total: 0 }
      }

      // Normalize response (can be array or single object)
      const foods = Array.isArray(result.foods.food)
        ? result.foods.food
        : [result.foods.food]

      return {
        foods: foods.map(this.normalizeFood),
        total: parseInt(result.foods.total_results) || foods.length,
        page,
        maxResults
      }
    } catch (error) {
      logger.error('FatSecret searchFoods error:', error)
      throw error
    }
  }

  // Get food by ID with full nutrition details
  async getFood(foodId) {
    try {
      const result = await this.request('food.get.v4', {
        food_id: foodId
      })

      if (!result.food) {
        return null
      }

      return this.normalizeFoodDetails(result.food)
    } catch (error) {
      logger.error('FatSecret getFood error:', error)
      throw error
    }
  }

  // Search for recipes
  async searchRecipes(query, page = 0, maxResults = 20, filters = {}) {
    try {
      const params = {
        search_expression: query,
        page_number: page,
        max_results: maxResults
      }

      // Add optional filters
      if (filters.recipeTypes) {
        params.recipe_types = filters.recipeTypes // comma-separated: "Main Dish,Appetizer"
      }
      if (filters.mustHaveImages) {
        params.must_have_images = 'true'
      }
      if (filters.caloriesFrom) {
        params['calories.from'] = filters.caloriesFrom
      }
      if (filters.caloriesTo) {
        params['calories.to'] = filters.caloriesTo
      }
      if (filters.cookingTimeFrom) {
        params['cooking_time_mins.from'] = filters.cookingTimeFrom
      }
      if (filters.cookingTimeTo) {
        params['cooking_time_mins.to'] = filters.cookingTimeTo
      }

      const result = await this.request('recipes.search.v3', params)

      if (!result.recipes?.recipe) {
        return { recipes: [], total: 0 }
      }

      const recipes = Array.isArray(result.recipes.recipe)
        ? result.recipes.recipe
        : [result.recipes.recipe]

      return {
        recipes: recipes.map(this.normalizeRecipeSearch),
        total: parseInt(result.recipes.total_results) || recipes.length,
        page,
        maxResults
      }
    } catch (error) {
      logger.error('FatSecret searchRecipes error:', error)
      throw error
    }
  }

  // Get recipe by ID with full details
  async getRecipe(recipeId) {
    try {
      const result = await this.request('recipe.get.v2', {
        recipe_id: recipeId
      })

      if (!result.recipe) {
        return null
      }

      return this.normalizeRecipeDetails(result.recipe)
    } catch (error) {
      logger.error('FatSecret getRecipe error:', error)
      throw error
    }
  }

  // Get autocomplete suggestions for food search
  async autocomplete(query, maxResults = 10) {
    try {
      const result = await this.request('foods.autocomplete', {
        expression: query,
        max_results: maxResults
      })

      if (!result.suggestions?.suggestion) {
        return []
      }

      return Array.isArray(result.suggestions.suggestion)
        ? result.suggestions.suggestion
        : [result.suggestions.suggestion]
    } catch (error) {
      logger.error('FatSecret autocomplete error:', error)
      throw error
    }
  }

  // Normalize food search result
  normalizeFood(food) {
    // Parse nutrition from description string
    // Format: "Per 100g - Calories: 250kcal | Fat: 10g | Carbs: 30g | Protein: 8g"
    const nutrition = parseNutritionDescription(food.food_description)

    return {
      id: food.food_id,
      name: food.food_name,
      brand: food.brand_name || null,
      type: food.food_type, // 'Generic' or 'Brand'
      description: food.food_description,
      url: food.food_url,
      ...nutrition
    }
  }

  // Normalize detailed food response
  normalizeFoodDetails(food) {
    const servings = food.servings?.serving
    const servingList = Array.isArray(servings) ? servings : [servings]

    return {
      id: food.food_id,
      name: food.food_name,
      brand: food.brand_name || null,
      type: food.food_type,
      url: food.food_url,
      servings: servingList.map(s => ({
        id: s.serving_id,
        description: s.serving_description,
        measurementDescription: s.measurement_description,
        metricAmount: parseFloat(s.metric_serving_amount) || null,
        metricUnit: s.metric_serving_unit || null,
        calories: parseFloat(s.calories) || 0,
        fat: parseFloat(s.fat) || 0,
        saturatedFat: parseFloat(s.saturated_fat) || 0,
        carbs: parseFloat(s.carbohydrate) || 0,
        fiber: parseFloat(s.fiber) || 0,
        sugar: parseFloat(s.sugar) || 0,
        protein: parseFloat(s.protein) || 0,
        sodium: parseFloat(s.sodium) || 0,
        cholesterol: parseFloat(s.cholesterol) || 0,
        potassium: parseFloat(s.potassium) || 0
      }))
    }
  }

  // Normalize recipe search result
  normalizeRecipeSearch(recipe) {
    return {
      id: recipe.recipe_id,
      name: recipe.recipe_name,
      description: recipe.recipe_description,
      imageUrl: recipe.recipe_image || null,
      calories: parseFloat(recipe.recipe_nutrition?.calories) || null,
      fat: parseFloat(recipe.recipe_nutrition?.fat) || null,
      carbs: parseFloat(recipe.recipe_nutrition?.carbohydrate) || null,
      protein: parseFloat(recipe.recipe_nutrition?.protein) || null
    }
  }

  // Normalize detailed recipe response
  normalizeRecipeDetails(recipe) {
    const ingredients = recipe.ingredients?.ingredient
    const ingredientList = Array.isArray(ingredients) ? ingredients : (ingredients ? [ingredients] : [])

    const directions = recipe.directions?.direction
    const directionList = Array.isArray(directions) ? directions : (directions ? [directions] : [])

    const categories = recipe.recipe_categories?.recipe_category
    const categoryList = Array.isArray(categories) ? categories : (categories ? [categories] : [])

    return {
      id: recipe.recipe_id,
      name: recipe.recipe_name,
      description: recipe.recipe_description,
      imageUrl: recipe.recipe_images?.recipe_image?.[0] || recipe.recipe_image || null,
      url: recipe.recipe_url,
      servings: parseInt(recipe.number_of_servings) || 1,
      prepTime: parseInt(recipe.preparation_time_min) || null,
      cookTime: parseInt(recipe.cooking_time_min) || null,
      rating: parseFloat(recipe.rating) || null,
      categories: categoryList.map(c => c.recipe_category_name),
      nutrition: {
        calories: parseFloat(recipe.serving_sizes?.serving?.calories) || null,
        fat: parseFloat(recipe.serving_sizes?.serving?.fat) || null,
        saturatedFat: parseFloat(recipe.serving_sizes?.serving?.saturated_fat) || null,
        carbs: parseFloat(recipe.serving_sizes?.serving?.carbohydrate) || null,
        fiber: parseFloat(recipe.serving_sizes?.serving?.fiber) || null,
        sugar: parseFloat(recipe.serving_sizes?.serving?.sugar) || null,
        protein: parseFloat(recipe.serving_sizes?.serving?.protein) || null,
        sodium: parseFloat(recipe.serving_sizes?.serving?.sodium) || null
      },
      ingredients: ingredientList.map(i => ({
        id: i.food_id,
        name: i.food_name,
        description: i.ingredient_description,
        servingId: i.serving_id
      })),
      instructions: directionList
        .sort((a, b) => parseInt(a.direction_number) - parseInt(b.direction_number))
        .map(d => d.direction_description)
        .join('\n\n')
    }
  }
}

// Helper to parse nutrition from FatSecret description string
function parseNutritionDescription(description) {
  if (!description) return {}

  const result = {}

  // Extract serving size (e.g., "Per 100g" or "Per 1 cup")
  const servingMatch = description.match(/Per\s+(.+?)\s*-/)
  if (servingMatch) {
    result.servingSize = servingMatch[1]
  }

  // Extract calories
  const caloriesMatch = description.match(/Calories:\s*([\d.]+)/i)
  if (caloriesMatch) {
    result.calories = parseFloat(caloriesMatch[1])
  }

  // Extract fat
  const fatMatch = description.match(/Fat:\s*([\d.]+)/i)
  if (fatMatch) {
    result.fat = parseFloat(fatMatch[1])
  }

  // Extract carbs
  const carbsMatch = description.match(/Carbs:\s*([\d.]+)/i)
  if (carbsMatch) {
    result.carbs = parseFloat(carbsMatch[1])
  }

  // Extract protein
  const proteinMatch = description.match(/Protein:\s*([\d.]+)/i)
  if (proteinMatch) {
    result.protein = parseFloat(proteinMatch[1])
  }

  return result
}

// Export singleton instance
export const fatSecretService = new FatSecretService()
export default fatSecretService
