import prisma from "../config/prisma.js";
import { postMediaUrl } from "../utils/mediaTickets.js";

/** Parses a JSON-encoded list column (SQLite has no scalar lists). */
export function parseList(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export const unexpired = (now = new Date()) => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });

// A circle is the author's current followed accounts, as described in the UI.
export function visiblePosts(userId, now = new Date()) {
  return {
    AND: [
      { isDeleted: false },
      unexpired(now),
      { OR: [{ owner: null }, { owner: { isBanned: false } }] },
      { OR: [
        { audience: { in: ["everyone", "anonymous_feed"] } },
        ...(userId ? [
          { ownerId: userId },
          // allowedUserIds is a JSON array of UUIDs; the quoted UUID cannot match a substring of another id.
          { audience: "selected", allowedUserIds: { contains: `"${userId}"` } },
          { audience: "circle", owner: { following: { some: { followingId: userId } } } },
        ] : []),
      ] },
    ],
  };
}

export async function findVisiblePost(id, userId, extra = {}) {
  return prisma.post.findFirst({ where: { id, ...visiblePosts(userId) }, ...extra });
}

export const publicAuthor = { id: true, handle: true, avatarUrl: true };
export const publicMedia = { type: true, status: true, expiresAt: true };

export function serializePost(post, viewerId) {
  const mediaReady = post.media?.status === "ready" && (!post.media.expiresAt || post.media.expiresAt > new Date());
  return {
    id: post.id, userId: post.userId, user: post.user ?? null,
    content: post.content, category: post.category, createdAt: post.createdAt,
    isDeleted: false, audience: post.audience, expiresAt: post.expiresAt,
    canDelete: !!viewerId && post.ownerId === viewerId,
    allowReplies: post.allowReplies, allowReactions: post.allowReactions,
    allowReposts: post.allowReposts, anonymousReplies: post.anonymousReplies,
    isAiModifiedMedia: post.isAiModifiedMedia,
    aiLabels: post.aiLabels, sentimentAnalysis: post.sentimentAnalysis,
    media: mediaReady ? { type: post.media.type } : null,
    mediaStreamUrl: mediaReady ? postMediaUrl(post.id) : null,
    thumbStreamUrl: mediaReady && post.media.type === "VIDEO" ? postMediaUrl(post.id, true) : null,
    reactionCount: post._count?.reactions ?? 0,
    commentCount: post._count?.comments ?? 0,
    userHasReacted: post.reactions?.some(r => r.userId === viewerId && r.reactionType === "heart") ?? false,
    sharedPostId: post.sharedPost?.id ?? null,
    sharedPost: post.sharedPost ? serializePost(post.sharedPost, viewerId) : null,
    pollOptions: parseList(post.pollOptions).map((text, index) => ({ text, votes: post.pollVotes?.filter(v => v.optionIndex === index).length ?? 0 })),
    votedOption: post.pollVotes?.find(v => v.userId === viewerId)?.optionIndex ?? null,
  };
}
