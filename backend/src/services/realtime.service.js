/**
 * src/services/realtime.service.js
 *
 * Realtime push is disabled on the Workers deployment. Clients detect
 * `enabled: false` and fall back to polling the chat endpoints, which enforce the
 * same membership and expiry checks. No plaintext or participant list is pushed.
 */

export function realtimeSession(req, res) {
  res.set("Cache-Control", "private, no-store");
  return res.json({ enabled: false });
}

export async function notifyChat() {
  return undefined;
}
