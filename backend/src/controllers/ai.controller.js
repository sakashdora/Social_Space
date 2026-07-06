import { generateArticle, correctGrammar, getSuggestions } from "../services/ai.service.js";

/**
 * Handle article generation request using Grok API.
 * POST /api/generate
 */
export async function generate(req, res) {
  try {
    const { topic, context } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Missing topic." });
    }
    const article = await generateArticle(topic, context);
    return res.status(200).json({ article });
  } catch (error) {
    console.error("Generate article error:", error);
    return res.status(500).json({ error: "Failed to generate article." });
  }
}

/**
 * Handle grammar correction request using Grok API.
 * POST /api/correct
 */
export async function correct(req, res) {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing text." });
    }
    const correctedText = await correctGrammar(text);
    return res.status(200).json({ correctedText });
  } catch (error) {
    console.error("Correct grammar error:", error);
    return res.status(500).json({ error: "Failed to correct grammar." });
  }
}

/**
 * Handle suggestions request using Grok API.
 * POST /api/suggest
 */
export async function suggest(req, res) {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing text." });
    }
    const suggestions = await getSuggestions(text);
    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error("Get suggestions error:", error);
    return res.status(500).json({ error: "Failed to get suggestions." });
  }
}
