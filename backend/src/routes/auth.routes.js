import { Router } from "express";
import { register, login, updateSecurityKey, deleteAccount } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);

// Protected user routines
router.patch("/security-key", requireAuth, updateSecurityKey);
router.delete("/account", requireAuth, deleteAccount);

export default router;
