/**
 * rss.routes.js
 *
 * INTENTIONALLY PUBLIC (no requireAuth).
 * The RSS news feed is consumed by the "Discover" tab on the landing/explore page,
 * which is visible to unauthenticated visitors. Authentication is not required here
 * by product design — the feed contains only public third-party news articles.
 *
 * SECURITY NOTE: RSS fetching is read-only and rate-limited at the CDN/proxy layer.
 * If abuse is observed, add a per-IP rate limiter mirroring the pattern in rateLimiter.js.
 */
import { Router } from "express";
import { getNews } from "../controllers/rss.controller.js";

const router = Router();

router.get("/", getNews);

export default router;
