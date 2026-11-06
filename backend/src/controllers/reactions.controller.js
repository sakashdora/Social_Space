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
    // The unique (user, target, type) index arbitrates concurrent toggles.
    const where = { userId: req.user.id, postId: postId || null, commentId: commentId || null, reactionType };
    const existing = await prisma.reaction.findFirst({ where });
    let reacted;
    if (existing) {
      await prisma.reaction.deleteMany({ where: { id: existing.id } });
      reacted = false;
    } else {
      try {
        await prisma.reaction.create({ data: where });
        reacted = true;
      } catch (error) {
        if (error?.code !== "P2002") throw error;
        reacted = true; // another request created it first
      }
    }
    return res.status(200).json({ reacted });
  } catch (error) {
    console.error("Reaction failed:", error.message);
    return res.status(500).json({ error: "Could not update reaction." });
  }
}
