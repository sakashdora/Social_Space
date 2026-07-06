import { Router } from "express";
import { toggleReaction } from "../controllers/reactions.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", requireAuth, toggleReaction);

export default router;
