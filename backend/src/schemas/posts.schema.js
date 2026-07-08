/**
 * src/schemas/posts.schema.js
 *
 * Zod validation schemas for post and comment routes.
 */

import { z } from "zod";

export const createPostSchema = z.object({
  content: z
    .string({ required_error: "Post content is required." })
    .trim()
    .min(1, "Post content cannot be empty.")
    .max(500, "Post content exceeds 500 characters limit."),
  category: z
    .string({ required_error: "Category is required." })
    .trim()
    .min(1, "Category cannot be empty."),
  mode: z
    .enum(["full", "pseudo"], { invalid_type_error: "Anonymity mode must be 'full' or 'pseudo'." })
    .default("pseudo"),
  mediaUrl: z.string().trim().nullable().optional(),
});

export const createCommentSchema = z.object({
  content: z
    .string({ required_error: "Comment content is required." })
    .trim()
    .min(1, "Comment content cannot be empty.")
    .max(300, "Comment content exceeds 300 characters limit."),
  mode: z
    .enum(["full", "pseudo"], { invalid_type_error: "Anonymity mode must be 'full' or 'pseudo'." })
    .default("pseudo"),
  parentCommentId: z.string().trim().uuid("Invalid parent comment ID format.").nullable().optional(),
});
