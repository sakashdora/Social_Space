import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// Verify presence at startup to prevent running with empty values
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[Supabase Config] WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. " +
    "Storage uploads and deletions will fail until these are configured."
  );
}

// Create a Supabase client using the service role key to allow admin storage bypass in deletion/retrieval crons.
export const supabase = (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : null;
