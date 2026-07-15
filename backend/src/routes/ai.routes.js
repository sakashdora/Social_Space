/**
 * ai.routes.js
 *
 * INTENTIONALLY PUBLIC (no requireAuth).
 * These endpoints (generate, correct, suggest) are used by the post-compose UI
 * to provide AI writing assistance BEFORE a user has submitted a post. They are
 * called in the compose flow where the user may not yet have an active session.
 *
 * SECURITY: The AI endpoints consume the Grok API key (paid quota). Protected by
 * pgRateLimit("ai") -- 20 requests per IP per minute via Postgres-backed counters.
 * Multi-replica safe: all Azure Container Apps replicas share the same counter state.
 */
import { Router } from "express";
import { generate, correct, suggest } from "../controllers/ai.controller.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { generateSchema, textSchema } from "../schemas/ai.schema.js";
import { pgRateLimit } from "../config/rateLimiters.js";

const router = Router();

router.post("/generate", pgRateLimit("ai"), validateBody(generateSchema), generate);
router.post("/correct",  pgRateLimit("ai"), validateBody(textSchema), correct);
router.post("/suggest",  pgRateLimit("ai"), validateBody(textSchema), suggest);

export default router;
