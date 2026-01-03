import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

// Schema version for backup compatibility
const SCHEMA_VERSION = '1.0'

class BackupService {
  constructor() {
    this.backupDir = path.join(__dirname, '../../backups')
    this.ensureBackupDir()
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true })
    }
    // Create subdirectories
    const subdirs = ['full', 'user', 'settings', 'scheduled']
    subdirs.forEach(dir => {
      const subpath = path.join(this.backupDir, dir)
      if (!fs.existsSync(subpath)) {
        fs.mkdirSync(subpath, { recursive: true })
      }
    })
  }

  // Generate backup filename
  generateFilename(type, userId = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const prefix = type.toLowerCase().replace('_', '-')
    const userSuffix = userId ? `-${userId.slice(0, 8)}` : ''
    return `backup-${prefix}${userSuffix}-${timestamp}.json`
  }

  // Export user data
  async exportUserData(userId) {
    const data = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      type: 'USER_DATA',
      userId,
      data: {}
    }

    // Fetch user (without sensitive fields)
    data.data.user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        trainingStyle: true,
        avatarUrl: true,
        heightCm: true,
        weightKg: true,
        goalWeightKg: true,
        sex: true,
        birthDate: true,
        activityLevel: true,
        createdAt: true
      }
    })

    // Fetch all related data
    data.data.settings = await prisma.userSettings.findUnique({
      where: { userId }
    })

    data.data.weightLogs = await prisma.weightLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' }
    })

    data.data.weeklySchedules = await prisma.weeklySchedule.findMany({
      where: { userId },
      include: { exercises: true }
    })

    data.data.calendarWorkouts = await prisma.calendarWorkout.findMany({
      where: { userId },
      include: { exercises: true }
    })

    data.data.recurringWorkouts = await prisma.recurringWorkout.findMany({
      where: { userId },
      include: { exercises: true }
    })

    data.data.workoutSessions = await prisma.workoutSession.findMany({
      where: { userId },
      include: {
        exerciseLogs: {
          include: { sets: true }
        }
      },
      orderBy: { date: 'desc' }
    })

    data.data.exerciseNotes = await prisma.exerciseNote.findMany({
      where: { userId }
    })

    // Nutrition data
    data.data.recipes = await prisma.recipe.findMany({
      where: { userId },
      include: { ingredients: true }
    })

    data.data.mealPlans = await prisma.mealPlan.findMany({
      where: { userId },
      include: { meals: true }
    })

    data.data.foodLogEntries = await prisma.foodLogEntry.findMany({
      where: { userId },
      orderBy: { date: 'desc' }
    })

    data.data.savedRecipes = await prisma.savedRecipe.findMany({
      where: { userId }
    })

    // Achievements
    data.data.userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true }
    })

    data.data.userStats = await prisma.userStats.findUnique({
      where: { userId }
    })

    return data
  }

  // Save user backup to file and create record
  async createUserBackup(userId) {
    const filename = this.generateFilename('USER_DATA', userId)
    const filepath = 'user/'

    // Create backup record
    const backupRecord = await prisma.backup.create({
      data: {
        type: 'USER_DATA',
        status: 'IN_PROGRESS',
        createdById: userId,
        userId,
        filename,
        filepath,
        schemaVersion: SCHEMA_VERSION
      }
    })

    try {
      const data = await this.exportUserData(userId)

      // Write to file
      const fullPath = path.join(this.backupDir, filepath, filename)
      const jsonContent = JSON.stringify(data, null, 2)
      fs.writeFileSync(fullPath, jsonContent)

      // Get record counts
      const recordCounts = {
        workoutSessions: data.data.workoutSessions?.length || 0,
        exerciseLogs: data.data.workoutSessions?.reduce((sum, s) => sum + (s.exerciseLogs?.length || 0), 0) || 0,
        recipes: data.data.recipes?.length || 0,
        mealPlans: data.data.mealPlans?.length || 0,
        foodLogEntries: data.data.foodLogEntries?.length || 0,
        weightLogs: data.data.weightLogs?.length || 0,
        userAchievements: data.data.userAchievements?.length || 0
      }

      // Update record
      await prisma.backup.update({
        where: { id: backupRecord.id },
        data: {
          status: 'COMPLETED',
          fileSize: Buffer.byteLength(jsonContent),
          tablesIncluded: Object.keys(data.data),
          recordCounts,
          completedAt: new Date()
        }
      })

      return { backup: backupRecord, data }
    } catch (error) {
      await prisma.backup.update({
        where: { id: backupRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message
        }
      })
      throw error
    }
  }

  // Create full system backup
  async createFullBackup(createdById = null, isAutomatic = false, scheduleType = null) {
    const filename = this.generateFilename('FULL_SYSTEM')
    const filepath = isAutomatic ? 'scheduled/' : 'full/'

    const backupRecord = await prisma.backup.create({
      data: {
        type: 'FULL_SYSTEM',
        status: 'IN_PROGRESS',
        createdById,
        filename,
        filepath,
        schemaVersion: SCHEMA_VERSION,
        isAutomatic,
        scheduleType
      }
    })

    try {
      const data = {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        type: 'FULL_SYSTEM',
        data: {},
        recordCounts: {}
      }

      // Export all users (without passwords)
      data.data.users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          trainingStyle: true,
          avatarUrl: true,
          heightCm: true,
          weightKg: true,
          goalWeightKg: true,
          sex: true,
          birthDate: true,
          activityLevel: true,
          active: true,
          createdAt: true,
          updatedAt: true
        }
      })
      data.recordCounts.users = data.data.users.length

      // Export all other tables
      const tables = [
        'userSettings',
        'weightLog',
        'weeklySchedule',
        'calendarWorkout',
        'scheduledExercise',
        'recurringWorkout',
        'recurringExercise',
        'workoutSession',
        'exerciseLog',
        'set',
        'friendship',
        'exerciseNote',
        'recipe',
        'recipeIngredient',
        'mealPlan',
        'plannedMeal',
        'foodLogEntry',
        'savedRecipe',
        'recipeShare',
        'mealPlanShare',
        'achievement',
        'userAchievement',
        'userStats',
        'appSettings',
        'pushSubscription',
        'feedback'
      ]

      for (const table of tables) {
        try {
          data.data[table] = await prisma[table].findMany()
          data.recordCounts[table] = data.data[table].length
        } catch (e) {
          // Table might not exist or have issues
          data.data[table] = []
          data.recordCounts[table] = 0
        }
      }

      // Write to file
      const fullPath = path.join(this.backupDir, filepath, filename)
      const jsonContent = JSON.stringify(data, null, 2)
      fs.writeFileSync(fullPath, jsonContent)

      // Update record
      await prisma.backup.update({
        where: { id: backupRecord.id },
        data: {
          status: 'COMPLETED',
          fileSize: Buffer.byteLength(jsonContent),
          tablesIncluded: Object.keys(data.data),
          recordCounts: data.recordCounts,
          completedAt: new Date()
        }
      })

      return backupRecord
    } catch (error) {
      await prisma.backup.update({
        where: { id: backupRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message
        }
      })
      throw error
    }
  }

  // Create settings backup
  async createSettingsBackup(createdById) {
    const filename = this.generateFilename('SETTINGS')
    const filepath = 'settings/'

    const backupRecord = await prisma.backup.create({
      data: {
        type: 'SETTINGS',
        status: 'IN_PROGRESS',
        createdById,
        filename,
        filepath,
        schemaVersion: SCHEMA_VERSION
      }
    })

    try {
      const data = {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        type: 'SETTINGS',
        data: {},
        recordCounts: {}
      }

      // Export app settings
      data.data.appSettings = await prisma.appSettings.findFirst()
      data.recordCounts.appSettings = data.data.appSettings ? 1 : 0

      // Export all user settings
      data.data.userSettings = await prisma.userSettings.findMany()
      data.recordCounts.userSettings = data.data.userSettings.length

      // Export backup schedule
      data.data.backupSchedule = await prisma.backupSchedule.findFirst()
      data.recordCounts.backupSchedule = data.data.backupSchedule ? 1 : 0

      // Write to file
      const fullPath = path.join(this.backupDir, filepath, filename)
      const jsonContent = JSON.stringify(data, null, 2)
      fs.writeFileSync(fullPath, jsonContent)

      // Update record
      await prisma.backup.update({
        where: { id: backupRecord.id },
        data: {
          status: 'COMPLETED',
          fileSize: Buffer.byteLength(jsonContent),
          tablesIncluded: Object.keys(data.data),
          recordCounts: data.recordCounts,
          completedAt: new Date()
        }
      })

      return backupRecord
    } catch (error) {
      await prisma.backup.update({
        where: { id: backupRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message
        }
      })
      throw error
    }
  }

  // Import user data from backup
  async importUserData(userId, backupData, options = {}) {
    const {
      mergeMode = 'replace', // 'replace' | 'merge' | 'skip_existing'
      includeWorkouts = true,
      includeNutrition = true,
      includeSchedules = true,
      includeSettings = true
    } = options

    // Validate schema version
    if (!this.isCompatibleVersion(backupData.schemaVersion)) {
      throw new Error(`Incompatible backup version: ${backupData.schemaVersion}`)
    }

    const results = { imported: {}, skipped: {}, errors: [] }

    try {
      // Import settings
      if (includeSettings && backupData.data.settings) {
        try {
          const settingsData = { ...backupData.data.settings }
          delete settingsData.id
          delete settingsData.userId
          delete settingsData.createdAt
          delete settingsData.updatedAt

          await prisma.userSettings.upsert({
            where: { userId },
            update: settingsData,
            create: { ...settingsData, userId }
          })
          results.imported.settings = 1
        } catch (e) {
          results.errors.push({ table: 'settings', error: e.message })
        }
      }

      // Import weight logs
      if (backupData.data.weightLogs?.length > 0) {
        for (const log of backupData.data.weightLogs) {
          try {
            const logData = {
              userId,
              date: new Date(log.date),
              weightKg: log.weightKg,
              notes: log.notes
            }

            if (mergeMode === 'replace') {
              await prisma.weightLog.upsert({
                where: { userId_date: { userId, date: logData.date } },
                update: logData,
                create: logData
              })
            } else if (mergeMode === 'skip_existing') {
              const existing = await prisma.weightLog.findUnique({
                where: { userId_date: { userId, date: logData.date } }
              })
              if (!existing) {
                await prisma.weightLog.create({ data: logData })
              }
            }
            results.imported.weightLogs = (results.imported.weightLogs || 0) + 1
          } catch (e) {
            results.errors.push({ table: 'weightLogs', error: e.message })
          }
        }
      }

      // Import schedules
      if (includeSchedules) {
        // Weekly schedules
        if (backupData.data.weeklySchedules?.length > 0) {
          if (mergeMode === 'replace') {
            await prisma.weeklySchedule.deleteMany({ where: { userId } })
          }

          for (const schedule of backupData.data.weeklySchedules) {
            try {
              const scheduleData = {
                userId,
                dayOfWeek: schedule.dayOfWeek,
                name: schedule.name,
                isRestDay: schedule.isRestDay
              }

              const created = await prisma.weeklySchedule.create({
                data: scheduleData
              })

              // Import exercises
              if (schedule.exercises?.length > 0) {
                for (const exercise of schedule.exercises) {
                  await prisma.scheduledExercise.create({
                    data: {
                      weeklyScheduleId: created.id,
                      exerciseId: exercise.exerciseId,
                      exerciseName: exercise.exerciseName,
                      sets: exercise.sets,
                      reps: exercise.reps,
                      restSeconds: exercise.restSeconds,
                      notes: exercise.notes,
                      order: exercise.order
                    }
                  })
                }
              }
              results.imported.weeklySchedules = (results.imported.weeklySchedules || 0) + 1
            } catch (e) {
              results.errors.push({ table: 'weeklySchedules', error: e.message })
            }
          }
        }

        // Recurring workouts
        if (backupData.data.recurringWorkouts?.length > 0) {
          if (mergeMode === 'replace') {
            await prisma.recurringWorkout.deleteMany({ where: { userId } })
          }

          for (const workout of backupData.data.recurringWorkouts) {
            try {
              const workoutData = {
                userId,
                name: workout.name,
                type: workout.type,
                intervalDays: workout.intervalDays,
                daysOfWeek: workout.daysOfWeek,
                skipRestDays: workout.skipRestDays,
                isActive: workout.isActive,
                startDate: new Date(workout.startDate),
                lastCompletedDate: workout.lastCompletedDate ? new Date(workout.lastCompletedDate) : null
              }

              const created = await prisma.recurringWorkout.create({
                data: workoutData
              })

              // Import exercises
              if (workout.exercises?.length > 0) {
                for (const exercise of workout.exercises) {
                  await prisma.recurringExercise.create({
                    data: {
                      recurringWorkoutId: created.id,
                      exerciseId: exercise.exerciseId,
                      exerciseName: exercise.exerciseName,
                      sets: exercise.sets,
                      reps: exercise.reps,
                      duration: exercise.duration,
                      distance: exercise.distance,
                      restSeconds: exercise.restSeconds,
                      notes: exercise.notes,
                      order: exercise.order
                    }
                  })
                }
              }
              results.imported.recurringWorkouts = (results.imported.recurringWorkouts || 0) + 1
            } catch (e) {
              results.errors.push({ table: 'recurringWorkouts', error: e.message })
            }
          }
        }
      }

      // Import workouts
      if (includeWorkouts && backupData.data.workoutSessions?.length > 0) {
        for (const session of backupData.data.workoutSessions) {
          try {
            const sessionData = {
              userId,
              name: session.name,
              date: new Date(session.date),
              startTime: new Date(session.startTime),
              endTime: session.endTime ? new Date(session.endTime) : null,
              duration: session.duration,
              notes: session.notes,
              rating: session.rating,
              totalPausedTime: session.totalPausedTime || 0
            }

            const created = await prisma.workoutSession.create({
              data: sessionData
            })

            // Import exercise logs
            if (session.exerciseLogs?.length > 0) {
              for (const log of session.exerciseLogs) {
                const createdLog = await prisma.exerciseLog.create({
                  data: {
                    sessionId: created.id,
                    exerciseId: log.exerciseId,
                    exerciseName: log.exerciseName,
                    order: log.order,
                    notes: log.notes,
                    difficultyRating: log.difficultyRating
                  }
                })

                // Import sets
                if (log.sets?.length > 0) {
                  for (const set of log.sets) {
                    await prisma.set.create({
                      data: {
                        logId: createdLog.id,
                        setNumber: set.setNumber,
                        reps: set.reps,
                        weight: set.weight,
                        duration: set.duration,
                        distance: set.distance,
                        completed: set.completed,
                        isWarmup: set.isWarmup,
                        isPR: set.isPR,
                        rpe: set.rpe,
                        notes: set.notes
                      }
                    })
                  }
                }
              }
            }
            results.imported.workoutSessions = (results.imported.workoutSessions || 0) + 1
          } catch (e) {
            results.errors.push({ table: 'workoutSessions', error: e.message })
          }
        }
      }

      // Import nutrition data
      if (includeNutrition) {
        // Recipes
        if (backupData.data.recipes?.length > 0) {
          for (const recipe of backupData.data.recipes) {
            try {
              const recipeData = {
                userId,
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
                isPublic: false // Don't restore public status
              }

              const created = await prisma.recipe.create({
                data: recipeData
              })

              // Import ingredients
              if (recipe.ingredients?.length > 0) {
                for (const ingredient of recipe.ingredients) {
                  await prisma.recipeIngredient.create({
                    data: {
                      recipeId: created.id,
                      name: ingredient.name,
                      amount: ingredient.amount,
                      unit: ingredient.unit,
                      notes: ingredient.notes,
                      fatSecretFoodId: ingredient.fatSecretFoodId,
                      calories: ingredient.calories,
                      protein: ingredient.protein,
                      carbs: ingredient.carbs,
                      fat: ingredient.fat,
                      order: ingredient.order
                    }
                  })
                }
              }
              results.imported.recipes = (results.imported.recipes || 0) + 1
            } catch (e) {
              results.errors.push({ table: 'recipes', error: e.message })
            }
          }
        }

        // Food log entries
        if (backupData.data.foodLogEntries?.length > 0) {
          for (const entry of backupData.data.foodLogEntries) {
            try {
              await prisma.foodLogEntry.create({
                data: {
                  userId,
                  date: new Date(entry.date),
                  mealType: entry.mealType,
                  name: entry.name,
                  brand: entry.brand,
                  servingSize: entry.servingSize,
                  servings: entry.servings,
                  calories: entry.calories,
                  protein: entry.protein,
                  carbs: entry.carbs,
                  fat: entry.fat,
                  fiber: entry.fiber,
                  sugar: entry.sugar,
                  sodium: entry.sodium,
                  fatSecretFoodId: entry.fatSecretFoodId,
                  notes: entry.notes
                }
              })
              results.imported.foodLogEntries = (results.imported.foodLogEntries || 0) + 1
            } catch (e) {
              results.errors.push({ table: 'foodLogEntries', error: e.message })
            }
          }
        }
      }

      return results
    } catch (error) {
      results.errors.push({ table: 'general', error: error.message })
      return results
    }
  }

  // Check if backup version is compatible
  isCompatibleVersion(version) {
    if (!version) return false
    return version === SCHEMA_VERSION || version.startsWith('1.')
  }

  // Get backup file path
  getBackupFilePath(backup) {
    return path.join(this.backupDir, backup.filepath, backup.filename)
  }

  // Read backup file
  readBackupFile(backup) {
    const filepath = this.getBackupFilePath(backup)
    if (!fs.existsSync(filepath)) {
      throw new Error('Backup file not found')
    }
    const content = fs.readFileSync(filepath, 'utf-8')
    return JSON.parse(content)
  }

  // Delete backup file
  deleteBackupFile(backup) {
    const filepath = this.getBackupFilePath(backup)
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath)
    }
  }

  // List backups for user
  async listUserBackups(userId) {
    return prisma.backup.findMany({
      where: {
        OR: [
          { userId },
          { createdById: userId, type: 'USER_DATA' }
        ],
        status: { not: 'EXPIRED' }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  // List all backups (admin)
  async listAllBackups(options = {}) {
    const { type, status, limit = 50, offset = 0 } = options

    const where = {}
    if (type) where.type = type
    if (status) where.status = status

    const [backups, total] = await Promise.all([
      prisma.backup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.backup.count({ where })
    ])

    return { backups, total }
  }

  // Get backup by ID
  async getBackup(id) {
    return prisma.backup.findUnique({ where: { id } })
  }

  // Delete backup
  async deleteBackup(id) {
    const backup = await prisma.backup.findUnique({ where: { id } })
    if (!backup) throw new Error('Backup not found')

    // Delete file
    this.deleteBackupFile(backup)

    // Delete record
    await prisma.backup.delete({ where: { id } })

    return backup
  }

  // Get or create backup schedule
  async getSchedule() {
    let schedule = await prisma.backupSchedule.findFirst()
    if (!schedule) {
      schedule = await prisma.backupSchedule.create({
        data: { id: '1' }
      })
    }
    return schedule
  }

  // Update backup schedule
  async updateSchedule(data) {
    return prisma.backupSchedule.upsert({
      where: { id: '1' },
      update: data,
      create: { id: '1', ...data }
    })
  }

  // Cleanup expired backups
  async cleanupExpiredBackups() {
    const expired = await prisma.backup.findMany({
      where: {
        expiresAt: { lt: new Date() },
        status: { not: 'EXPIRED' }
      }
    })

    let count = 0
    for (const backup of expired) {
      try {
        this.deleteBackupFile(backup)
        await prisma.backup.update({
          where: { id: backup.id },
          data: { status: 'EXPIRED' }
        })
        count++
      } catch (error) {
        console.error(`Failed to cleanup backup ${backup.id}:`, error)
      }
    }

    return count
  }

  // Get storage usage stats
  async getStorageStats() {
    const backups = await prisma.backup.findMany({
      where: { status: 'COMPLETED' },
      select: { type: true, fileSize: true }
    })

    const stats = {
      totalBackups: backups.length,
      totalSize: 0,
      byType: {
        FULL_SYSTEM: { count: 0, size: 0 },
        USER_DATA: { count: 0, size: 0 },
        SETTINGS: { count: 0, size: 0 }
      }
    }

    for (const backup of backups) {
      const size = backup.fileSize || 0
      stats.totalSize += size
      if (stats.byType[backup.type]) {
        stats.byType[backup.type].count++
        stats.byType[backup.type].size += size
      }
    }

    return stats
  }
}

const backupService = new BackupService()
export default backupService
