import { Router } from "express";
import { generate, correct, suggest } from "../controllers/ai.controller.js";

const router = Router();

router.post("/generate", generate);
router.post("/correct", correct);
router.post("/suggest", suggest);

export default router;
