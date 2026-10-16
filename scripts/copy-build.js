import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "frontend", "dist", "client");
const dest = path.resolve(root, "dist");

console.log(`[build] Copying build artifacts from ${src} to ${dest}...`);

if (fs.existsSync(path.join(src, "index.html"))) {
  // Remove only this project's generated output; refuse redirected directories.
  if (path.dirname(dest) !== root || path.basename(dest) !== "dist" ||
      (fs.existsSync(dest) && fs.lstatSync(dest).isSymbolicLink())) {
    throw new Error("Refusing to replace an unexpected build destination.");
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  if (!fs.existsSync(path.join(dest, "index.html"))) throw new Error("Build destination is missing index.html.");
  console.log("[build] Successfully copied frontend static assets to root dist directory.");
} else {
  console.error(`[build] Error: Source directory ${src} is missing index.html.`);
  process.exit(1);
}
