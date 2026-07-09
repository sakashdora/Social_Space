import prisma from "../config/prisma.js";
import { analyzeContent } from "../services/ai.service.js";
import sanitizeHtml from "sanitize-html";

// Phase 3 Fix #13: Strip-all HTML sanitisation.
function sanitizeContent(raw) {
  return sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} });
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

    // Call AI service for moderation, sentiment and tagging
    const aiResult = await analyzeContent(content);

    if (aiResult.isFlagged) {
      // Create a moderation log first for record
      await prisma.moderationLog.create({
        data: {
          actionTaken: "blocked",
          reason: aiResult.flagReason,
          aiFlags: JSON.stringify(aiResult.flags),
          originalContentSnapshot: content
        }
      });

      return res.status(400).json({
        error: {
          message: "Post blocked by content moderation policy.",
          code: "MODERATION_BLOCKED",
        },
        moderation: aiResult
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
        aiLabels: JSON.stringify(aiResult.labels),
        sentimentAnalysis: JSON.stringify(aiResult.sentiment),
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
        _count: {
          select: {
            comments: true,
            reactions: true
          }
        }
      }
    });

    const formattedPosts = posts.map(p => ({
      ...p,
      aiLabels: p.aiLabels ? JSON.parse(p.aiLabels) : null,
      sentimentAnalysis: p.sentimentAnalysis ? JSON.parse(p.sentimentAnalysis) : null,
      commentCount: p._count.comments,
      reactionCount: p._count.reactions,
      _count: undefined
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
