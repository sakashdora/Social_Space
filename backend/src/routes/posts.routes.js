import { Router } from "express";
import { createPost, getFeed, getPostDetails, deletePost, getTrendingTopics, voteOnPoll } from "../controllers/posts.controller.js";
import { createComment, getComments } from "../controllers/comments.controller.js";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { createPostSchema, createCommentSchema } from "../schemas/posts.schema.js";

const router = Router();
const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Feed & Post endpoints (optionalAuth enriches response with userHasReacted for logged-in users)
router.get("/trending", getTrendingTopics);
router.get("/", optionalAuth, getFeed);
router.get("/:id", optionalAuth, getPostDetails);

// Comments nested endpoints
router.get("/:postId/comments", optionalAuth, getComments);
router.post("/:postId/comments", requireAuth, validateBody(createCommentSchema), createComment);

// Protected actions
router.post("/", requireAuth, validateBody(createPostSchema), createPost);
router.delete("/:id", requireAuth, route(deletePost));
router.post("/:id/vote", requireAuth, route(voteOnPoll));

export default router;
