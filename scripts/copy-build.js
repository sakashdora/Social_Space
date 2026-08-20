import fs from "fs";
import path from "path";

const src = path.join(process.cwd(), "frontend", "dist", "client");
const dest = path.join(process.cwd(), "dist");

console.log(`[build] Copying build artifacts from ${src} to ${dest}...`);

if (fs.existsSync(src)) {
  fs.cpSync(src, dest, { recursive: true });
  console.log("[build] Successfully copied frontend static assets to root dist directory.");
} else {
  console.error(`[build] Error: Source directory ${src} does not exist.`);
  process.exit(1);
}
