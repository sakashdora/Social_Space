-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MediaType" ADD VALUE 'AUDIO';
ALTER TYPE "MediaType" ADD VALUE 'FILE';

-- DropIndex
DROP INDEX "Reaction_userId_postId_commentId_reactionType_key";

-- Normalize legacy invalid/duplicate reactions before enforcing target uniqueness.
DELETE FROM "Reaction" WHERE ("postId" IS NULL) = ("commentId" IS NULL);
DELETE FROM "Reaction" WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY "userId", "postId", "commentId", "reactionType" ORDER BY "createdAt", id) AS rank
    FROM "Reaction"
  ) duplicates WHERE rank > 1
);
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_exactly_one_target" CHECK (("postId" IS NULL) <> ("commentId" IS NULL));

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "allowReactions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowReplies" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowReposts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "anonymousReplies" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'everyone',
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "isAiModifiedMedia" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "pollOptions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Recover ownership where the existing data already records it. Anonymous text
-- posts with no media cannot be attributed retroactively and remain ownerless.
UPDATE "Post" p SET "ownerId" = COALESCE(p."userId", m."userId") FROM "Media" m WHERE p."mediaId" = m.id;
UPDATE "Post" SET "ownerId" = "userId" WHERE "ownerId" IS NULL AND "userId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "SecurityEvent_userId_createdAt_idx" ON "SecurityEvent"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Post_category_isDeleted_createdAt_idx" ON "Post"("category", "isDeleted", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Post_userId_createdAt_idx" ON "Post"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Comment_postId_isDeleted_createdAt_idx" ON "Comment"("postId", "isDeleted", "createdAt" ASC);

-- AlterTable
ALTER TABLE "Thread" ADD COLUMN     "pairKey" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "mediaId" TEXT;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'post',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ready',
ADD COLUMN     "threadId" TEXT,
ADD COLUMN     "uploadExpiresAt" TIMESTAMP(3),
ADD COLUMN     "uploadPath" TEXT;

-- CreateTable
CREATE TABLE "Follow" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionIndex" INTEGER NOT NULL,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "SafetyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StorageDeletion" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notBefore" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE INDEX "SafetyReport_userId_createdAt_idx" ON "SafetyReport"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Appeal_userId_createdAt_idx" ON "Appeal"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "StorageDeletion_bucket_path_key" ON "StorageDeletion"("bucket", "path");

-- CreateIndex
CREATE INDEX "AuthChallenge_expiresAt_idx" ON "AuthChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "Post_ownerId_createdAt_idx" ON "Post"("ownerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Post_expiresAt_idx" ON "Post"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_postId_reactionType_key" ON "Reaction"("userId", "postId", "reactionType");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_commentId_reactionType_key" ON "Reaction"("userId", "commentId", "reactionType");

-- CreateIndex
CREATE UNIQUE INDEX "Thread_pairKey_key" ON "Thread"("pairKey");

-- CreateIndex
CREATE UNIQUE INDEX "Message_mediaId_key" ON "Message"("mediaId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- API-only tables must not become readable through Supabase's public Data API.
ALTER TABLE "Follow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PollVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SafetyReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appeal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WaitlistEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StorageDeletion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthChallenge" ENABLE ROW LEVEL SECURITY;

