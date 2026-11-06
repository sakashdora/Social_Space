// Writes dist/client/_headers for Cloudflare Pages after the production build.
//
// Policy summary:
//   - Scripts come only from this origin. Inline scripts are allowed because the
//     TanStack Start streaming bootstrap injects them at runtime, and their content
//     cannot be whitelisted by hash. Third-party script hosts are not allowed.
//   - Network, media, frame and form targets are restricted; the API origin
//     (VITE_API_URL) is added to connect-src.
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "dist", "client");

if (!existsSync(path.join(outDir, "index.html"))) {
  console.error(
    "[security-headers] dist/client/index.html is missing. Run the build first.",
  );
  process.exit(1);
}

let apiOrigin = "";
if (process.env.VITE_API_URL) {
  try {
    apiOrigin = new URL(process.env.VITE_API_URL).origin;
  } catch {
    console.error("[security-headers] VITE_API_URL is not a valid URL.");
    process.exit(1);
  }
}
if (!apiOrigin) {
  console.warn(
    "[security-headers] VITE_API_URL is not set: connect-src will not allow the API origin.",
  );
}
const api = apiOrigin ? ` ${apiOrigin}` : "";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${api} https://cdn.jsdelivr.net https://storage.googleapis.com`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const headers = `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(self), geolocation=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Cross-Origin-Opener-Policy: same-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: no-cache

/
  Cache-Control: no-cache
`;

writeFileSync(path.join(outDir, "_headers"), headers, "utf8");
console.log(
  `[security-headers] wrote _headers${apiOrigin ? ` (API origin ${apiOrigin})` : ""}.`,
);
