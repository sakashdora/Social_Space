import { generateArticle, correctGrammar, getSuggestions } from "../services/ai.service.js";

/**
 * Handle article generation request using Grok API.
 * POST /api/generate
 */
export async function generate(req, res) {
  try {
    const { topic, context } = req.body;
    if (!topic) {
      return res.status(400).json({
        error: {
          message: "Missing topic.",
          code: "BAD_REQUEST",
        },
      });
    }
    const article = await generateArticle(topic, context);
    return res.status(200).json({ article });
  } catch (error) {
    console.error("Generate article error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to generate article.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
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
      return res.status(400).json({
        error: {
          message: "Missing text.",
          code: "BAD_REQUEST",
        },
      });
    }
    const correctedText = await correctGrammar(text);
    return res.status(200).json({ correctedText });
  } catch (error) {
    console.error("Correct grammar error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to correct grammar.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
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
      return res.status(400).json({
        error: {
          message: "Missing text.",
          code: "BAD_REQUEST",
        },
      });
    }
    const suggestions = await getSuggestions(text);
    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error("Get suggestions error:", error);
    return res.status(500).json({
      error: {
        message: "Failed to get suggestions.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
}
