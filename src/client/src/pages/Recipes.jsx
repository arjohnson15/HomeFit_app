import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import * as nutritionApi from '../services/nutritionApi'
import api from '../services/api'

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD']

const emptyIngredient = { name: '', amount: '', unit: '' }
const emptyStep = ''

// FatSecret recipe type filters
const RECIPE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'Main Dish', label: 'Main Dish' },
  { value: 'Breakfast', label: 'Breakfast' },
  { value: 'Appetizer', label: 'Appetizer' },
  { value: 'Salad', label: 'Salad' },
  { value: 'Side Dish', label: 'Side Dish' },
  { value: 'Soup', label: 'Soup' },
  { value: 'Dessert', label: 'Dessert' },
  { value: 'Snack', label: 'Snack' },
  { value: 'Beverage', label: 'Beverage' }
]

const CALORIE_RANGES = [
  { value: '', label: 'Any Calories' },
  { value: '0-300', label: 'Under 300 cal' },
  { value: '300-500', label: '300-500 cal' },
  { value: '500-700', label: '500-700 cal' },
  { value: '700-1000', label: '700+ cal' }
]

const TIME_FILTERS = [
  { value: '', label: 'Any Time' },
  { value: '0-15', label: 'Quick (< 15 min)' },
  { value: '0-30', label: 'Under 30 min' },
  { value: '30-60', label: '30-60 min' }
]

function Recipes() {
  const [activeTab, setActiveTab] = useState('my-recipes')
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRecipeModal, setShowRecipeModal] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [friends, setFriends] = useState([])
  const [showShareModal, setShowShareModal] = useState(false)
  // Recipe form state
  const [formIngredients, setFormIngredients] = useState([{ ...emptyIngredient }])
  const [formSteps, setFormSteps] = useState([emptyStep])
  // FatSecret recipe ideas
  const [ideaRecipes, setIdeaRecipes] = useState([])
  const [ideaSearchQuery, setIdeaSearchQuery] = useState('')
  const [ideaLoading, setIdeaLoading] = useState(false)
  const [showIdeaModal, setShowIdeaModal] = useState(false)
  const [selectedIdea, setSelectedIdea] = useState(null)
  const [ideaDetails, setIdeaDetails] = useState(null)
  const [ideaDetailsLoading, setIdeaDetailsLoading] = useState(false)
  const [showIdeaIngredients, setShowIdeaIngredients] = useState(false)
  const [showIdeaInstructions, setShowIdeaInstructions] = useState(false)
  const [savingIdea, setSavingIdea] = useState(false)
  const [ideaSaved, setIdeaSaved] = useState(false)
  // Community recipe save state
  const [savingRecipe, setSavingRecipe] = useState(false)
  const [recipeSaved, setRecipeSaved] = useState(false)
  // Ideas filters
  const [ideaFilters, setIdeaFilters] = useState({
    recipeType: '',
    calorieRange: '',
    timeFilter: '',
    mustHaveImages: false
  })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchRecipes()
    fetchFriends()
  }, [activeTab])

  const fetchRecipes = async () => {
    // Skip for ideas tab - it has its own search
    if (activeTab === 'ideas') {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      let data
      if (activeTab === 'my-recipes') {
        data = await nutritionApi.getRecipes({ search: searchQuery })
      } else if (activeTab === 'community') {
        data = await nutritionApi.discoverRecipes({ search: searchQuery })
      } else if (activeTab === 'saved') {
        data = await nutritionApi.getSavedRecipes()
      }
      setRecipes(data?.recipes || [])
    } catch (error) {
      console.error('Error fetching recipes:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFriends = async () => {
    try {
      const response = await api.get('/social/friends')
      setFriends(response.data.friends || [])
    } catch (error) {
      console.error('Error fetching friends:', error)
    }
  }

  const searchRecipeIdeas = async (query, filters = ideaFilters) => {
    if (!query || query.length < 2) {
      setIdeaRecipes([])
      return
    }
    setIdeaLoading(true)
    try {
      // Build filters object for API
      const apiFilters = {}
      if (filters.recipeType) {
        apiFilters.recipeTypes = filters.recipeType
      }
      if (filters.mustHaveImages) {
        apiFilters.mustHaveImages = true
      }
      if (filters.calorieRange) {
        const [from, to] = filters.calorieRange.split('-').map(Number)
        if (from !== undefined) apiFilters.caloriesFrom = from
        if (to !== undefined) apiFilters.caloriesTo = to
      }
      if (filters.timeFilter) {
        const [from, to] = filters.timeFilter.split('-').map(Number)
        if (from !== undefined) apiFilters.cookingTimeFrom = from
        if (to !== undefined) apiFilters.cookingTimeTo = to
      }

      const results = await nutritionApi.searchFatSecretRecipes(query, 0, 20, apiFilters)
      setIdeaRecipes(results.recipes || [])
    } catch (error) {
      console.error('Error searching recipe ideas:', error)
      setIdeaRecipes([])
    } finally {
      setIdeaLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    const newFilters = { ...ideaFilters, [key]: value }
    setIdeaFilters(newFilters)
    // Re-search with new filters if there's a query
    if (ideaSearchQuery.length >= 2) {
      searchRecipeIdeas(ideaSearchQuery, newFilters)
    }
  }

  const clearFilters = () => {
    const defaultFilters = {
      recipeType: '',
      calorieRange: '',
      timeFilter: '',
      mustHaveImages: false
    }
    setIdeaFilters(defaultFilters)
    if (ideaSearchQuery.length >= 2) {
      searchRecipeIdeas(ideaSearchQuery, defaultFilters)
    }
  }

  const hasActiveFilters = ideaFilters.recipeType || ideaFilters.calorieRange || ideaFilters.timeFilter || ideaFilters.mustHaveImages

  const fetchIdeaDetails = async (recipeId) => {
    setIdeaDetailsLoading(true)
    try {
      const details = await nutritionApi.getFatSecretRecipe(recipeId)
      setIdeaDetails(details)
    } catch (error) {
      console.error('Error fetching recipe details:', error)
    } finally {
      setIdeaDetailsLoading(false)
    }
  }

  const openIdeaModal = (recipe) => {
    setSelectedIdea(recipe)
    setIdeaDetails(null)
    setShowIdeaModal(true)
    setShowIdeaIngredients(false)
    setShowIdeaInstructions(false)
    setIdeaSaved(false)
    fetchIdeaDetails(recipe.id)
  }

  const saveIdeaAsRecipe = async () => {
    if (!ideaDetails) return
    setSavingIdea(true)
    try {
      // Parse instructions string into steps array
      const instructionSteps = ideaDetails.instructions
        ? ideaDetails.instructions.split('\n\n').filter(s => s.trim())
        : []

      // Format ingredients from API objects
      const ingredients = ideaDetails.ingredients?.map(ing => ({
        name: typeof ing === 'string' ? ing : (ing.description || ing.name || ''),
        amount: null,
        unit: null
      })) || []

      await nutritionApi.createRecipe({
        name: ideaDetails.name,
        description: ideaDetails.description || '',
        instructions: instructionSteps.map((step, i) => `${i + 1}. ${step}`).join('\n'),
        servings: ideaDetails.servings || 1,
        prepTime: ideaDetails.prepTime || null,
        cookTime: ideaDetails.cookTime || null,
        difficulty: 'MEDIUM',
        mealType: [],
        calories: ideaDetails.nutrition?.calories || null,
        protein: ideaDetails.nutrition?.protein || null,
        carbs: ideaDetails.nutrition?.carbs || null,
        fat: ideaDetails.nutrition?.fat || null,
        isPublic: false,
        ingredients,
        imageUrl: ideaDetails.imageUrl || null,
        sourceUrl: ideaDetails.url || null
      })
      setIdeaSaved(true)
      fetchRecipes()
    } catch (error) {
      console.error('Error saving recipe:', error)
    } finally {
      setSavingIdea(false)
    }
  }

  const resetForm = () => {
    setFormIngredients([{ ...emptyIngredient }])
    setFormSteps([emptyStep])
  }

  const openCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const addIngredient = () => {
    setFormIngredients([...formIngredients, { ...emptyIngredient }])
  }

  const removeIngredient = (index) => {
    if (formIngredients.length > 1) {
      setFormIngredients(formIngredients.filter((_, i) => i !== index))
    }
  }

  const updateIngredient = (index, field, value) => {
    const updated = [...formIngredients]
    updated[index][field] = value
    setFormIngredients(updated)
  }

  const addStep = () => {
    setFormSteps([...formSteps, emptyStep])
  }

  const removeStep = (index) => {
    if (formSteps.length > 1) {
      setFormSteps(formSteps.filter((_, i) => i !== index))
    }
  }

  const updateStep = (index, value) => {
    const updated = [...formSteps]
    updated[index] = value
    setFormSteps(updated)
  }

  const handleCreateRecipe = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)

    // Filter out empty ingredients
    const ingredients = formIngredients
      .filter(ing => ing.name.trim())
      .map(ing => ({
        name: ing.name.trim(),
        amount: parseFloat(ing.amount) || null,
        unit: ing.unit.trim() || null
      }))

    // Filter out empty steps and join them
    const instructions = formSteps
      .filter(step => step.trim())
      .map((step, i) => `${i + 1}. ${step.trim()}`)
      .join('\n')

    try {
      await nutritionApi.createRecipe({
        name: formData.get('name'),
        description: formData.get('description'),
        instructions,
        servings: parseInt(formData.get('servings')) || 1,
        prepTime: parseInt(formData.get('prepTime')) || null,
        cookTime: parseInt(formData.get('cookTime')) || null,
        difficulty: formData.get('difficulty') || 'MEDIUM',
        mealType: formData.getAll('mealType'),
        calories: parseFloat(formData.get('calories')) || null,
        protein: parseFloat(formData.get('protein')) || null,
        carbs: parseFloat(formData.get('carbs')) || null,
        fat: parseFloat(formData.get('fat')) || null,
        isPublic: formData.get('isPublic') === 'on',
        ingredients
      })
      setShowCreateModal(false)
      resetForm()
      fetchRecipes()
    } catch (error) {
      console.error('Error creating recipe:', error)
    }
  }

  const handleSaveRecipe = async (recipeId) => {
    setSavingRecipe(true)
    try {
      await nutritionApi.saveRecipe(recipeId)
      setRecipeSaved(true)
      fetchRecipes()
    } catch (error) {
      console.error('Error saving recipe:', error)
      // Check for "already saved" error
      if (error.response?.data?.message?.includes('already have')) {
        setRecipeSaved(true) // Show as saved if already in collection
      }
    } finally {
      setSavingRecipe(false)
    }
  }

  const handleUnsaveRecipe = async (recipeId) => {
    try {
      await nutritionApi.unsaveRecipe(recipeId)
      fetchRecipes()
    } catch (error) {
      console.error('Error unsaving recipe:', error)
    }
  }

  const handleDeleteRecipe = async (recipeId) => {
    if (!confirm('Are you sure you want to delete this recipe?')) return
    try {
      await nutritionApi.deleteRecipe(recipeId)
      setShowRecipeModal(false)
      fetchRecipes()
    } catch (error) {
      console.error('Error deleting recipe:', error)
    }
  }

  const handleShareRecipe = async (friendId) => {
    try {
      await nutritionApi.shareRecipe(selectedRecipe.id, friendId)
      setShowShareModal(false)
    } catch (error) {
      console.error('Error sharing recipe:', error)
    }
  }

  const openRecipeModal = async (recipe) => {
    setSelectedRecipe(recipe)
    setShowRecipeModal(true)
    setRecipeSaved(false)
    setSavingRecipe(false)
  }

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'EASY': return 'text-green-500 bg-green-500/20'
      case 'MEDIUM': return 'text-yellow-500 bg-yellow-500/20'
      case 'HARD': return 'text-red-500 bg-red-500/20'
      default: return 'text-gray-500 bg-gray-500/20'
    }
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Recipes</h1>
          <p className="text-gray-400">Create and share healthy meals</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Recipe
        </button>
      </div>

      {/* Back Link */}
      <Link to="/nutrition" className="inline-flex items-center text-accent">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Nutrition
      </Link>

      {/* Tabs */}
      <div className="flex bg-dark-elevated rounded-xl p-1">
        <button
          onClick={() => setActiveTab('my-recipes')}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
            activeTab === 'my-recipes' ? 'bg-accent text-white' : 'text-gray-400'
          }`}
        >
          My Recipes
        </button>
        <button
          onClick={() => setActiveTab('ideas')}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
            activeTab === 'ideas' ? 'bg-accent text-white' : 'text-gray-400'
          }`}
        >
          Ideas
        </button>
        <button
          onClick={() => setActiveTab('community')}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
            activeTab === 'community' ? 'bg-accent text-white' : 'text-gray-400'
          }`}
        >
          Community
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
            activeTab === 'saved' ? 'bg-accent text-white' : 'text-gray-400'
          }`}
        >
          Saved
        </button>
      </div>

      {/* Search - different for Ideas tab */}
      {activeTab === 'ideas' ? (
        <div className="space-y-3">
          <div className="relative">
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search meal ideas (e.g., chicken, pasta, healthy)..."
              value={ideaSearchQuery}
              onChange={(e) => setIdeaSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchRecipeIdeas(ideaSearchQuery)}
              className="input w-full pl-10 pr-12"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${
                showFilters || hasActiveFilters ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="card bg-dark-elevated p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium">Filters</h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-accent hover:text-accent/80"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Recipe Type */}
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Type</label>
                  <select
                    value={ideaFilters.recipeType}
                    onChange={(e) => handleFilterChange('recipeType', e.target.value)}
                    className="input w-full text-sm py-2"
                  >
                    {RECIPE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {/* Calorie Range */}
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Calories</label>
                  <select
                    value={ideaFilters.calorieRange}
                    onChange={(e) => handleFilterChange('calorieRange', e.target.value)}
                    className="input w-full text-sm py-2"
                  >
                    {CALORIE_RANGES.map(range => (
                      <option key={range.value} value={range.value}>{range.label}</option>
                    ))}
                  </select>
                </div>

                {/* Cooking Time */}
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Cook Time</label>
                  <select
                    value={ideaFilters.timeFilter}
                    onChange={(e) => handleFilterChange('timeFilter', e.target.value)}
                    className="input w-full text-sm py-2"
                  >
                    {TIME_FILTERS.map(time => (
                      <option key={time.value} value={time.value}>{time.label}</option>
                    ))}
                  </select>
                </div>

                {/* Has Image */}
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer py-2">
                    <input
                      type="checkbox"
                      checked={ideaFilters.mustHaveImages}
                      onChange={(e) => handleFilterChange('mustHaveImages', e.target.checked)}
                      className="accent-accent w-4 h-4"
                    />
                    <span className="text-white text-sm">Has image</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Active Filters Pills */}
          {hasActiveFilters && !showFilters && (
            <div className="flex flex-wrap gap-2">
              {ideaFilters.recipeType && (
                <span className="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm flex items-center gap-1">
                  {ideaFilters.recipeType}
                  <button onClick={() => handleFilterChange('recipeType', '')} className="hover:text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {ideaFilters.calorieRange && (
                <span className="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm flex items-center gap-1">
                  {CALORIE_RANGES.find(r => r.value === ideaFilters.calorieRange)?.label}
                  <button onClick={() => handleFilterChange('calorieRange', '')} className="hover:text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {ideaFilters.timeFilter && (
                <span className="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm flex items-center gap-1">
                  {TIME_FILTERS.find(t => t.value === ideaFilters.timeFilter)?.label}
                  <button onClick={() => handleFilterChange('timeFilter', '')} className="hover:text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {ideaFilters.mustHaveImages && (
                <span className="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm flex items-center gap-1">
                  Has image
                  <button onClick={() => handleFilterChange('mustHaveImages', false)} className="hover:text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="relative">
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchRecipes()}
            className="input w-full pl-10"
          />
        </div>
      )}

      {/* Ideas Tab Content */}
      {activeTab === 'ideas' ? (
        ideaLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : ideaRecipes.length === 0 ? (
          <div className="card text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-white font-medium mb-2">Search for meal ideas</h3>
            <p className="text-gray-400 max-w-sm mx-auto">
              {ideaSearchQuery ? 'No recipes found. Try a different search term.' : 'Search for recipes from our database of thousands of meals. Try "chicken", "pasta", "healthy breakfast", etc.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ideaRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="card cursor-pointer hover:bg-dark-elevated transition-colors p-3"
                onClick={() => openIdeaModal(recipe)}
              >
                {recipe.imageUrl ? (
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.name}
                    className="w-full aspect-square object-cover rounded-xl mb-3"
                  />
                ) : (
                  <div className="w-full aspect-square bg-dark-elevated rounded-xl mb-3 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                )}
                <h3 className="text-white font-medium text-sm mb-1 line-clamp-2">{recipe.name}</h3>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {recipe.calories && <span>{Math.round(recipe.calories)} cal</span>}
                  {recipe.prepTime && <span>{recipe.prepTime} min</span>}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Recipe Grid for other tabs */
        loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="card text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-gray-400">
              {activeTab === 'my-recipes' ? 'No recipes yet' :
               activeTab === 'community' ? 'No community recipes yet. Share your recipes to see them here!' :
               'No saved recipes'}
            </p>
            {activeTab === 'my-recipes' && (
              <button onClick={() => setShowCreateModal(true)} className="btn-primary mt-4">
                Create Your First Recipe
              </button>
            )}
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="card cursor-pointer hover:bg-dark-elevated transition-colors p-3"
              onClick={() => openRecipeModal(recipe)}
            >
              {recipe.imageUrl ? (
                <img
                  src={recipe.imageUrl}
                  alt={recipe.name}
                  className="w-full aspect-square object-cover rounded-xl mb-3"
                />
              ) : (
                <div className="w-full aspect-square bg-dark-elevated rounded-xl mb-3 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              )}
              <div className="flex justify-between items-start gap-2 mb-1">
                <h3 className="text-white font-medium text-sm line-clamp-2">{recipe.name}</h3>
                {recipe.difficulty && (
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${getDifficultyColor(recipe.difficulty)}`}>
                    {recipe.difficulty.toLowerCase()}
                  </span>
                )}
              </div>
              {recipe.user && activeTab !== 'my-recipes' && (
                <p className="text-gray-500 text-xs mb-1">by {recipe.user.name}</p>
              )}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-gray-400">
                  {recipe.calories && (
                    <span>{Math.round(recipe.calories)} cal</span>
                  )}
                  {recipe.prepTime && (
                    <span>{recipe.prepTime + (recipe.cookTime || 0)} min</span>
                  )}
                </div>
                {activeTab === 'community' && (
                  <div className="flex items-center gap-1 text-gray-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    {recipe._count?.savedBy || 0}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        )
      )}

      {/* Create Recipe Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div
            className="bg-dark-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">New Recipe</h2>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-dark-elevated rounded-lg">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateRecipe} className="p-4 space-y-5">
              {/* Basic Info */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Recipe Name *</label>
                <input type="text" name="name" required className="input w-full" placeholder="e.g., Protein Pancakes" />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Description</label>
                <textarea name="description" rows={2} className="input w-full" placeholder="Brief description..." />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Servings</label>
                  <input type="number" name="servings" defaultValue={1} className="input w-full" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Prep (min)</label>
                  <input type="number" name="prepTime" className="input w-full" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Cook (min)</label>
                  <input type="number" name="cookTime" className="input w-full" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Difficulty</label>
                  <select name="difficulty" className="input w-full">
                    {DIFFICULTIES.map(d => (
                      <option key={d} value={d}>{d.toLowerCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Meal Type</label>
                  <div className="flex flex-wrap gap-1">
                    {MEAL_TYPES.map(type => (
                      <label key={type} className="flex items-center gap-1 bg-dark-elevated px-2 py-1 rounded-lg text-xs">
                        <input type="checkbox" name="mealType" value={type} className="accent-accent w-3 h-3" />
                        <span className="text-white capitalize">{type.toLowerCase()}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ingredients Section */}
              <div className="border-t border-dark-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-white font-medium">Ingredients</label>
                  <button
                    type="button"
                    onClick={addIngredient}
                    className="text-accent text-sm flex items-center gap-1 hover:text-accent/80"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {formIngredients.map((ing, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Ingredient name"
                        value={ing.name}
                        onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                        className="input flex-1"
                      />
                      <input
                        type="number"
                        placeholder="Amt"
                        value={ing.amount}
                        onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                        className="input w-16"
                      />
                      <input
                        type="text"
                        placeholder="Unit"
                        value={ing.unit}
                        onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                        className="input w-16"
                      />
                      <button
                        type="button"
                        onClick={() => removeIngredient(index)}
                        className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                        disabled={formIngredients.length === 1}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions Section */}
              <div className="border-t border-dark-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-white font-medium">Instructions</label>
                  <button
                    type="button"
                    onClick={addStep}
                    className="text-accent text-sm flex items-center gap-1 hover:text-accent/80"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Step
                  </button>
                </div>
                <div className="space-y-3">
                  {formSteps.map((step, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0 text-sm mt-2">
                        {index + 1}
                      </span>
                      <textarea
                        placeholder={`Step ${index + 1}...`}
                        value={step}
                        onChange={(e) => updateStep(index, e.target.value)}
                        rows={2}
                        className="input flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        className="p-2 text-gray-500 hover:text-red-500 transition-colors mt-1"
                        disabled={formSteps.length === 1}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nutrition */}
              <div className="border-t border-dark-border pt-4">
                <label className="block text-white font-medium mb-3">Nutrition per Serving</label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-gray-500 text-xs mb-1">Calories</label>
                    <input type="number" name="calories" placeholder="0" className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-xs mb-1">Protein (g)</label>
                    <input type="number" name="protein" placeholder="0" className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-xs mb-1">Carbs (g)</label>
                    <input type="number" name="carbs" placeholder="0" className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-xs mb-1">Fat (g)</label>
                    <input type="number" name="fat" placeholder="0" className="input w-full" />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 pt-2">
                <input type="checkbox" name="isPublic" className="accent-accent" />
                <span className="text-white">Make recipe public (share with community)</span>
              </label>

              <button type="submit" className="btn-primary w-full">Create Recipe</button>
            </form>
          </div>
        </div>
      )}

      {/* Recipe Detail Modal */}
      {showRecipeModal && selectedRecipe && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowRecipeModal(false)}>
          <div
            className="bg-dark-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{selectedRecipe.name}</h2>
                <button onClick={() => setShowRecipeModal(false)} className="p-2 hover:bg-dark-elevated rounded-lg">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-6">
              {selectedRecipe.imageUrl && (
                <img src={selectedRecipe.imageUrl} alt={selectedRecipe.name} className="w-full h-48 object-cover rounded-xl" />
              )}

              {selectedRecipe.description && (
                <p className="text-gray-400">{selectedRecipe.description}</p>
              )}

              {/* Original Author Attribution */}
              {selectedRecipe.originalAuthorName && (
                <div className="flex items-center gap-2 text-sm text-gray-400 bg-dark-elevated rounded-lg px-3 py-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Originally shared by: <span className="text-accent">{selectedRecipe.originalAuthorName}</span></span>
                </div>
              )}

              {/* Meta */}
              <div className="flex flex-wrap gap-3">
                {selectedRecipe.difficulty && (
                  <span className={`text-xs px-3 py-1 rounded-full ${getDifficultyColor(selectedRecipe.difficulty)}`}>
                    {selectedRecipe.difficulty.toLowerCase()}
                  </span>
                )}
                {selectedRecipe.prepTime && (
                  <span className="text-xs px-3 py-1 rounded-full bg-dark-elevated text-gray-400">
                    {selectedRecipe.prepTime} min prep
                  </span>
                )}
                {selectedRecipe.cookTime && (
                  <span className="text-xs px-3 py-1 rounded-full bg-dark-elevated text-gray-400">
                    {selectedRecipe.cookTime} min cook
                  </span>
                )}
                <span className="text-xs px-3 py-1 rounded-full bg-dark-elevated text-gray-400">
                  {selectedRecipe.servings} servings
                </span>
              </div>

              {/* Nutrition */}
              {selectedRecipe.calories && (
                <div className="card bg-dark-elevated">
                  <h3 className="text-white font-medium mb-3">Nutrition per Serving</h3>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-white">{Math.round(selectedRecipe.calories)}</p>
                      <p className="text-gray-500 text-xs">calories</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-500">{Math.round(selectedRecipe.protein || 0)}g</p>
                      <p className="text-gray-500 text-xs">protein</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-500">{Math.round(selectedRecipe.carbs || 0)}g</p>
                      <p className="text-gray-500 text-xs">carbs</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-500">{Math.round(selectedRecipe.fat || 0)}g</p>
                      <p className="text-gray-500 text-xs">fat</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Ingredients */}
              {selectedRecipe.ingredients?.length > 0 && (
                <div>
                  <h3 className="text-white font-medium mb-3">Ingredients</h3>
                  <ul className="space-y-2">
                    {selectedRecipe.ingredients.map((ing, i) => (
                      <li key={i} className="flex items-center gap-2 text-gray-300">
                        <span className="w-2 h-2 bg-accent rounded-full" />
                        {ing.amount && <span>{ing.amount}</span>}
                        {ing.unit && <span>{ing.unit}</span>}
                        <span>{ing.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Instructions */}
              {selectedRecipe.instructions && (
                <div>
                  <h3 className="text-white font-medium mb-3">Instructions</h3>
                  <div className="text-gray-300 whitespace-pre-wrap">{selectedRecipe.instructions}</div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-dark-border">
                {/* Save button - only show for community recipes (not your own) */}
                {activeTab === 'community' && (
                  <button
                    onClick={() => handleSaveRecipe(selectedRecipe.id)}
                    disabled={savingRecipe || recipeSaved}
                    className={`flex-1 flex items-center justify-center py-3 px-4 rounded-xl font-medium transition-colors ${
                      recipeSaved
                        ? 'bg-green-600 text-white cursor-default'
                        : 'btn-primary'
                    }`}
                  >
                    {savingRecipe ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Saving...
                      </>
                    ) : recipeSaved ? (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Saved to My Recipes!
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Save to My Recipes
                      </>
                    )}
                  </button>
                )}
                {activeTab === 'my-recipes' && (
                  <>
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="btn-secondary flex-1"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share
                    </button>
                    <button
                      onClick={() => handleDeleteRecipe(selectedRecipe.id)}
                      className="btn-secondary text-error"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && selectedRecipe && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center" onClick={() => setShowShareModal(false)}>
          <div
            className="bg-dark-card w-full max-w-sm rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4">Share with Friends</h3>
            {friends.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No friends to share with</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {friends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => handleShareRecipe(friend.id)}
                    className="w-full flex items-center gap-3 p-3 bg-dark-elevated rounded-xl hover:bg-dark-border transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium">
                      {friend.name?.charAt(0) || '?'}
                    </div>
                    <span className="text-white">{friend.name}</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowShareModal(false)} className="btn-secondary w-full mt-4">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Idea Detail Modal (FatSecret recipes) */}
      {showIdeaModal && selectedIdea && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowIdeaModal(false)}>
          <div
            className="bg-dark-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{selectedIdea.name}</h2>
                <button onClick={() => setShowIdeaModal(false)} className="p-2 hover:bg-dark-elevated rounded-lg">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-6">
              {ideaDetailsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : ideaDetails ? (
                <>
                  {ideaDetails.imageUrl ? (
                    <img src={ideaDetails.imageUrl} alt={ideaDetails.name} className="w-full h-48 object-cover rounded-xl" />
                  ) : (
                    <div className="w-full h-48 bg-dark-elevated rounded-xl flex items-center justify-center">
                      <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  )}

                  {ideaDetails.description && (
                    <p className="text-gray-400">{ideaDetails.description}</p>
                  )}

                  {/* Nutrition */}
                  {ideaDetails.nutrition?.calories && (
                    <div className="card bg-dark-elevated">
                      <h3 className="text-white font-medium mb-3">Nutrition per Serving</h3>
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-white">{Math.round(ideaDetails.nutrition.calories)}</p>
                          <p className="text-gray-500 text-xs">calories</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-500">{Math.round(ideaDetails.nutrition.protein || 0)}g</p>
                          <p className="text-gray-500 text-xs">protein</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-yellow-500">{Math.round(ideaDetails.nutrition.carbs || 0)}g</p>
                          <p className="text-gray-500 text-xs">carbs</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-red-500">{Math.round(ideaDetails.nutrition.fat || 0)}g</p>
                          <p className="text-gray-500 text-xs">fat</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap gap-3">
                    {ideaDetails.servings && (
                      <span className="text-xs px-3 py-1 rounded-full bg-dark-elevated text-gray-400">
                        {ideaDetails.servings} servings
                      </span>
                    )}
                    {ideaDetails.prepTime && (
                      <span className="text-xs px-3 py-1 rounded-full bg-dark-elevated text-gray-400">
                        {ideaDetails.prepTime} min prep
                      </span>
                    )}
                    {ideaDetails.cookTime && (
                      <span className="text-xs px-3 py-1 rounded-full bg-dark-elevated text-gray-400">
                        {ideaDetails.cookTime} min cook
                      </span>
                    )}
                  </div>

                  {/* Ingredients - Collapsible */}
                  {ideaDetails.ingredients?.length > 0 && (
                    <div className="border border-dark-border rounded-xl overflow-hidden">
                      <button
                        onClick={() => setShowIdeaIngredients(!showIdeaIngredients)}
                        className="w-full flex items-center justify-between p-4 bg-dark-elevated hover:bg-dark-border transition-colors"
                      >
                        <h3 className="text-white font-medium">Ingredients ({ideaDetails.ingredients.length})</h3>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${showIdeaIngredients ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showIdeaIngredients && (
                        <ul className="p-4 space-y-2 bg-dark-card">
                          {ideaDetails.ingredients.map((ing, i) => (
                            <li key={i} className="flex items-start gap-2 text-gray-300">
                              <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                              <span>{typeof ing === 'string' ? ing : (ing.description || ing.name || '')}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Instructions - Collapsible */}
                  {ideaDetails.instructions && (
                    <div className="border border-dark-border rounded-xl overflow-hidden">
                      <button
                        onClick={() => setShowIdeaInstructions(!showIdeaInstructions)}
                        className="w-full flex items-center justify-between p-4 bg-dark-elevated hover:bg-dark-border transition-colors"
                      >
                        <h3 className="text-white font-medium">Instructions</h3>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${showIdeaInstructions ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showIdeaInstructions && (
                        <div className="p-4 bg-dark-card">
                          <div className="text-gray-300 whitespace-pre-wrap">{ideaDetails.instructions}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t border-dark-border">
                    <button
                      onClick={saveIdeaAsRecipe}
                      disabled={savingIdea || ideaSaved}
                      className={`flex-1 flex items-center justify-center py-3 px-4 rounded-xl font-medium transition-colors ${
                        ideaSaved
                          ? 'bg-green-600 text-white cursor-default'
                          : 'btn-primary'
                      }`}
                    >
                      {savingIdea ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Saving...
                        </>
                      ) : ideaSaved ? (
                        <>
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Saved!
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Save to My Recipes
                        </>
                      )}
                    </button>
                  </div>

                  {/* Source link */}
                  {ideaDetails.url && (
                    <a
                      href={ideaDetails.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary w-full text-center"
                    >
                      View Original Recipe
                    </a>
                  )}
                </>
              ) : (
                <p className="text-gray-400 text-center py-8">Failed to load recipe details</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Recipes
