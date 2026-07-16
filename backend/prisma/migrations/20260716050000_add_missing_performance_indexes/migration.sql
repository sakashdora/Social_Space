-- Add missing performance indexes for Message, Media, and ThreadParticipant models
-- These improve retention cron query performance and chat participant lookups

-- Index on Message(threadId, createdAt) for chat message loading
CREATE INDEX IF NOT EXISTS "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt" ASC);

-- Index on Message(expiresAt) for efficient expired message cleanup by cron
CREATE INDEX IF NOT EXISTS "Message_expiresAt_idx" ON "Message"("expiresAt");

-- Index on Media(userId) for user media listing
CREATE INDEX IF NOT EXISTS "Media_userId_idx" ON "Media"("userId");

-- Index on Media(expiresAt) for efficient expired media cleanup by cron
CREATE INDEX IF NOT EXISTS "Media_expiresAt_idx" ON "Media"("expiresAt");

-- Index on ThreadParticipant(userId) for user thread lookups
CREATE INDEX IF NOT EXISTS "ThreadParticipant_userId_idx" ON "ThreadParticipant"("userId");
