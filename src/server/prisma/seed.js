import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@homefit.local' },
    update: {},
    create: {
      email: 'admin@homefit.local',
      username: 'admin',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
      settings: {
        create: {}
      }
    }
  })

  console.log('Created admin user:', admin.email)

  // Create demo user
  const demoPassword = await bcrypt.hash('demo1234', 12)

  const demo = await prisma.user.upsert({
    where: { email: 'demo@homefit.local' },
    update: {},
    create: {
      email: 'demo@homefit.local',
      username: 'demo',
      password: demoPassword,
      name: 'Demo User',
      role: 'USER',
      trainingStyle: 'BODYBUILDING',
      settings: {
        create: {
          showRestTimer: true,
          defaultRestTime: 90,
          weightUnit: 'LBS'
        }
      }
    }
  })

  console.log('Created demo user:', demo.email)

  // Create demo weekly schedule
  const daysOfWeek = [
    { day: 1, name: 'Push Day', exercises: ['Bench Press', 'Overhead Press', 'Tricep Dips'] },
    { day: 2, name: 'Pull Day', exercises: ['Pull-ups', 'Barbell Rows', 'Bicep Curls'] },
    { day: 3, name: 'Leg Day', exercises: ['Squats', 'Romanian Deadlift', 'Leg Press'] },
    { day: 4, name: 'Rest', isRest: true },
    { day: 5, name: 'Upper Body', exercises: ['Bench Press', 'Rows', 'Shoulder Press'] },
    { day: 6, name: 'Lower Body', exercises: ['Deadlift', 'Lunges', 'Calf Raises'] },
    { day: 0, name: 'Rest', isRest: true },
  ]

  for (const schedule of daysOfWeek) {
    await prisma.weeklySchedule.upsert({
      where: {
        userId_dayOfWeek: {
          userId: demo.id,
          dayOfWeek: schedule.day
        }
      },
      update: {},
      create: {
        userId: demo.id,
        dayOfWeek: schedule.day,
        name: schedule.name,
        isRestDay: schedule.isRest || false,
        exercises: schedule.exercises ? {
          create: schedule.exercises.map((name, i) => ({
            exerciseId: `demo-${name.toLowerCase().replace(/\s/g, '-')}`,
            exerciseName: name,
            sets: 4,
            reps: '8-12',
            order: i
          }))
        } : undefined
      }
    })
  }

  console.log('Created demo schedule')

  // Create app settings
  await prisma.appSettings.upsert({
    where: { id: '1' },
    update: {},
    create: {
      appName: 'HomeFit',
      primaryColor: '#0a84ff',
      accentColor: '#30d158'
    }
  })

  console.log('Created app settings')

  // Create goal achievements
  const goalAchievements = [
    // Total goals completed
    { name: 'Goal Setter', description: 'Complete your first goal', icon: '🎯', category: 'GOALS', metricType: 'TOTAL_GOALS_COMPLETED', threshold: 1, points: 25, rarity: 'COMMON', sortOrder: 1 },
    { name: 'Goal Crusher', description: 'Complete 5 goals', icon: '💪', category: 'GOALS', metricType: 'TOTAL_GOALS_COMPLETED', threshold: 5, points: 50, rarity: 'UNCOMMON', sortOrder: 2 },
    { name: 'Goal Machine', description: 'Complete 10 goals', icon: '🏆', category: 'GOALS', metricType: 'TOTAL_GOALS_COMPLETED', threshold: 10, points: 100, rarity: 'RARE', sortOrder: 3 },
    { name: 'Goal Legend', description: 'Complete 25 goals', icon: '👑', category: 'GOALS', metricType: 'TOTAL_GOALS_COMPLETED', threshold: 25, points: 250, rarity: 'EPIC', sortOrder: 4 },

    // Weight goals
    { name: 'Weight Winner', description: 'Complete your first weight goal', icon: '⚖️', category: 'GOALS', metricType: 'WEIGHT_GOALS_COMPLETED', threshold: 1, points: 50, rarity: 'UNCOMMON', sortOrder: 5 },
    { name: 'Body Transformer', description: 'Complete 3 weight goals', icon: '🔄', category: 'GOALS', metricType: 'WEIGHT_GOALS_COMPLETED', threshold: 3, points: 150, rarity: 'RARE', sortOrder: 6 },

    // Strength goals
    { name: 'Strength Unlocked', description: 'Complete your first strength PR goal', icon: '🏋️', category: 'GOALS', metricType: 'STRENGTH_GOALS_COMPLETED', threshold: 1, points: 50, rarity: 'UNCOMMON', sortOrder: 7 },
    { name: 'PR Hunter', description: 'Complete 5 strength PR goals', icon: '💥', category: 'GOALS', metricType: 'STRENGTH_GOALS_COMPLETED', threshold: 5, points: 150, rarity: 'RARE', sortOrder: 8 },
    { name: 'Strength Master', description: 'Complete 10 strength PR goals', icon: '🦾', category: 'GOALS', metricType: 'STRENGTH_GOALS_COMPLETED', threshold: 10, points: 300, rarity: 'EPIC', sortOrder: 9 },

    // Cardio goals
    { name: 'Cardio Conqueror', description: 'Complete your first cardio goal', icon: '🏃', category: 'GOALS', metricType: 'CARDIO_GOALS_COMPLETED', threshold: 1, points: 50, rarity: 'UNCOMMON', sortOrder: 10 },
    { name: 'Speed Demon', description: 'Complete 5 cardio goals', icon: '⚡', category: 'GOALS', metricType: 'CARDIO_GOALS_COMPLETED', threshold: 5, points: 150, rarity: 'RARE', sortOrder: 11 },
    { name: 'Endurance Elite', description: 'Complete 10 cardio goals', icon: '🥇', category: 'GOALS', metricType: 'CARDIO_GOALS_COMPLETED', threshold: 10, points: 300, rarity: 'EPIC', sortOrder: 12 },
  ]

  for (const achievement of goalAchievements) {
    const existing = await prisma.achievement.findFirst({
      where: {
        name: achievement.name,
        metricType: achievement.metricType,
        threshold: achievement.threshold
      }
    })

    if (!existing) {
      await prisma.achievement.create({
        data: {
          ...achievement,
          isDefault: true,
          isActive: true
        }
      })
    }
  }

  console.log('Created goal achievements')
  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
