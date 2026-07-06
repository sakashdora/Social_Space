import Parser from 'rss-parser';

const parser = new Parser();

// Base Google News RSS URL
const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss';

// In-memory cache
const feedCache = {};
const CACHE_TTL = 5 * 60 * 1000; // Cache for 5 minutes

/**
 * Fetches and parses a Google News RSS feed.
 * @param {string} topic Optional topic (e.g., 'technology', 'business')
 * @param {string} locale Optional locale string, default 'en-US'
 * @returns {Promise<Array>} Array of parsed news articles
 */
export async function getNewsFeed(topic = '', locale = 'en-US') {
  const cacheKey = `${topic}_${locale}`;
  const cached = feedCache[cacheKey];

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`RSS Service: Returning cached feed for key: ${cacheKey}`);
    return cached.data;
  }

  try {
    // Construct the URL based on topic
    let url = GOOGLE_NEWS_RSS_URL;
    if (topic) {
      const query = encodeURIComponent(topic);
      const [lang, country] = locale.split('-');
      url = `${GOOGLE_NEWS_RSS_URL}/search?q=${query}&hl=${locale}&gl=${country || 'US'}&ceid=${country || 'US'}:${lang || 'en'}`;
    }

    const feed = await parser.parseURL(url);
    
    // Map to a cleaner format for our frontend
    const articles = feed.items.map(item => ({
      id: item.guid || item.id,
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      source: item.source || feed.title,
      contentSnippet: item.contentSnippet || item.content,
    }));

    // Cache the result
    feedCache[cacheKey] = {
      timestamp: Date.now(),
      data: articles
    };

    return articles;
  } catch (error) {
    console.error('Error fetching RSS feed:', error.message);
    throw new Error('Failed to fetch news feed');
  }
}
