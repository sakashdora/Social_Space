/**
 * src/config/env.js
 *
 * Runtime configuration for the Cloudflare Worker.
 *
 * Workers have no process.env: configuration arrives as bindings on every
 * request (vars from wrangler.toml, secrets from `wrangler secret put`, and the
 * D1 / R2 bindings). `loadRuntimeEnv()` copies the non-binding values into the
 * shared `env` object and validates production secrets. It is called at the
 * top of every request, so modules can read `env.X` lazily.
 *
 * Secrets are never logged, never returned to clients, and never bundled into
 * the frontend (only VITE_* variables reach the browser).
 */

// Matched case-insensitively against the trimmed value.
const KNOWN_PLACEHOLDERS = [
  "change_in_prod",
  "change-in-prod",
  "your_",
  "replace",
  "veil-dev-",
  "0000000000000000000000000000000000000000000000000000000000000000",
];

const REQUIRED_SECRETS = {
  JWT_SECRET: 32,
  ENCRYPTION_KEY: 64, // exactly 64 hex characters (32 bytes)
  RECOVERY_CODE_SECRET: 32,
  CRON_SECRET: 32,
};

/** Shared, mutable configuration. Populated by loadRuntimeEnv(). */
export const env = {
  NODE_ENV: "production",
  JWT_SECRET: "",
  ENCRYPTION_KEY: "",
  RECOVERY_CODE_SECRET: "",
  CRON_SECRET: "",
  WEBAUTHN_RP_NAME: "Social Space",
  WEBAUTHN_RP_ID: "localhost",
  WEBAUTHN_ORIGIN: "http://localhost:5173",
  FRONTEND_ORIGIN: "",
  TOTP_ISSUER: "Social Space",
  AI_API_KEY: "",
  AI_API_URL: "https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions",
  AI_MODEL: "gemini-2.5-flash",
  GROK_API_KEY: "",
  MODERATOR_HANDLES: "",
  MEDIA_BUCKET_NAME: "veil-media",
  // Set to "false" only in tests or air-gapped deployments.
  HIBP_ENABLED: "true",
};

const STRING_VARS = Object.keys(env);

function isPlaceholder(value) {
  const v = value.trim().toLowerCase();
  return v.length === 0 || KNOWN_PLACEHOLDERS.some((p) => v.includes(p));
}

/**
 * Copies bindings into `env` and validates them. Throws a generic error that
 * lists variable NAMES only, never their values.
 *
 * @param {Record<string, unknown>} bindings the Worker `env` object
 */
export function loadRuntimeEnv(bindings = {}) {
  for (const key of STRING_VARS) {
    const value = bindings[key];
    if (typeof value === "string") env[key] = value;
  }

  const errors = [];
  for (const [name, minLength] of Object.entries(REQUIRED_SECRETS)) {
    const value = env[name];
    if (!value || value.trim().length === 0) {
      errors.push(`${name} is missing`);
      continue;
    }
    if (isPlaceholder(value)) {
      errors.push(`${name} contains a placeholder value`);
      continue;
    }
    if (value.trim().length < minLength) {
      errors.push(`${name} is shorter than ${minLength} characters`);
    }
  }
  if (env.ENCRYPTION_KEY && !/^[0-9a-fA-F]{64}$/.test(env.ENCRYPTION_KEY.trim())) {
    errors.push("ENCRYPTION_KEY must be 64 hexadecimal characters");
  }
  if (env.FRONTEND_ORIGIN.includes("*")) {
    errors.push("FRONTEND_ORIGIN must list exact origins; wildcards are not allowed");
  }
  if (errors.length > 0) {
    throw new Error(`Server configuration invalid: ${errors.join("; ")}.`);
  }
  return env;
}

/** Exact, normalised origins allowed for CORS and WebAuthn. */
export function configuredOrigins(value = env.FRONTEND_ORIGIN) {
  return value
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, "").toLowerCase())
    .filter(Boolean);
}

export function isProduction() {
  return env.NODE_ENV === "production";
}
