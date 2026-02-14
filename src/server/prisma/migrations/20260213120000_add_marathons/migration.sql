-- CreateTable
CREATE TABLE "marathons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'run',
    "difficulty" TEXT NOT NULL DEFAULT 'intermediate',
    "routeData" JSONB NOT NULL,
    "milestones" JSONB,
    "imageUrl" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT true,
    "isPassive" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marathons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_marathons" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marathonId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentDistance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPassive" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_marathons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marathon_entries" (
    "id" TEXT NOT NULL,
    "userMarathonId" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER,
    "notes" TEXT,
    "sessionId" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marathon_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_marathons_userId_marathonId_key" ON "user_marathons"("userId", "marathonId");

-- AlterEnum (add MARATHON to AchievementCategory)
ALTER TYPE "AchievementCategory" ADD VALUE 'MARATHON';

-- AlterEnum (add MARATHONS_COMPLETED to AchievementMetricType)
ALTER TYPE "AchievementMetricType" ADD VALUE 'MARATHONS_COMPLETED';

-- AlterTable (add totalMarathonsCompleted to user_stats)
ALTER TABLE "user_stats" ADD COLUMN "totalMarathonsCompleted" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "user_marathons" ADD CONSTRAINT "user_marathons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_marathons" ADD CONSTRAINT "user_marathons_marathonId_fkey" FOREIGN KEY ("marathonId") REFERENCES "marathons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marathon_entries" ADD CONSTRAINT "marathon_entries_userMarathonId_fkey" FOREIGN KEY ("userMarathonId") REFERENCES "user_marathons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
