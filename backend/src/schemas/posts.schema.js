/**
 * src/schemas/posts.schema.js
 *
 * Zod validation schemas for post and comment routes.
 */

import { z } from "zod";

export const createPostSchema = z.object({
  audience: z.enum(["everyone", "circle", "selected", "anonymous_feed"]).default("everyone"),
  lifetime: z.enum(["24h", "7d", "30d", "forever"]).default("forever"),
  selectedHandles: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9_]+$/).max(32)).max(50).default([]).transform(v => [...new Set(v)]),
  engagement: z.object({ allowReplies: z.boolean().optional(), allowReactions: z.boolean().optional(), allowReposts: z.boolean().optional(), anonymousReplies: z.boolean().optional() }).optional(),
  isAiModifiedMedia: z.boolean().default(false),
  pollOptions: z.array(z.string().trim().min(1).max(100)).max(6).default([]).refine(v => v.length === 0 || (v.length >= 2 && new Set(v).size === v.length), "Use 2–6 distinct poll options."),
  content: z
    .string({ required_error: "Post content is required." })
    .trim()
    .max(500, "Post content exceeds 500 characters limit.").default(""),
  category: z
    .string({ required_error: "Category is required." })
    .trim()
    .min(1, "Category cannot be empty."),
  mode: z
    .enum(["full", "pseudo"], { invalid_type_error: "Anonymity mode must be 'full' or 'pseudo'." })
    .default("pseudo"),
  mediaUrl: z.string().trim().nullable().optional(),
  storagePath: z.string().trim().nullable().optional(),
  thumbStoragePath: z.string().trim().nullable().optional(),
  mediaId: z.string().trim().uuid().nullable().optional(),
  sharedPostId: z.string().trim().uuid("Invalid shared post ID format.").nullable().optional(),
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
