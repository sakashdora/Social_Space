/**
 * src/config/env.js
 *
 * Centralized environment configuration loader and boot-time validator.
 * Loads variables from .env and performs strict validations on startup.
 * Throws immediately if critical production secrets are missing, insecure,
 * or left as development placeholders.
 */

import dotenv from "dotenv";
dotenv.config();

const KNOWN_DEV_PLACEHOLDERS = [
  "CHANGE_IN_PROD",
  "CHANGE-IN-PROD",
  "YOUR_",
  "REPLACE_WITH",
  "veil_shine_jwt_secret_key",
  "veil-dev-",
  "0000000000000000000000000000000000000000000000000000000000000000",
];

function isPlaceholder(value) {
  if (!value || typeof value !== "string") return true;
  const v = value.trim();
  if (v.length === 0) return true;
  return KNOWN_DEV_PLACEHOLDERS.some((p) => v.includes(p));
}

const REQUIRED_SECRETS = {
  JWT_SECRET: 32,
  ENCRYPTION_KEY: 64,       // Exactly 64 hex chars (32 bytes)
  RECOVERY_CODE_SECRET: 32,
  SUPABASE_SERVICE_ROLE_KEY: 32,
};

const errors = [];
const warnings = [];

const isProd = process.env.NODE_ENV === "production";

// 1. Validate secrets
for (const [name, minLen] of Object.entries(REQUIRED_SECRETS)) {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    const msg = `  ✗ ${name} is missing or empty.`;
    if (name === "SUPABASE_SERVICE_ROLE_KEY" && !isProd) {
      warnings.push(msg.replace("✗", "⚠"));
    } else {
      errors.push(msg);
    }
    continue;
  }

  if (isPlaceholder(value)) {
    errors.push(`  ✗ ${name} contains a known dev placeholder.`);
    continue;
  }

  if (value.trim().length < minLen) {
    const msg = `  ✗ ${name} is too short (${value.length} chars; minimum ${minLen}).`;
    if (isProd) {
      errors.push(msg);
    } else {
      warnings.push(msg.replace("✗", "⚠"));
    }
  }
}

// Check ENCRYPTION_KEY structure specifically (must be valid 32-byte AES hex key)
const encKey = process.env.ENCRYPTION_KEY;
if (encKey && !/^[0-9a-fA-F]{64}$/.test(encKey.trim())) {
  errors.push("  ✗ ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes).");
}

// Check SUPABASE_URL presence
if (!process.env.SUPABASE_URL) {
  warnings.push("  ⚠ SUPABASE_URL is missing, using default: https://qaovcjwalukixbvhgzel.supabase.co");
}

// In production, FRONTEND_ORIGIN must be set
if (isProd && !process.env.FRONTEND_ORIGIN) {
  errors.push("  ✗ FRONTEND_ORIGIN must be set in production.");
}

// In production, UPSTASH_REDIS_REST_URL and token must be set
if (isProd && (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)) {
  errors.push("  ✗ UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production.");
}

if (warnings.length > 0) {
  console.warn("[config/env] ⚠  WARNINGS:");
  warnings.forEach((w) => console.warn(w));
}

if (errors.length > 0) {
  console.error("[config/env] FATAL — Invalid or missing secrets:");
  errors.forEach((e) => console.error(e));
  console.error("\n  See backend/.env.example for the full list of required variables.");
  throw new Error(
    `Server startup aborted: ${errors.length} validation error(s). See console above.`
  );
}

console.log("[config/env] ✓ All required environment secrets validated successfully.");

// Export sanitized and typed config properties
export const env = {
  PORT: parseInt(process.env.PORT || "3000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  AI_API_KEY: process.env.AI_API_KEY,
  AI_API_URL: process.env.AI_API_URL || "https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions",
  AI_MODEL: process.env.AI_MODEL || "gemini-2.5-flash",
  GROK_API_KEY: process.env.GROK_API_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  RECOVERY_CODE_SECRET: process.env.RECOVERY_CODE_SECRET,
  WEBAUTHN_RP_NAME: process.env.WEBAUTHN_RP_NAME || "Social Space",
  WEBAUTHN_RP_ID: process.env.WEBAUTHN_RP_ID || "localhost",
  WEBAUTHN_ORIGIN: process.env.WEBAUTHN_ORIGIN || "http://localhost:5173",
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  TOTP_ISSUER: process.env.TOTP_ISSUER || "Social Space",
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  SUPABASE_URL: process.env.SUPABASE_URL || "https://qaovcjwalukixbvhgzel.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
