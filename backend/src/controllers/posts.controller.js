import prisma from "../config/prisma.js";
import { analyzeContent } from "../services/ai.service.js";
import sanitizeHtml from "sanitize-html";
import { safeWaitUntil } from "../utils/lifecycle.js";

// Phase 3 Fix #13: Strip-all HTML sanitisation.
function sanitizeContent(raw) {
  return sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} });
}

async function analyzeAndModeratePost(postId, content) {
  try {
    const aiResult = await analyzeContent(content);

    if (aiResult.isFlagged) {
      // Soft-delete the post and create moderation log in a transaction
      await prisma.$transaction([
        prisma.post.update({
          where: { id: postId },
          data: { isDeleted: true }
        }),
        prisma.moderationLog.create({
          data: {
            targetPostId: postId,
            actionTaken: "blocked",
            reason: aiResult.flagReason,
            aiFlags: JSON.stringify(aiResult.flags),
            originalContentSnapshot: content
          }
        })
      ]);
      console.log(`[Moderation] Post ${postId} flagged and soft-deleted.`);
    } else {
      // Save labels and sentiment analysis on the post
      await prisma.post.update({
        where: { id: postId },
        data: {
          aiLabels: JSON.stringify(aiResult.labels),
          sentimentAnalysis: JSON.stringify(aiResult.sentiment)
        }
      });
    }
  } catch (err) {
    console.error(`Error in background post moderation for ${postId}:`, err);
  }
}


import { findVisiblePost, visiblePosts, publicAuthor, publicMedia, serializePost, unexpired } from "../services/postPolicy.js";

const includePost = (viewerId) => ({
  user: { select: publicAuthor }, media: { select: publicMedia },
  _count: { select: { comments: { where: { isDeleted: false } }, reactions: true } },
  reactions: { where: { userId: viewerId || "", reactionType: "heart" }, select: { userId: true, reactionType: true } },
  pollVotes: { select: { userId: true, optionIndex: true } },
});

async function formatPosts(posts, viewerId) {
  const ids = [...new Set(posts.map(p => p.sharedPostId).filter(Boolean))];
  const shared = ids.length ? await prisma.post.findMany({
    where: { id: { in: ids }, ...visiblePosts(viewerId) }, include: includePost(viewerId),
  }) : [];
  const byId = new Map(shared.map(p => [p.id, p]));
  return posts.map(p => serializePost({ ...p, sharedPost: byId.get(p.sharedPostId) ?? null }, viewerId));
}

export async function createPost(req, res) {
  try {
    const { category, mode, mediaId, sharedPostId, audience = "everyone", lifetime = "forever",
      selectedHandles = [], engagement = {}, pollOptions = [], isAiModifiedMedia = false } = req.body;
    const content = sanitizeContent(req.body.content || "");
    if ((!content && !mediaId) || content.length > 500) return res.status(400).json({ error: "Provide text (up to 500 characters) or verified media." });
    if ((req.body.storagePath || req.body.mediaUrl || req.body.thumbStoragePath) && !mediaId) {
      return res.status(400).json({ error: "Attach verified media by mediaId." });
    }
    if (sharedPostId) {
      const shared = await findVisiblePost(sharedPostId, req.user.id);
      if (!shared) return res.status(404).json({ error: "Shared post not found." });
      if (!shared.allowReposts) return res.status(403).json({ error: "The author disabled reposts." });
    }
    const recipients = audience === "selected" ? await prisma.user.findMany({
      where: { handle: { in: selectedHandles }, isBanned: false }, select: { id: true },
    }) : [];
    if (audience === "selected" && (recipients.length !== selectedHandles.length || !recipients.length)) {
      return res.status(400).json({ error: "Choose valid recipient handles for a selected audience." });
    }
    const days = { "24h": 1, "7d": 7, "30d": 30 };
    const post = await prisma.$transaction(async tx => {
      // Serialize attachment with media/account deletion and quota changes.
      if (mediaId) {
        await tx.$queryRaw`SELECT id FROM "Media" WHERE id = ${mediaId} FOR UPDATE`;
        const owned = await tx.media.findFirst({ where: {
          id: mediaId, userId: req.user.id, status: "ready", purpose: "post", ...unexpired(),
        } });
        if (!owned) throw Object.assign(new Error("Media is unavailable or does not belong to you."), { status: 403 });
      }
      return tx.post.create({ data: {
        ownerId: req.user.id, userId: mode === "full" || audience === "anonymous_feed" ? null : req.user.id,
        content, category, mediaId: mediaId || null, sharedPostId: sharedPostId || null,
        audience, allowedUserIds: recipients.map(u => u.id),
        expiresAt: days[lifetime] ? new Date(Date.now() + days[lifetime] * 86400000) : null,
        allowReplies: engagement.allowReplies ?? true, allowReactions: engagement.allowReactions ?? true,
        allowReposts: engagement.allowReposts ?? true, anonymousReplies: engagement.anonymousReplies ?? false,
        isAiModifiedMedia, pollOptions,
      }, include: includePost(req.user.id) });
    });
    if (content) safeWaitUntil(analyzeAndModeratePost(post.id, content));
    return res.status(201).json((await formatPosts([post], req.user.id))[0]);
  } catch (error) {
    console.error("Create post failed:", error.message);
    return res.status(error.status || 500).json({ error: error.status ? error.message : "Failed to create post." });
  }
}

export async function getFeed(req, res) {
  try {
    const page = Math.min(10000, Math.max(1, parseInt(req.query.page, 10) || 1));
    const take = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const where = visiblePosts(req.user?.id);
    if (req.query.category && req.query.category !== "All") where.category = String(req.query.category);
    if (req.query.userId) where.userId = String(req.query.userId);
    if (req.query.handle) where.user = { handle: String(req.query.handle).replace(/^@/, "") };
    if (req.query.mine === "true" && req.user) where.ownerId = req.user.id;
    if (req.query.hasMedia === "true") where.media = { status: "ready", ...unexpired() };
    if (req.query.synthetic === "true") where.isAiModifiedMedia = true;
    const posts = await prisma.post.findMany({ where, skip: (page - 1) * take, take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: includePost(req.user?.id) });
    return res.json(await formatPosts(posts, req.user?.id));
  } catch (error) {
    console.error("Feed failed:", error.message);
    return res.status(500).json({ error: "Failed to retrieve posts." });
  }
}

export async function getPostDetails(req, res) {
  try {
    const post = await findVisiblePost(req.params.id, req.user?.id, { include: includePost(req.user?.id) });
    if (!post) return res.status(404).json({ error: "Post not found." });
    return res.json((await formatPosts([post], req.user?.id))[0]);
  } catch (error) { return res.status(500).json({ error: "Failed to retrieve post." }); }
}

export async function deletePost(req, res) {
  const deleted = await prisma.post.updateMany({ where: { id: req.params.id, ownerId: req.user.id, isDeleted: false }, data: { isDeleted: true } });
  if (!deleted.count) return res.status(404).json({ error: "Post not found or not owned by you." });
  return res.json({ success: true });
}

export async function voteOnPoll(req, res) {
  const post = await findVisiblePost(req.params.id, req.user.id);
  const index = req.body.optionIndex;
  if (!post) return res.status(404).json({ error: "Post not found." });
  if (!Number.isInteger(index) || index < 0 || index >= post.pollOptions.length) return res.status(400).json({ error: "Choose a valid poll option." });
  await prisma.pollVote.upsert({ where: { postId_userId: { postId: post.id, userId: req.user.id } },
    create: { postId: post.id, userId: req.user.id, optionIndex: index }, update: { optionIndex: index } });
  return getPostDetails(req, res);
}

export async function getTrendingTopics(req, res) {
  try {
    const groups = await prisma.post.groupBy({ by: ["category"], where: { ...visiblePosts(null), createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      _count: { _all: true }, orderBy: { _count: { category: "desc" } }, take: 5 });
    return res.json(groups.map((g, index) => ({ id: index + 1, title: g.category, posts: g._count._all + " posts this week", gradient: "from-purple-500/20 to-indigo-500/20" })));
  } catch (error) { return res.status(500).json({ error: "Failed to retrieve trending topics." }); }
}
