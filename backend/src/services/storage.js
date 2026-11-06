/**
 * src/services/storage.js
 *
 * Object storage on Cloudflare R2 (binding `MEDIA`). Keys are server-generated
 * random names; user-supplied text never becomes part of a key.
 */

import { runtime } from "../config/runtime.js";

const MAX_KEY_LENGTH = 200;

function bucket() {
  const bound = runtime.bindings.MEDIA;
  if (!bound) {
    throw Object.assign(new Error("Storage is not configured."), { status: 503 });
  }
  return bound;
}

export function isStorageConfigured() {
  return !!runtime.bindings.MEDIA;
}

export function assertSafeKey(key) {
  if (typeof key !== "string" || key.length === 0 || key.length > MAX_KEY_LENGTH) {
    throw new Error("Invalid storage key.");
  }
  if (key.startsWith("/") || key.includes("..") || /[\u0000-\u001f\\]/.test(key)) {
    throw new Error("Invalid storage key.");
  }
  return key;
}

export async function putObject(key, body, { contentType } = {}) {
  assertSafeKey(key);
  return bucket().put(key, body, {
    httpMetadata: { contentType: contentType || "application/octet-stream" },
  });
}

export async function getObject(key, options = {}) {
  assertSafeKey(key);
  return bucket().get(key, options);
}

export async function headObject(key) {
  assertSafeKey(key);
  return bucket().head(key);
}

export async function deleteObject(key) {
  assertSafeKey(key);
  await bucket().delete(key);
}
