import { Router } from "express";
import { createPost, getFeed, getPostDetails } from "../controllers/posts.controller.js";
import { createComment, getComments } from "../controllers/comments.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// Feed & Post endpoints
router.get("/", getFeed);
router.get("/:id", getPostDetails);

// Comments nested endpoints
router.get("/:postId/comments", getComments);
router.post("/:postId/comments", requireAuth, createComment);

// Protected actions
router.post("/", requireAuth, createPost);

export default router;
