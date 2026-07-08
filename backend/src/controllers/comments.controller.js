import prisma from "../config/prisma.js";
import { analyzeContent } from "../services/ai.service.js";

/**
 * Add a comment/reply to a post.
 * POST /v1/posts/:postId/comments
 */
export async function createComment(req, res) {
  try {
    const { postId } = req.params;
    const { content, parentCommentId, mode } = req.body;

    if (!content) {
      return res.status(400).json({
        error: {
          message: "Comment content cannot be empty.",
          code: "BAD_REQUEST",
        },
      });
    }

    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post || post.isDeleted) {
      return res.status(404).json({
        error: {
          message: "Post not found or has been deleted.",
          code: "NOT_FOUND",
        },
      });
    }

    // Run AI content moderation on comment
    const aiResult = await analyzeContent(content);

    if (aiResult.isFlagged) {
      // Log moderation action
      await prisma.moderationLog.create({
        data: {
          actionTaken: "blocked",
          reason: `Comment blocked: ${aiResult.flagReason}`,
          aiFlags: JSON.stringify(aiResult.flags),
          originalContentSnapshot: content
        }
      });

      return res.status(400).json({
        error: {
          message: "Comment blocked by content moderation policy.",
          code: "MODERATION_BLOCKED",
        },
        moderation: aiResult
      });
    }

    // If parentCommentId is provided, verify it exists
    if (parentCommentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentCommentId }
      });
      if (!parentComment || parentComment.isDeleted) {
        return res.status(404).json({
          error: {
            message: "Parent comment not found.",
            code: "NOT_FOUND",
          },
        });
      }
    }

    // Determine comment authorship (fully anonymous or pseudonymous)
    const commentUserId = mode === "full" ? null : req.user.id;

    const comment = await prisma.comment.create({
      data: {
        postId,
        userId: commentUserId,
        parentCommentId: parentCommentId || null,
        content
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

    return res.status(201).json(comment);
  } catch (error) {
    console.error("Create comment error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to create comment.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}

/**
 * Get all comments for a post.
 * GET /v1/posts/:postId/comments
 */
export async function getComments(req, res) {
  try {
    const { postId } = req.params;

    const comments = await prisma.comment.findMany({
      where: {
        postId,
        isDeleted: false
      },
      orderBy: {
        createdAt: "asc"
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
            reactions: true
          }
        }
      }
    });

    const formattedComments = comments.map(c => ({
      ...c,
      reactionCount: c._count.reactions,
      _count: undefined
    }));

    return res.status(200).json(formattedComments);
  } catch (error) {
    console.error("Get comments error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to retrieve comments.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}
