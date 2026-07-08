/**
 * src/schemas/chats.schema.js
 *
 * Zod validation schemas for chat routes.
 */

import { z } from "zod";

export const startChatSchema = z.object({
  targetHandle: z
    .string({ required_error: "Recipient username handle is required." })
    .trim()
    .min(1, "Recipient username handle cannot be empty."),
});

export const sendChatMessageSchema = z.object({
  body: z.string().trim().optional(),
  mediaUrl: z.string().trim().nullable().optional(),
}).refine(data => data.body || data.mediaUrl, {
  message: "Message body or mediaUrl attachment is required.",
  path: ["body"],
});

export const updateChatTimerSchema = z.object({
  seconds: z
    .number({ required_error: "Expiration limit in seconds is required." })
    .int("Expiration limit must be an integer.")
    .positive("Expiration limit must be positive.")
    .max(604800, "Timer cannot exceed the maximum 7-day policy limit (604,800 seconds)."),
});
