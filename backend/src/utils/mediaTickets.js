import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function postMediaUrl(postId, thumbnail = false) {
  const ticket = jwt.sign({ scope: "post-media", postId }, env.JWT_SECRET, { expiresIn: "15m", audience: "media" });
  return `/api/media/stream/${postId}?ticket=${ticket}${thumbnail ? "&thumb=true" : ""}`;
}

export function verifyMediaTicket(ticket, postId) {
  try {
    const grant = jwt.verify(ticket, env.JWT_SECRET, { algorithms: ["HS256"], audience: "media" });
    return grant.scope === "post-media" && grant.postId === postId;
  } catch { return false; }
}
