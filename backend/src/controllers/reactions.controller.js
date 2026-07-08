import prisma from "../config/prisma.js";

/**
 * Toggle a reaction on a post or comment.
 * POST /v1/reactions
 */
export async function toggleReaction(req, res) {
  try {
    const { postId, commentId, reactionType } = req.body;
    const userId = req.user.id;

    if (!reactionType) {
      return res.status(400).json({
        error: {
          message: "Reaction type is required.",
          code: "BAD_REQUEST",
        },
      });
    }

    if (!postId && !commentId) {
      return res.status(400).json({
        error: {
          message: "Either postId or commentId must be provided.",
          code: "BAD_REQUEST",
        },
      });
    }

    // Verify target exists
    if (postId) {
      const post = await prisma.post.findUnique({ where: { id: postId } });
      if (!post || post.isDeleted) {
        return res.status(404).json({
          error: {
            message: "Post not found.",
            code: "NOT_FOUND",
          },
        });
      }
    } else {
      const comment = await prisma.comment.findUnique({ where: { id: commentId } });
      if (!comment || comment.isDeleted) {
        return res.status(404).json({
          error: {
            message: "Comment not found.",
            code: "NOT_FOUND",
          },
        });
      }
    }

    // Check if reaction already exists
    const existing = await prisma.reaction.findFirst({
      where: {
        userId,
        postId: postId || null,
        commentId: commentId || null,
        reactionType
      }
    });

    if (existing) {
      // Remove it (toggle off)
      await prisma.reaction.delete({
        where: { id: existing.id }
      });
      return res.status(200).json({ reacted: false, message: "Reaction removed." });
    } else {
      // Add it (toggle on)
      const reaction = await prisma.reaction.create({
        data: {
          userId,
          postId: postId || null,
          commentId: commentId || null,
          reactionType
        }
      });
      return res.status(201).json({ reacted: true, reaction });
    }
  } catch (error) {
    console.error("Toggle reaction error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to toggle reaction.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}
