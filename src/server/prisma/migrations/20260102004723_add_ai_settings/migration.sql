-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "globalOpenaiApiKey" TEXT,
ADD COLUMN     "globalOpenaiEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "aiFormTips" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "aiNutritionAdvice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiProgressAnalysis" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "aiWorkoutSuggestions" BOOLEAN NOT NULL DEFAULT true;
