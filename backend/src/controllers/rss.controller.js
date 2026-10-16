import { getNewsFeed } from "../services/rss.service.js";

/**
 * Handle RSS feed request.
 * GET /api/rss?topic=...
 */
export async function getNews(req, res) {
  try {
    const { topic = 'world', locale = 'en-US' } = req.query;
    if (typeof topic !== "string" || topic.length > 80 || typeof locale !== "string" || !/^[a-z]{2}-[A-Z]{2}$/.test(locale)) return res.status(400).json({ error: "Invalid news topic or locale." });
    const articles = await getNewsFeed(topic, locale);
    return res.status(200).json(articles);
  } catch (error) {
    console.error("Get news error:", error);
    return res.status(500).json({ error: "Failed to retrieve news feed." });
  }
}
