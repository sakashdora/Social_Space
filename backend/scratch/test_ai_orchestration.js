import dotenv from "dotenv";
import { generateArticle, correctGrammar, getSuggestions, analyzeContent } from "../src/services/ai.service.js";

dotenv.config();

async function runTests() {
  console.log("-----------------------------------------");
  console.log("STARTING ORCHESTRATION VERIFICATION TESTS");
  console.log("-----------------------------------------\n");

  // Test 1: Content Moderation & Analysis (Gemini Primary -> Grok Fallback -> Local Fallback)
  try {
    console.log("TEST 1: analyzeContent...");
    const moderation = await analyzeContent("I absolute love coding! It brings me so much joy and peace.");
    console.log("RESULT:", JSON.stringify(moderation, null, 2));
  } catch (err) {
    console.error("TEST 1 FAILED:", err.message);
  }
  console.log("\n-----------------------------------------\n");

  // Test 2: Article Generation (Grok Draft -> Gemini Critique)
  try {
    console.log("TEST 2: generateArticle...");
    const article = await generateArticle("The future of distributed databases in 2026");
    console.log("RESULT:\n", article);
  } catch (err) {
    console.error("TEST 2 FAILED:", err.message);
  }
  console.log("\n-----------------------------------------\n");

  // Test 3: Grammar Correction (Grok Primary -> Gemini Fallback)
  try {
    console.log("TEST 3: correctGrammar...");
    const correction = await correctGrammar("he dont know how to write code properly but he try real hard");
    console.log("RESULT:\n", correction);
  } catch (err) {
    console.error("TEST 3 FAILED:", err.message);
  }
  console.log("\n-----------------------------------------\n");

  // Test 4: Suggestions (Grok Primary -> Gemini Fallback)
  try {
    console.log("TEST 4: getSuggestions...");
    const suggestions = await getSuggestions("I just got a job offer at a tech startup, but the salary is lower than expected.");
    console.log("RESULT:", JSON.stringify(suggestions, null, 2));
  } catch (err) {
    console.error("TEST 4 FAILED:", err.message);
  }
  console.log("\n-----------------------------------------\n");
}

runTests();
