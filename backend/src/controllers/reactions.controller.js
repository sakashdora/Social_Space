import prisma from "../config/prisma.js";
import { findVisiblePost } from "../services/postPolicy.js";

export async function toggleReaction(req, res) {
  try {
    const { postId, commentId, reactionType } = req.body;
    if ((!postId === !commentId) || !reactionType) return res.status(400).json({ error: "Choose exactly one reaction target." });
    const comment = commentId ? await prisma.comment.findFirst({ where: { id: commentId, isDeleted: false } }) : null;
    const post = await findVisiblePost(postId || comment?.postId || "", req.user.id);
    if (!post || (commentId && !comment)) return res.status(404).json({ error: "Reaction target not found." });
    if (!post.allowReactions) return res.status(403).json({ error: "Reactions are disabled for this post." });
    const key = req.user.id + ":" + (postId || commentId) + ":" + reactionType;
    const reacted = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
      const where = { userId: req.user.id, postId: postId || null, commentId: commentId || null, reactionType };
      const existing = await tx.reaction.findFirst({ where });
      if (existing) { await tx.reaction.delete({ where: { id: existing.id } }); return false; }
      await tx.reaction.create({ data: where });
      return true;
    });
    return res.status(200).json({ reacted });
  } catch (error) {
    console.error("Reaction failed:", error.message);
    return res.status(500).json({ error: "Could not update reaction." });
  }
}
