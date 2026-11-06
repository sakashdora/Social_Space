/**
 * src/schemas/reactions.schema.js
 *
 * Zod validation schemas for reaction routes.
 */

import { z } from "zod";

export const toggleReactionSchema = z.object({
  postId: z.string().trim().uuid("Invalid post ID format.").nullable().optional(),
  commentId: z.string().trim().uuid("Invalid comment ID format.").nullable().optional(),
  reactionType: z.enum(["heart"], { errorMap: () => ({ message: "Unsupported reaction type." }) }),
}).refine(data => data.postId || data.commentId, {
  message: "Either postId or commentId must be provided.",
  path: ["postId"],
});
