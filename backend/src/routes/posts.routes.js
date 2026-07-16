import { Router } from "express";
import { createPost, getFeed, getPostDetails, deletePost, getTrendingTopics } from "../controllers/posts.controller.js";
import { createComment, getComments } from "../controllers/comments.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { createPostSchema, createCommentSchema } from "../schemas/posts.schema.js";

const router = Router();

// Feed & Post endpoints
router.get("/trending", getTrendingTopics);
router.get("/", getFeed);
router.get("/:id", getPostDetails);

// Comments nested endpoints
router.get("/:postId/comments", getComments);
router.post("/:postId/comments", requireAuth, validateBody(createCommentSchema), createComment);

// Protected actions
router.post("/", requireAuth, validateBody(createPostSchema), createPost);
router.delete("/:id", requireAuth, deletePost);

export default router;
