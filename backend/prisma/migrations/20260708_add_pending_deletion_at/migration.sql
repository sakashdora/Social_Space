-- Migration: add_pending_deletion_at
-- Created: Phase 3 Fix #12 (July 2026 security remediation)
-- Purpose: Adds a soft-delete grace period flag to the User table.
--          pendingDeletionAt is set at day 23 of inactivity (7-day warning window);
--          the cron hard-deletes at day 30 only accounts where this is non-null.
--
-- Apply with:  npx prisma migrate deploy
-- (After rotating the Supabase DB password in backend/.env)

ALTER TABLE "User" ADD COLUMN "pendingDeletionAt" TIMESTAMP(3);
