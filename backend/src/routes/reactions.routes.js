import { Router } from "express";
import { toggleReaction } from "../controllers/reactions.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { toggleReactionSchema } from "../schemas/reactions.schema.js";

const router = Router();

router.post("/", requireAuth, validateBody(toggleReactionSchema), toggleReaction);

export default router;
