-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "faviconUrl" TEXT,
ADD COLUMN     "fullLogoUrl" TEXT;

-- CreateTable
CREATE TABLE "exercise_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercise_notes_userId_exerciseId_key" ON "exercise_notes"("userId", "exerciseId");

-- AddForeignKey
ALTER TABLE "exercise_notes" ADD CONSTRAINT "exercise_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
