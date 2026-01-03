-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "totalPausedTime" INTEGER NOT NULL DEFAULT 0;
