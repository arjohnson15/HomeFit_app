-- Disable email notifications for all existing users
-- This migration sets notifyByEmail to false for all UserSettings records

UPDATE "UserSettings" SET "notifyByEmail" = false WHERE "notifyByEmail" = true;
