/**
 * src/schemas/ai.schema.js
 *
 * Zod validation schemas for AI routes.
 */

import { z } from "zod";

export const generateSchema = z.object({
  topic: z
    .string({ required_error: "Topic is required." })
    .trim()
    .min(1, "Topic cannot be empty.")
    .max(100, "Topic is too long (max 100 characters)."),
  context: z.string().trim().max(500, "Context is too long (max 500 characters).").optional(),
});

export const textSchema = z.object({
  text: z
    .string({ required_error: "Text content is required." })
    .trim()
    .min(1, "Text content cannot be empty.")
    .max(1000, "Text exceeds the 1000 characters limit."),
});
