import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// SUPABASE_URL is required in production (no hard-coded fallback — see env.js Fix C).
// Missing configuration returns an explicit storage-unavailable response.
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[Supabase Config] WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. " +
    "Storage uploads and deletions will fail until these are configured."
  );
}

// Create a Supabase client using the service role key to allow admin storage bypass in deletion/retrieval crons.
export const supabase = (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (url, options = {}) => fetch(url, { ...options, signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) }) },
    })
  : null;
