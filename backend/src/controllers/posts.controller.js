import prisma from "../config/prisma.js";
import { analyzeContent } from "../services/ai.service.js";

/**
 * Create a new post.
 * POST /v1/posts
 */
export async function createPost(req, res) {
  try {
    const { content, category, mode, mediaUrl } = req.body;

    if (!content || !category) {
      return res.status(400).json({ error: "Content and category are required." });
    }

    if (content.length > 500) {
      return res.status(400).json({ error: "Content exceeds 500 characters limit." });
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
        error: "Post blocked by content moderation policy.",
        moderation: aiResult
      });
    }

    // Handle anonymity mode:
    // If mode is 'full' (Full Anonymity), we store NULL for userId in database
    // If mode is 'pseudo' (Pseudonymous), we store req.user.id
    const postUserId = mode === "full" ? null : req.user.id;

    const post = await prisma.post.create({
      data: {
        userId: postUserId,
        content,
        category,
        mediaUrl,
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
    return res.status(500).json({ error: "Failed to create post." });
  }
}

/**
 * Get posts feed.
 * GET /v1/posts
 */
export async function getFeed(req, res) {
  try {
    const { category, page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

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

    // Format posts to make them frontend-friendly (e.g. include reaction counts)
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
    return res.status(500).json({ error: "Failed to retrieve feed posts." });
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
      return res.status(404).json({ error: "Post not found or has been deleted." });
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
    return res.status(500).json({ error: "Failed to retrieve post details." });
  }
}
