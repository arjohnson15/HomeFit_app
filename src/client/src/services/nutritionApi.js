import api from './api'

// Nutrition API Service

// ===========================================
// FatSecret Food/Recipe Search
// ===========================================

export const searchFoods = async (query, page = 0, limit = 20) => {
  const response = await api.get('/nutrition/search/foods', {
    params: { q: query, page, limit }
  })
  return response.data
}

export const searchFatSecretRecipes = async (query, page = 0, limit = 20, filters = {}) => {
  const params = { q: query, page, limit }
  if (filters.recipeTypes) params.recipeTypes = filters.recipeTypes
  if (filters.mustHaveImages) params.mustHaveImages = 'true'
  if (filters.caloriesFrom) params.caloriesFrom = filters.caloriesFrom
  if (filters.caloriesTo) params.caloriesTo = filters.caloriesTo
  if (filters.cookingTimeFrom) params.cookingTimeFrom = filters.cookingTimeFrom
  if (filters.cookingTimeTo) params.cookingTimeTo = filters.cookingTimeTo

  const response = await api.get('/nutrition/search/recipes', { params })
  return response.data
}

export const getFood = async (foodId) => {
  const response = await api.get(`/nutrition/foods/${foodId}`)
  return response.data
}

export const getFatSecretRecipe = async (recipeId) => {
  const response = await api.get(`/nutrition/fatsecret-recipes/${recipeId}`)
  return response.data
}

export const getAutocomplete = async (query, limit = 10) => {
  const response = await api.get('/nutrition/autocomplete', {
    params: { q: query, limit }
  })
  return response.data
}

// ===========================================
// User Recipes
// ===========================================

export const getRecipes = async (params = {}) => {
  const response = await api.get('/nutrition/recipes', { params })
  return response.data
}

export const getRecipe = async (id) => {
  const response = await api.get(`/nutrition/recipes/${id}`)
  return response.data
}

export const discoverRecipes = async (params = {}) => {
  const response = await api.get('/nutrition/recipes/discover', { params })
  return response.data
}

export const getSavedRecipes = async () => {
  const response = await api.get('/nutrition/recipes/saved')
  return response.data
}

export const createRecipe = async (data) => {
  const response = await api.post('/nutrition/recipes', data)
  return response.data
}

export const updateRecipe = async (id, data) => {
  const response = await api.put(`/nutrition/recipes/${id}`, data)
  return response.data
}

export const deleteRecipe = async (id) => {
  const response = await api.delete(`/nutrition/recipes/${id}`)
  return response.data
}

export const saveRecipe = async (id, notes) => {
  const response = await api.post(`/nutrition/recipes/${id}/save`, { notes })
  return response.data
}

export const unsaveRecipe = async (id) => {
  const response = await api.delete(`/nutrition/recipes/${id}/save`)
  return response.data
}

export const shareRecipe = async (id, friendId, message) => {
  const response = await api.post(`/nutrition/recipes/${id}/share`, { friendId, message })
  return response.data
}

// ===========================================
// Meal Plans
// ===========================================

export const getMealPlans = async () => {
  const response = await api.get('/nutrition/meal-plans')
  return response.data
}

export const getCurrentMealPlan = async () => {
  const response = await api.get('/nutrition/meal-plans/current')
  return response.data
}

export const getMealPlan = async (id) => {
  const response = await api.get(`/nutrition/meal-plans/${id}`)
  return response.data
}

export const createMealPlan = async (data) => {
  const response = await api.post('/nutrition/meal-plans', data)
  return response.data
}

export const updateMealPlan = async (id, data) => {
  const response = await api.put(`/nutrition/meal-plans/${id}`, data)
  return response.data
}

export const deleteMealPlan = async (id) => {
  const response = await api.delete(`/nutrition/meal-plans/${id}`)
  return response.data
}

export const addMealToPlan = async (planId, data) => {
  const response = await api.post(`/nutrition/meal-plans/${planId}/meals`, data)
  return response.data
}

export const updatePlannedMeal = async (planId, mealId, data) => {
  const response = await api.put(`/nutrition/meal-plans/${planId}/meals/${mealId}`, data)
  return response.data
}

export const removeMealFromPlan = async (planId, mealId) => {
  const response = await api.delete(`/nutrition/meal-plans/${planId}/meals/${mealId}`)
  return response.data
}

export const shareMealPlan = async (id, friendId, message) => {
  const response = await api.post(`/nutrition/meal-plans/${id}/share`, { friendId, message })
  return response.data
}

// ===========================================
// Food Log
// ===========================================

export const getFoodLog = async (params = {}) => {
  const response = await api.get('/nutrition/food-log', { params })
  return response.data
}

export const getFoodLogSummary = async (days = 7) => {
  const response = await api.get('/nutrition/food-log/summary', { params: { days } })
  return response.data
}

export const logFood = async (data) => {
  const response = await api.post('/nutrition/food-log', data)
  return response.data
}

export const quickLogFood = async (data) => {
  const response = await api.post('/nutrition/food-log/quick', data)
  return response.data
}

export const updateFoodLogEntry = async (id, data) => {
  const response = await api.put(`/nutrition/food-log/${id}`, data)
  return response.data
}

export const deleteFoodLogEntry = async (id) => {
  const response = await api.delete(`/nutrition/food-log/${id}`)
  return response.data
}

// ===========================================
// Nutrition Goals
// ===========================================

export const getNutritionGoals = async () => {
  const response = await api.get('/nutrition/goals')
  return response.data
}

export const updateNutritionGoals = async (data) => {
  const response = await api.put('/nutrition/goals', data)
  return response.data
}

// ===========================================
// Weight Logging
// ===========================================

export const getWeightLog = async (days = 30) => {
  const response = await api.get('/nutrition/weight-log', { params: { days } })
  return response.data
}

export const logWeight = async (weightKg, date, notes) => {
  const response = await api.post('/nutrition/weight-log', { weightKg, date, notes })
  return response.data
}

export const getTodayWeight = async () => {
  const response = await api.get('/nutrition/weight-log/today')
  return response.data
}

export default {
  searchFoods,
  searchFatSecretRecipes,
  getFood,
  getFatSecretRecipe,
  getAutocomplete,
  getRecipes,
  getRecipe,
  discoverRecipes,
  getSavedRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  saveRecipe,
  unsaveRecipe,
  shareRecipe,
  getMealPlans,
  getCurrentMealPlan,
  getMealPlan,
  createMealPlan,
  updateMealPlan,
  deleteMealPlan,
  addMealToPlan,
  updatePlannedMeal,
  removeMealFromPlan,
  shareMealPlan,
  getFoodLog,
  getFoodLogSummary,
  logFood,
  quickLogFood,
  updateFoodLogEntry,
  deleteFoodLogEntry,
  getNutritionGoals,
  updateNutritionGoals,
  getWeightLog,
  logWeight,
  getTodayWeight
}
