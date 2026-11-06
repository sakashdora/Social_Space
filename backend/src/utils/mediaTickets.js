/**
 * src/utils/mediaTickets.js
 *
 * Short-lived, post-scoped tickets that let an <img>/<video> element fetch a
 * stored object without a bearer header. A ticket is bound to one post id and
 * expires after 15 minutes.
 */

import { signScopedToken, verifyScopedToken } from "./jwt.js";

const AUDIENCE = "media";

export function postMediaUrl(postId, thumbnail = false) {
  const ticket = signScopedToken({ scope: "post-media", postId }, { expiresInSeconds: 15 * 60, audience: AUDIENCE });
  return `/api/media/stream/${postId}?ticket=${ticket}${thumbnail ? "&thumb=true" : ""}`;
}

export function verifyMediaTicket(ticket, postId) {
  const grant = verifyScopedToken(ticket, AUDIENCE);
  return !!grant && grant.scope === "post-media" && grant.postId === postId;
}
