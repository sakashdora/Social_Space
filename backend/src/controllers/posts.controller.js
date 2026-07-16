import prisma from "../config/prisma.js";
import { analyzeContent } from "../services/ai.service.js";
import sanitizeHtml from "sanitize-html";

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

/**
 * Create a new post.
 * POST /v1/posts
 */
export async function createPost(req, res) {
  try {
    const { content: rawContent, category, mode, mediaUrl } = req.body;

    if (!rawContent || !category) {
      return res.status(400).json({
        error: {
          message: "Content and category are required.",
          code: "BAD_REQUEST",
        },
      });
    }

    // Sanitize before any further processing
    const content = sanitizeContent(rawContent);

    if (content.length > 500) {
      return res.status(400).json({
        error: {
          message: "Content exceeds 500 characters limit.",
          code: "CONTENT_TOO_LONG",
        },
      });
    }

    // Handle anonymity mode:
    const postUserId = mode === "full" ? null : req.user.id;

    let mediaId = null;
    if (mediaUrl) {
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = mediaUrl.match(uuidRegex);
      if (match) {
        const extractedMediaId = match[0];
        const mediaRecord = await prisma.media.findUnique({
          where: { id: extractedMediaId }
        });
        if (mediaRecord) {
          mediaId = mediaRecord.id;
        }
      }
    }

    const post = await prisma.post.create({
      data: {
        userId: postUserId,
        content,
        category,
        mediaUrl,
        mediaId,
        aiLabels: null,
        sentimentAnalysis: null,
      },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            avatarUrl: true
          }
        }
      }
    });

    // Run background AI moderation (non-blocking)
    analyzeAndModeratePost(post.id, content).catch((err) => {
      console.error(`Background post moderation fail-to-launch for ${post.id}:`, err);
    });

    return res.status(201).json(post);
  } catch (error) {
    console.error("Create post error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to create post.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * Get posts feed.
 * GET /v1/posts
 */
export async function getFeed(req, res) {
  try {
    const { category, page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * Math.min(parseInt(limit) || 10, 50);
    const take = Math.min(parseInt(limit) || 10, 50);

    const where = {
      isDeleted: false
    };

    if (category && category !== "All") {
      where.category = category;
    }

    const posts = await prisma.post.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: "desc"
      },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            avatarUrl: true
          }
        },
        media: {
          select: {
            type: true,
            thumbnailPath: true
          }
        },
        _count: {
          select: {
            comments: true,
            reactions: true
          }
        }
      }
    });

    const formattedPosts = posts.map(p => ({
      id: p.id,
      // NOTE: userId intentionally omitted — use user.id for identity.
      // Fully-anonymous posts (mode=full) have userId=null in DB; the user join is
      // also null, so there is no way to recover the author's identity from this response.
      content: p.content,
      category: p.category,
      mediaUrl: p.mediaUrl,
      mediaId: p.mediaId,
      sharedPostId: p.sharedPostId,
      isDeleted: p.isDeleted,
      isAiModifiedMedia: p.isAiModifiedMedia,
      aiLabels: p.aiLabels ? JSON.parse(p.aiLabels) : null,
      sentimentAnalysis: p.sentimentAnalysis ? JSON.parse(p.sentimentAnalysis) : null,
      createdAt: p.createdAt,
      user: p.user ?? null,
      media: p.media ?? null,
      commentCount: p._count.comments,
      reactionCount: p._count.reactions,
    }));

    return res.status(200).json(formattedPosts);
  } catch (error) {
    console.error("Get feed error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to retrieve feed posts.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * Get single post details with its comments.
 * GET /v1/posts/:id
 */
export async function getPostDetails(req, res) {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            avatarUrl: true
          }
        },
        comments: {
          where: { isDeleted: false },
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                avatarUrl: true
              }
            }
          }
        },
        reactions: true
      }
    });

    if (!post || post.isDeleted) {
      return res.status(404).json({
        error: {
          message: "Post not found or has been deleted.",
          code: "NOT_FOUND",
        },
      });
    }

    const formattedPost = {
      ...post,
      aiLabels: post.aiLabels ? JSON.parse(post.aiLabels) : null,
      sentimentAnalysis: post.sentimentAnalysis ? JSON.parse(post.sentimentAnalysis) : null,
      commentCount: post.comments.length,
      reactionCount: post.reactions.length,
    };

    return res.status(200).json(formattedPost);
  } catch (error) {
    console.error("Get post details error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to retrieve post details.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * Delete a post (soft delete).
 * DELETE /v1/posts/:id
 */
export async function deletePost(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({
      where: { id }
    });

    if (!post || post.isDeleted) {
      return res.status(404).json({
        error: {
          message: "Post not found or already deleted.",
          code: "NOT_FOUND",
        },
      });
    }

    // Check authorization: user must be the author (only possible for non-anonymous posts where userId !== null)
    if (post.userId !== userId) {
      return res.status(403).json({
        error: {
          message: "You are not authorized to delete this post.",
          code: "FORBIDDEN",
        },
      });
    }

    // Soft delete by setting isDeleted to true
    await prisma.post.update({
      where: { id },
      data: { isDeleted: true }
    });

    return res.status(200).json({ success: true, message: "Post deleted successfully." });
  } catch (error) {
    console.error("Delete post error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to delete post.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * Retrieve trending topics (hashtags, categories, AI labels).
 * GET /v1/posts/trending
 */
export async function getTrendingTopics(req, res) {
  try {
    const posts = await prisma.post.findMany({
      where: { isDeleted: false },
      select: {
        content: true,
        category: true,
        aiLabels: true
      }
    });

    const frequencyMap = {};

    const defaultTopics = [
      { id: 1, title: "AI is changing the world", posts: 12500, gradient: "from-purple-500/20 to-indigo-500/20" },
      { id: 2, title: "Healing in silence", posts: 9800, gradient: "from-blue-500/20 to-cyan-500/20" },
      { id: 3, title: "Late night thoughts", posts: 8200, gradient: "from-pink-500/20 to-rose-500/20" },
      { id: 4, title: "Building in public", posts: 6700, gradient: "from-amber-500/20 to-orange-500/20" },
      { id: 5, title: "The power of mindset", posts: 5300, gradient: "from-teal-500/20 to-emerald-500/20" }
    ];

    const gradients = [
      "from-purple-500/20 to-indigo-500/20",
      "from-blue-500/20 to-cyan-500/20",
      "from-pink-500/20 to-rose-500/20",
      "from-amber-500/20 to-orange-500/20",
      "from-teal-500/20 to-emerald-500/20"
    ];

    const addTopic = (name, count = 1) => {
      if (!name) return;
      const cleanName = name.trim();
      if (!cleanName || cleanName.length < 2) return;
      const key = cleanName.toLowerCase();
      if (frequencyMap[key]) {
        frequencyMap[key].count += count;
      } else {
        frequencyMap[key] = {
          title: cleanName,
          count: count
        };
      }
    };

    for (const post of posts) {
      if (post.category) {
        addTopic(post.category);
      }

      const hashtagRegex = /#([a-zA-Z0-9_-]+)/g;
      let match;
      while ((match = hashtagRegex.exec(post.content)) !== null) {
        addTopic(`#${match[1]}`);
      }

      if (post.aiLabels) {
        try {
          const labels = JSON.parse(post.aiLabels);
          if (Array.isArray(labels)) {
            labels.forEach(label => addTopic(label));
          } else if (labels && Array.isArray(labels.labels)) {
            labels.labels.forEach(label => addTopic(label));
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    }

    let topics = Object.values(frequencyMap).sort((a, b) => b.count - a.count);

    const mergedTopicsMap = {};
    
    topics.forEach(t => {
      mergedTopicsMap[t.title.toLowerCase()] = {
        title: t.title,
        postsCount: t.count
      };
    });

    let backfillIndex = 0;
    while (Object.keys(mergedTopicsMap).length < 5 && backfillIndex < defaultTopics.length) {
      const def = defaultTopics[backfillIndex];
      const key = def.title.toLowerCase();
      if (!mergedTopicsMap[key]) {
        mergedTopicsMap[key] = {
          title: def.title,
          postsCount: def.posts
        };
      }
      backfillIndex++;
    }

    const finalTopics = Object.values(mergedTopicsMap)
      .sort((a, b) => b.postsCount - a.postsCount)
      .slice(0, 5);

    const result = finalTopics.map((t, idx) => {
      const gradient = gradients[idx % gradients.length];
      let postsStr = `${t.postsCount} posts`;
      if (t.postsCount >= 1000) {
        postsStr = `${(t.postsCount / 1000).toFixed(1).replace(/\.0$/, "")}K posts`;
      }
      return {
        id: idx + 1,
        title: t.title,
        posts: postsStr,
        gradient: gradient
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get trending topics error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to retrieve trending topics.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

