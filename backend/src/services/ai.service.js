import axios from "axios";
import { env } from "../config/env.js";

const getAiApiKey = () => env.AI_API_KEY;
const getAiApiUrl = () => env.AI_API_URL;
const getAiModel = () => env.AI_MODEL;

const getGrokApiKey = () => env.GROK_API_KEY;

// Auto-detect if it's a Groq (gsk_...) or Grok (xai-...) key
function getGrokEndpointConfig() {
  const key = getGrokApiKey() || "";
  if (key.startsWith("gsk_")) {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "llama-3.3-70b-versatile",
      name: "Groq"
    };
  }
  return {
    url: "https://api.x.ai/v1/chat/completions",
    model: "grok-beta",
    name: "Grok"
  };
}

// Helper to check if Grok/Groq is configured
function isGrokConfigured() {
  const key = getGrokApiKey();
  return key && key !== "mock_key_for_dev" && key.trim() !== "";
}

/**
 * Defense-in-depth: guarantee an LLM request only ever carries plain-text
 * content. A text-only model throws "this model does not support image input"
 * if an image slips into the payload. We strip embedded image data URLs and
 * coerce non-string content so a contaminated/reused payload fails fast and
 * locally instead of reaching the provider with an unsupported image part.
 */
function sanitizeTextInput(input) {
  if (typeof input !== "string") return String(input ?? "");
  // Remove any inlined base64 image blobs that could leak into a prompt.
  return input.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[^\s"'`)]*/g, "[image-redacted]");
}

function buildTextMessages(systemInstruction, userContent) {
  return [
    { role: "system", content: sanitizeTextInput(systemInstruction) },
    { role: "user", content: sanitizeTextInput(userContent) },
  ];
}

// Helper to check if Gemini is configured
function isGeminiConfigured() {
  const key = getAiApiKey();
  return key && key !== "YOUR_GEMINI_AI_STUDIO_API_KEY" && key.trim() !== "";
}

// Helper to clean and parse JSON securely from LLM responses
function parseJsonSafe(raw) {
  if (!raw) return null;
  let clean = raw.trim();
  // Strip markdown formatting if any
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```[a-zA-Z]*\s*/, "");
    clean = clean.replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(clean);
  } catch (err) {
    const startIdx = clean.indexOf("{");
    const endIdx = clean.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      try {
        return JSON.parse(clean.slice(startIdx, endIdx + 1));
      } catch {}
    }
    const startArr = clean.indexOf("[");
    const endArr = clean.lastIndexOf("]");
    if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
      try {
        return JSON.parse(clean.slice(startArr, endArr + 1));
      } catch {}
    }
    throw err;
  }
}

/**
 * Helper to call Google Gemini (via OpenAI compatible endpoint)
 */
async function callGemini(prompt, systemInstruction, options = {}) {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini API key is not configured.");
  }
  
  const payload = {
    model: getAiModel(),
    messages: buildTextMessages(systemInstruction, prompt),
    temperature: options.temperature !== undefined ? options.temperature : 0.2,
    max_tokens: options.maxTokens || 1000
  };

  if (options.responseFormat) {
    payload.response_format = options.responseFormat;
  }

  const response = await axios.post(getAiApiUrl(), payload, {
    headers: {
      Authorization: `Bearer ${getAiApiKey()}`,
      "Content-Type": "application/json"
    },
    timeout: options.timeout || 30000 // default 30s
  });

  return response.data.choices[0].message.content;
}

/**
 * Helper to call Grok/Groq API
 */
async function callGrok(prompt, systemInstruction, options = {}) {
  if (!isGrokConfigured()) {
    throw new Error("Grok API key is not configured.");
  }

  const { url, model, name } = getGrokEndpointConfig();

  const payload = {
    model: model,
    messages: buildTextMessages(systemInstruction, prompt),
    temperature: options.temperature !== undefined ? options.temperature : 0.2,
    max_tokens: options.maxTokens || 1000
  };

  if (options.responseFormat) {
    payload.response_format = options.responseFormat;
  }

  console.log(`Orchestration: Calling ${name} API...`);

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${getGrokApiKey()}`,
      "Content-Type": "application/json"
    },
    timeout: options.timeout || 25000 // default 25s
  });

  return response.data.choices[0].message.content;
}

/**
 * Generates an article using both Grok and Gemini (Generator-Critique cycle)
 * Grok generates the draft, Gemini edits and refines it.
 */
export async function generateArticle(prompt) {
  let grokDraft = null;
  let critiqueResult = null;

  const groqWriterPrompt = `You are an intelligent, domain-expert article writer. Write a detailed, engaging draft of the article.
Intelligently decide the best structure based on the topic.
Write naturally like an experienced human. Never sound robotic, never repeat yourself, and never use unnecessary filler. Avoid generic AI phrases (e.g. "As an AI...", "Certainly!", "Here's a rewritten version.", "I'd be happy to.", "In conclusion...").
Format beautifully using Markdown. Use headings, bullet lists, code blocks, or tables where appropriate. Break long paragraphs and keep them to 2-5 lines. Never produce walls of text.
Never explain how it was written, never critique your own output, never explain formatting choices, and never say 'Here is the rewritten version' or expose internal reasoning. Every response should feel like it was written by a top domain expert specifically for that topic.`;

  const geminiEditorPrompt = `You are an intelligent, expert editor. Critique the draft and rewrite it to improve readability, style, formatting in clean Markdown, and engagement. Return the complete polished article.
Write naturally like an experienced human. Never sound robotic, never repeat yourself, and never use unnecessary filler. Avoid generic AI phrases (e.g. "As an AI...", "Certainly!", "Here's a rewritten version.", "I'd be happy to.", "In conclusion...").
Format beautifully using Markdown. Use headings, bullet lists, code blocks, or tables where appropriate. Break long paragraphs and keep them to 2-5 lines. Never produce walls of text.
Never explain how it was written or edited, never critique your own output, never explain formatting choices, and never say 'Here is the rewritten version' or expose internal reasoning. Every response should feel like it was written by a top domain editor.`;

  const geminiWriterPrompt = `You are an intelligent, domain-expert article writer. Write a high-quality article in clean Markdown.
Intelligently decide the best structure based on the topic.
Write naturally like an experienced human. Never sound robotic, never repeat yourself, and never use unnecessary filler. Avoid generic AI phrases (e.g. "As an AI...", "Certainly!", "Here's a rewritten version.", "I'd be happy to.", "In conclusion...").
Format beautifully using Markdown. Use headings, bullet lists, code blocks, or tables where appropriate. Break long paragraphs and keep them to 2-5 lines. Never produce walls of text.
Never explain how it was written, never critique your own output, never explain formatting choices, and never say 'Here is the rewritten version' or expose internal reasoning. Every response should feel like it was written by a top domain expert.`;

  // Try to generate initial draft with Grok
  if (isGrokConfigured()) {
    try {
      grokDraft = await callGrok(prompt, groqWriterPrompt, {
        temperature: 0.7,
        maxTokens: 1500
      });
    } catch (err) {
      console.warn("Grok/Groq draft generation failed, falling back to Gemini:", err.message);
    }
  }

  // If Grok succeeded, critique/edit with Gemini
  if (grokDraft && isGeminiConfigured()) {
    try {
      console.log("Orchestration: Critique and edit draft using Gemini...");
      critiqueResult = await callGemini(
        `Original Prompt: ${prompt}\nDraft:\n${grokDraft}`,
        geminiEditorPrompt,
        { temperature: 0.5, maxTokens: 1500 }
      );
      return critiqueResult;
    } catch (err) {
      console.warn("Gemini critique/polish failed. Returning raw draft:", err.message);
      return grokDraft;
    }
  }

  // Fallbacks:
  // 1. If Grok failed/not configured, try Gemini from scratch
  if (!grokDraft && isGeminiConfigured()) {
    try {
      console.log("Orchestration (Fallback): Generating article from scratch using Gemini...");
      return await callGemini(prompt, geminiWriterPrompt, {
        temperature: 0.7,
        maxTokens: 1500
      });
    } catch (err) {
      console.warn("Gemini generation fallback failed:", err.message);
    }
  }

  // 2. If Gemini failed/not configured but Grok is available, try Grok from scratch
  if (grokDraft) {
    return grokDraft;
  }

  // 3. Offline Dev Fallback
  console.log("Orchestration: Both APIs unavailable. Returning mock article.");
  return `# Mock Article\n\nThis is a mock article generated for prompt: "${prompt}".\n\nConfigure GROK_API_KEY and AI_API_KEY in .env to enable real orchestration.`;
}

/**
 * Corrects grammar and suggests improvements using Grok (fallback to Gemini)
 */
export async function correctGrammar(text) {
  const instruction = `You are an expert editor. Correct the grammar and improve the flow of the following text, keeping the original meaning.
Write naturally like an experienced human. Return ONLY the corrected text.
Never explain how it was written or corrected, never explain formatting choices, never say "Here is the corrected version", and do not include any conversational filler or prefaces.`;
  
  if (isGrokConfigured()) {
    try {
      return await callGrok(text, instruction, { temperature: 0.2, maxTokens: 800 });
    } catch (err) {
      console.warn("Grok/Groq grammar correction failed, trying Gemini fallback:", err.message);
    }
  }

  if (isGeminiConfigured()) {
    try {
      console.log("Orchestration (Fallback): Correcting grammar using Gemini...");
      return await callGemini(text, instruction, { temperature: 0.2, maxTokens: 800 });
    } catch (err) {
      console.warn("Gemini grammar correction fallback failed:", err.message);
    }
  }

  console.log("Orchestration: Both APIs unavailable. Returning mock correction.");
  return text + "\n\n(Mock correction applied - both APIs offline)";
}

/**
 * Generates smart suggestions based on context using Grok (fallback to Gemini)
 */
export async function getSuggestions(context) {
  const instruction = "You are a helpful assistant suggesting 3 short, engaging replies or follow-up ideas based on the context. Return ONLY a JSON object with a 'suggestions' key containing an array of 3 strings, e.g. {\"suggestions\": [\"Suggestion 1\", \"Suggestion 2\", \"Suggestion 3\"]}.";
  
  const parseSuggestions = (raw) => {
    try {
      const parsed = parseJsonSafe(raw);
      if (parsed && parsed.suggestions) {
        return parsed.suggestions;
      }
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return JSON.parse(raw);
    } catch {
      // Basic text parser in case it returns plain text lists
      return raw.split("\n")
        .map(line => line.replace(/^[-\d.\s*]+/, "").trim())
        .filter(l => l.length > 0)
        .slice(0, 3);
    }
  };

  if (isGrokConfigured()) {
    try {
      const raw = await callGrok(context, instruction, { 
        responseFormat: { type: "json_object" }, 
        temperature: 0.3,
        maxTokens: 300
      });
      return parseSuggestions(raw);
    } catch (err) {
      console.warn("Grok/Groq suggestions failed, trying Gemini fallback:", err.message);
    }
  }

  if (isGeminiConfigured()) {
    try {
      console.log("Orchestration (Fallback): Fetching suggestions using Gemini...");
      const raw = await callGemini(context, instruction, { 
        responseFormat: { type: "json_object" },
        temperature: 0.3,
        maxTokens: 300
      });
      return parseSuggestions(raw);
    } catch (err) {
      console.warn("Gemini suggestions fallback failed:", err.message);
    }
  }

  console.log("Orchestration: Both APIs unavailable. Returning mock suggestions.");
  return ["Mock suggestion 1", "Mock suggestion 2", "Mock suggestion 3"];
}

/**
 * Performs content moderation, sentiment analysis, and auto-tagging.
 * Primary: Gemini, Fallback: Grok, Second Fallback: Local rule engine.
 */
export async function analyzeContent(content, options = {}) {
  const instruction = `You are an AI content moderator and analyzer for the Social Space platform.
Analyze the user post content and return a JSON object with this exact structure:
{
  "isFlagged": false,
  "flagReason": null,
  "scores": {
    "hateSpeech": 0.0,
    "harassment": 0.0,
    "explicit": 0.0,
    "violence": 0.0,
    "selfHarm": 0.0
  },
  "reasoning": "Reasoning summary (maximum 15 words).",
  "flags": { "hateSpeech": false, "harassment": false, "explicit": false, "violence": false },
  "labels": ["life", "confession"],
  "sentiment": { "score": 0.8, "sentiment": "positive" }
}

Rules for evaluation:
- Set isFlagged to true and a non-null flagReason if any category's confidence score in "scores" is >= 0.5.
- Set the corresponding boolean in "flags" to true if its score is >= 0.5.
- For labels, pick 1-3 categories from: ["Life", "Mental Health", "Relationships", "Career", "Confessions", "Ideas", "Doubt", "Peace"].
- For sentiment, score is between -1.0 (very negative) and 1.0 (very positive), and sentiment is "positive", "negative", "neutral", or "mixed".
- The reasoning field MUST be a brief summary of maximum 15 words.

Anonymous Platform Context Calibration (Few-Shot Examples):
1. Distinguish safe venting/sadness from actual self-harm/suicide expressions.
   - Input: "Honestly I feel so lonely and exhausted lately. I just want to sleep for a week."
   - Output: { "isFlagged": false, "flagReason": null, "scores": { "hateSpeech": 0.0, "harassment": 0.0, "explicit": 0.0, "violence": 0.0, "selfHarm": 0.1 }, "reasoning": "Venting exhaustion and loneliness. No self-harm intent.", "flags": { "hateSpeech": false, "harassment": false, "explicit": false, "violence": false }, "labels": ["Mental Health", "Life"], "sentiment": { "score": -0.6, "sentiment": "negative" } }
2. Distinguish dark humor/sarcasm from actual harassment or violent threats.
   - Input: "My laptop died right before submission. I guess it couldn't handle my terrible code. RIP laptop, you will be missed."
   - Output: { "isFlagged": false, "flagReason": null, "scores": { "hateSpeech": 0.0, "harassment": 0.0, "explicit": 0.0, "violence": 0.0, "selfHarm": 0.0 }, "reasoning": "Sarcastic dark humor about laptop. No violations.", "flags": { "hateSpeech": false, "harassment": false, "explicit": false, "violence": false }, "labels": ["Life"], "sentiment": { "score": -0.2, "sentiment": "negative" } }
3. Flag explicit threats of violence/harassment.
   - Input: "If you don't shut up, I am going to find where you live and beat you to death."
   - Output: { "isFlagged": true, "flagReason": "Direct physical violence threat", "scores": { "hateSpeech": 0.0, "harassment": 0.8, "explicit": 0.0, "violence": 1.0, "selfHarm": 0.0 }, "reasoning": "Physical violence threat to find and kill user.", "flags": { "hateSpeech": false, "harassment": true, "explicit": false, "violence": true }, "labels": ["Confessions"], "sentiment": { "score": -0.9, "sentiment": "negative" } }`;

  const parseModeration = (raw) => {
    try {
      return parseJsonSafe(raw);
    } catch (err) {
      console.error("Failed to parse moderation JSON:", err.message);
      console.error("Raw unparsed model response was:", raw);
      throw err;
    }
  };

  const defaultMaxTokens = options.maxTokens || 250;

  // Primary: Groq (low-latency primary)
  if (isGrokConfigured()) {
    let raw;
    try {
      console.log("Orchestration: Analyzing content using Groq (Primary)...");
      raw = await callGrok(content, instruction, { 
        responseFormat: { type: "json_object" },
        temperature: 0.1,
        maxTokens: defaultMaxTokens,
        timeout: 3000 // 3s timeout for primary call
      });
      return parseModeration(raw);
    } catch (err) {
      // Truncation safety net: if raw output was retrieved but failed to parse, retry once with +100 tokens
      if (raw !== undefined) {
        console.warn(`Groq parsing failed. Retrying once with higher token limit (${defaultMaxTokens + 100})...`);
        try {
          const retryRaw = await callGrok(content, instruction, {
            responseFormat: { type: "json_object" },
            temperature: 0.1,
            maxTokens: defaultMaxTokens + 100,
            timeout: 4000
          });
          return parseModeration(retryRaw);
        } catch (retryErr) {
          console.error("Groq parsing retry failed:", retryErr.message);
        }
      }
      console.warn("Groq content analysis failed, trying Gemini fallback:", err.message);
    }
  }

  // Fallback: Gemini (robust secondary fallback)
  if (isGeminiConfigured()) {
    let raw;
    try {
      console.log("Orchestration (Fallback): Analyzing content using Gemini...");
      raw = await callGemini(content, instruction, { 
        responseFormat: { type: "json_object" },
        temperature: 0.1,
        maxTokens: defaultMaxTokens,
        timeout: 5000 // 5s timeout for fallback call
      });
      return parseModeration(raw);
    } catch (err) {
      // Truncation safety net for fallback: retry once with +100 tokens
      if (raw !== undefined) {
        console.warn(`Gemini parsing failed. Retrying once with higher token limit (${defaultMaxTokens + 100})...`);
        try {
          const retryRaw = await callGemini(content, instruction, {
            responseFormat: { type: "json_object" },
            temperature: 0.1,
            maxTokens: defaultMaxTokens + 100,
            timeout: 6000
          });
          return parseModeration(retryRaw);
        } catch (retryErr) {
          console.error("Gemini parsing retry failed:", retryErr.message);
        }
      }
      console.warn("Gemini content analysis fallback failed:", err.message);
    }
  }

  // Offline Fallback Rule Engine
  console.log("Orchestration: Both APIs unavailable. Running local moderation engine.");
  const lower = content.toLowerCase();
  
  // 1. Simple Moderation
  const bannedKeywords = ["kill myself", "bomb", "kill you", "die bitch", "hate all blacks", "hate all jews"];
  let isFlagged = false;
  let flagReason = null;
  const flags = { hateSpeech: false, harassment: false, explicit: false, violence: false };

  for (const keyword of bannedKeywords) {
    if (lower.includes(keyword)) {
      isFlagged = true;
      flagReason = `Flagged content violation (keyword: ${keyword})`;
      if (keyword.includes("hate")) flags.hateSpeech = true;
      else if (keyword.includes("kill")) flags.violence = true;
      break;
    }
  }

  // 2. Simple Sentiment
  const positiveWords = ["love", "happy", "great", "peace", "joy", "calm", "wonderful", "amazing", "good", "hope"];
  const negativeWords = ["sad", "hate", "depressed", "lonely", "angry", "terrible", "bad", "worry", "fear", "anxiety"];

  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach(w => { if (lower.includes(w)) positiveCount++; });
  negativeWords.forEach(w => { if (lower.includes(w)) negativeCount++; });

  let sentimentScore = 0.0;
  let sentimentText = "neutral";

  if (positiveCount > negativeCount) {
    sentimentScore = Math.min(0.1 * positiveCount, 1.0);
    sentimentText = "positive";
  } else if (negativeCount > positiveCount) {
    sentimentScore = Math.max(-0.1 * negativeCount, -1.0);
    sentimentText = "negative";
  }

  // 3. Simple Tagging
  const categoryKeywords = {
    "Mental Health": ["depressed", "anxiety", "lonely", "stress", "mental", "sad", "fear", "overwhelmed"],
    "Relationships": ["love", "gf", "bf", "dating", "friend", "marriage", "breakup", "crush"],
    "Career": ["job", "work", "boss", "salary", "interview", "hustle", "college", "career"],
    "Confessions": ["secret", "confess", "never told", "guilt", "hide", "truth"],
    "Peace": ["calm", "nature", "peace", "silent", "meditate", "quiet", "forest"],
    "Ideas": ["thinking", "create", "innovate", "idea", "build", "future"]
  };

  const detectedCategories = [];
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        detectedCategories.push(cat);
        break;
      }
    }
  }

  if (detectedCategories.length === 0) {
    detectedCategories.push("Life");
  }

  // 4. Map to new schema structure
  const scores = {
    hateSpeech: flags.hateSpeech ? 1.0 : 0.0,
    harassment: flags.harassment ? 1.0 : 0.0,
    explicit: flags.explicit ? 1.0 : 0.0,
    violence: flags.violence ? 1.0 : 0.0,
    selfHarm: lower.includes("kill myself") || lower.includes("suicide") ? 1.0 : 0.0
  };

  const selfHarmFlag = scores.selfHarm >= 0.5;

  return {
    isFlagged: isFlagged || selfHarmFlag,
    flagReason: flagReason || (selfHarmFlag ? "Self harm intent detected locally" : null),
    scores,
    reasoning: "Evaluated locally by the fallback rule engine.",
    flags: {
      ...flags,
      selfHarm: selfHarmFlag
    },
    labels: detectedCategories.slice(0, 3),
    sentiment: {
      score: sentimentScore,
      sentiment: sentimentText
    }
  };
}
