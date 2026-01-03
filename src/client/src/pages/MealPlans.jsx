import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import * as nutritionApi from '../services/nutritionApi'

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']

function MealPlans() {
  const [mealPlans, setMealPlans] = useState([])
  const [currentPlan, setCurrentPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddMealModal, setShowAddMealModal] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedMealType, setSelectedMealType] = useState('BREAKFAST')
  const [recipes, setRecipes] = useState([])
  const [viewingPlan, setViewingPlan] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [plansRes, currentRes, recipesRes] = await Promise.all([
        nutritionApi.getMealPlans(),
        nutritionApi.getCurrentMealPlan(),
        nutritionApi.getRecipes()
      ])
      setMealPlans(plansRes.mealPlans || [])
      setCurrentPlan(currentRes.mealPlan)
      setRecipes(recipesRes.recipes || [])
    } catch (error) {
      console.error('Error fetching meal plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePlan = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)

    try {
      const plan = await nutritionApi.createMealPlan({
        name: formData.get('name'),
        description: formData.get('description'),
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate'),
        targetCalories: parseInt(formData.get('targetCalories')) || null,
        targetProtein: parseInt(formData.get('targetProtein')) || null,
        targetCarbs: parseInt(formData.get('targetCarbs')) || null,
        targetFat: parseInt(formData.get('targetFat')) || null
      })
      setShowCreateModal(false)
      setViewingPlan(plan)
      fetchData()
    } catch (error) {
      console.error('Error creating meal plan:', error)
    }
  }

  const handleAddMeal = async (recipe) => {
    if (!viewingPlan || !selectedDay) return

    try {
      await nutritionApi.addMealToPlan(viewingPlan.id, {
        date: selectedDay,
        mealType: selectedMealType,
        recipeId: recipe.id,
        servings: 1
      })
      setShowAddMealModal(false)

      // Refresh the viewing plan
      const updated = await nutritionApi.getMealPlan(viewingPlan.id)
      setViewingPlan(updated)
      fetchData()
    } catch (error) {
      console.error('Error adding meal:', error)
    }
  }

  const handleAddCustomMeal = async (e) => {
    e.preventDefault()
    if (!viewingPlan || !selectedDay) return

    const formData = new FormData(e.target)

    try {
      await nutritionApi.addMealToPlan(viewingPlan.id, {
        date: selectedDay,
        mealType: selectedMealType,
        customFoodName: formData.get('name'),
        customCalories: parseFloat(formData.get('calories')) || 0,
        customProtein: parseFloat(formData.get('protein')) || 0,
        customCarbs: parseFloat(formData.get('carbs')) || 0,
        customFat: parseFloat(formData.get('fat')) || 0
      })
      setShowAddMealModal(false)

      const updated = await nutritionApi.getMealPlan(viewingPlan.id)
      setViewingPlan(updated)
      fetchData()
    } catch (error) {
      console.error('Error adding custom meal:', error)
    }
  }

  const handleRemoveMeal = async (mealId) => {
    if (!viewingPlan) return

    try {
      await nutritionApi.removeMealFromPlan(viewingPlan.id, mealId)
      const updated = await nutritionApi.getMealPlan(viewingPlan.id)
      setViewingPlan(updated)
    } catch (error) {
      console.error('Error removing meal:', error)
    }
  }

  const handleDeletePlan = async (planId) => {
    if (!confirm('Are you sure you want to delete this meal plan?')) return

    try {
      await nutritionApi.deleteMealPlan(planId)
      setViewingPlan(null)
      fetchData()
    } catch (error) {
      console.error('Error deleting meal plan:', error)
    }
  }

  const getDateRange = (plan) => {
    if (!plan) return []
    const dates = []
    const start = new Date(plan.startDate)
    const end = new Date(plan.endDate)

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0])
    }
    return dates
  }

  const getMealsForDay = (plan, date, mealType) => {
    if (!plan?.meals) return []
    return plan.meals.filter(m =>
      m.date.split('T')[0] === date && m.mealType === mealType
    )
  }

  const getDayTotals = (plan, date) => {
    if (!plan?.meals) return { calories: 0, protein: 0, carbs: 0, fat: 0 }

    const dayMeals = plan.meals.filter(m => m.date.split('T')[0] === date)
    return dayMeals.reduce((acc, meal) => {
      const cal = meal.recipe?.calories || meal.customCalories || 0
      const pro = meal.recipe?.protein || meal.customProtein || 0
      const carb = meal.recipe?.carbs || meal.customCarbs || 0
      const fat = meal.recipe?.fat || meal.customFat || 0
      const servings = meal.servings || 1

      return {
        calories: acc.calories + (cal * servings),
        protein: acc.protein + (pro * servings),
        carbs: acc.carbs + (carb * servings),
        fat: acc.fat + (fat * servings)
      }
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 })
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const getDefaultDates = () => {
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 6)
    return {
      start: today.toISOString().split('T')[0],
      end: nextWeek.toISOString().split('T')[0]
    }
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Meal Plans</h1>
          <p className="text-gray-400">Plan your weekly meals</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Plan
        </button>
      </div>

      {/* Back Link */}
      <Link to="/nutrition" className="inline-flex items-center text-accent">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Nutrition
      </Link>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : viewingPlan ? (
        /* Plan Detail View */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setViewingPlan(null)}
              className="flex items-center text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Plans
            </button>
            <button
              onClick={() => handleDeletePlan(viewingPlan.id)}
              className="text-error text-sm"
            >
              Delete Plan
            </button>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold text-white mb-2">{viewingPlan.name}</h2>
            {viewingPlan.description && (
              <p className="text-gray-400 mb-3">{viewingPlan.description}</p>
            )}
            <p className="text-gray-500 text-sm">
              {formatDate(viewingPlan.startDate)} - {formatDate(viewingPlan.endDate)}
            </p>
            {viewingPlan.targetCalories && (
              <div className="mt-3 flex gap-4 text-sm">
                <span className="text-gray-400">Target: {viewingPlan.targetCalories} cal</span>
                {viewingPlan.targetProtein && <span className="text-blue-500">{viewingPlan.targetProtein}g P</span>}
                {viewingPlan.targetCarbs && <span className="text-yellow-500">{viewingPlan.targetCarbs}g C</span>}
                {viewingPlan.targetFat && <span className="text-red-500">{viewingPlan.targetFat}g F</span>}
              </div>
            )}
          </div>

          {/* Days */}
          <div className="space-y-4">
            {getDateRange(viewingPlan).map((date) => {
              const totals = getDayTotals(viewingPlan, date)
              const isToday = date === new Date().toISOString().split('T')[0]

              return (
                <div key={date} className={`card ${isToday ? 'ring-2 ring-accent' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-medium">
                        {formatDate(date)}
                        {isToday && <span className="text-accent ml-2">(Today)</span>}
                      </h3>
                      <p className="text-gray-500 text-sm">
                        {Math.round(totals.calories)} cal | P:{Math.round(totals.protein)}g C:{Math.round(totals.carbs)}g F:{Math.round(totals.fat)}g
                      </p>
                    </div>
                  </div>

                  {MEAL_TYPES.map((mealType) => {
                    const meals = getMealsForDay(viewingPlan, date, mealType)

                    return (
                      <div key={mealType} className="mb-3 last:mb-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-400 text-sm capitalize">{mealType.toLowerCase()}</span>
                          <button
                            onClick={() => {
                              setSelectedDay(date)
                              setSelectedMealType(mealType)
                              setShowAddMealModal(true)
                            }}
                            className="text-accent text-sm"
                          >
                            + Add
                          </button>
                        </div>

                        {meals.length > 0 ? (
                          <div className="space-y-2">
                            {meals.map((meal) => (
                              <div key={meal.id} className="flex items-center justify-between bg-dark-elevated p-2 rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm truncate">
                                    {meal.recipe?.name || meal.customFoodName}
                                  </p>
                                  <p className="text-gray-500 text-xs">
                                    {Math.round((meal.recipe?.calories || meal.customCalories || 0) * (meal.servings || 1))} cal
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleRemoveMeal(meal.id)}
                                  className="p-1 text-gray-500 hover:text-error"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs">No meals planned</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Plan List View */
        <>
          {/* Current Plan */}
          {currentPlan && (
            <div className="card bg-accent/10 border border-accent/30">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-medium">Active Plan</h3>
                <span className="text-accent text-xs">Current</span>
              </div>
              <p className="text-lg text-white font-semibold">{currentPlan.name}</p>
              <p className="text-gray-400 text-sm">
                {formatDate(currentPlan.startDate)} - {formatDate(currentPlan.endDate)}
              </p>
              <button
                onClick={() => setViewingPlan(currentPlan)}
                className="btn-primary mt-3 w-full"
              >
                View Plan
              </button>
            </div>
          )}

          {/* All Plans */}
          {mealPlans.length === 0 ? (
            <div className="card text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-400">No meal plans yet</p>
              <p className="text-gray-500 text-sm mt-1">Create a plan to organize your weekly meals</p>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary mt-4">
                Create Your First Plan
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-white font-medium">All Plans</h3>
              {mealPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="card cursor-pointer hover:bg-dark-elevated transition-colors"
                  onClick={() => setViewingPlan(plan)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-white font-medium">{plan.name}</h4>
                      <p className="text-gray-500 text-sm">
                        {formatDate(plan.startDate)} - {formatDate(plan.endDate)}
                      </p>
                    </div>
                    <span className="text-gray-500 text-sm">{plan._count?.meals || 0} meals</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div
            className="bg-dark-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">New Meal Plan</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-dark-elevated rounded-lg">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Plan Name *</label>
                <input type="text" name="name" required className="input w-full" placeholder="e.g., Week 1 Cut" />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Description</label>
                <textarea name="description" rows={2} className="input w-full" placeholder="Optional description..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Start Date *</label>
                  <input type="date" name="startDate" required defaultValue={getDefaultDates().start} className="input w-full" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">End Date *</label>
                  <input type="date" name="endDate" required defaultValue={getDefaultDates().end} className="input w-full" />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Daily Targets (optional)</label>
                <div className="grid grid-cols-4 gap-2">
                  <input type="number" name="targetCalories" placeholder="Cal" className="input" />
                  <input type="number" name="targetProtein" placeholder="P (g)" className="input" />
                  <input type="number" name="targetCarbs" placeholder="C (g)" className="input" />
                  <input type="number" name="targetFat" placeholder="F (g)" className="input" />
                </div>
              </div>

              <button type="submit" className="btn-primary w-full">Create Plan</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Meal Modal */}
      {showAddMealModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowAddMealModal(false)}>
          <div
            className="bg-dark-card w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Add {selectedMealType?.toLowerCase()}</h2>
                  <p className="text-gray-500 text-sm">{formatDate(selectedDay)}</p>
                </div>
                <button onClick={() => setShowAddMealModal(false)} className="p-2 hover:bg-dark-elevated rounded-lg">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-6">
              {/* Your Recipes */}
              {recipes.length > 0 && (
                <div>
                  <h3 className="text-white font-medium mb-3">Your Recipes</h3>
                  <div className="space-y-2">
                    {recipes.map((recipe) => (
                      <button
                        key={recipe.id}
                        onClick={() => handleAddMeal(recipe)}
                        className="w-full text-left flex items-center justify-between bg-dark-elevated p-3 rounded-xl hover:bg-dark-border transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate">{recipe.name}</p>
                          {recipe.description && (
                            <p className="text-gray-500 text-sm truncate">{recipe.description}</p>
                          )}
                        </div>
                        {recipe.calories && (
                          <span className="text-gray-400 text-sm ml-3">{Math.round(recipe.calories)} cal</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Entry */}
              <div className="border-t border-dark-border pt-4">
                <h3 className="text-white font-medium mb-3">Or add custom meal</h3>
                <form onSubmit={handleAddCustomMeal} className="space-y-3">
                  <input type="text" name="name" placeholder="Meal name" required className="input w-full" />
                  <div className="grid grid-cols-4 gap-2">
                    <input type="number" name="calories" placeholder="Cal" className="input" />
                    <input type="number" name="protein" placeholder="P (g)" className="input" />
                    <input type="number" name="carbs" placeholder="C (g)" className="input" />
                    <input type="number" name="fat" placeholder="F (g)" className="input" />
                  </div>
                  <button type="submit" className="btn-primary w-full">Add Custom Meal</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MealPlans
