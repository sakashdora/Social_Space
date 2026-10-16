import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";

export function realtimeSession(req, res) {
  if (!env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_JWT_SECRET) return res.json({ enabled: false });
  const token = jwt.sign({ sub: req.user.id, role: "authenticated", scope: "veil-realtime", token_version: req.user.tokenVersion },
    process.env.SUPABASE_JWT_SECRET, { algorithm: "HS256", audience: "authenticated", expiresIn: "2m" });
  res.set("Cache-Control", "private, no-store");
  return res.json({ enabled: true, url: env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY, token, topic: `user:${req.user.id}` });
}

// Only invalidation notices leave the API; message ciphertext is fetched through
// the normal membership/expiry checks. No plaintext or participant list is broadcast.
export async function notifyChat(threadId, userIds) {
  if (!supabase || !process.env.SUPABASE_JWT_SECRET) return;
  await Promise.all(userIds.map(async userId => {
    const channel = supabase.channel(`user:${userId}`, { config: { private: true } });
    try { await channel.httpSend("chat", { threadId }, { timeout: 2000 }); }
    catch (error) { console.warn("Realtime unavailable; clients will poll:", error.message); }
    finally { await supabase.removeChannel(channel); }
  }));
}
