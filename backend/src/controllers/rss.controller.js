import { getNewsFeed } from "../services/rss.service.js";

/**
 * Handle RSS feed request.
 * GET /api/rss?topic=...
 */
export async function getNews(req, res) {
  try {
    const { topic = 'world', locale = 'en-US' } = req.query;
    const articles = await getNewsFeed(topic, locale);
    return res.status(200).json(articles);
  } catch (error) {
    console.error("Get news error:", error);
    return res.status(500).json({ error: "Failed to retrieve news feed." });
  }
}
