/**
 * ai.routes.js
 *
 * INTENTIONALLY PUBLIC (no requireAuth).
 * These endpoints (generate, correct, suggest) are used by the post-compose UI
 * to provide AI writing assistance BEFORE a user has submitted a post. They are
 * called in the compose flow where the user may not yet have an active session.
 *
 * SECURITY NOTE: The AI endpoints consume the Grok API key. They are protected
 * by the global express-rate-limit at the express layer (applied via app.js trust proxy).
 * If abuse is observed, add a per-IP rate limiter here matching the pattern in rateLimiter.js.
 */
import { Router } from "express";
import { generate, correct, suggest } from "../controllers/ai.controller.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { generateSchema, textSchema } from "../schemas/ai.schema.js";

const router = Router();

router.post("/generate", validateBody(generateSchema), generate);
router.post("/correct", validateBody(textSchema), correct);
router.post("/suggest", validateBody(textSchema), suggest);

export default router;
