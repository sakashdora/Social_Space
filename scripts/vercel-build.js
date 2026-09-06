import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const distHtml = path.join(process.cwd(), "dist", "index.html");

if (!fs.existsSync(distHtml)) {
  console.log("[vercel-build] dist/index.html not found. Executing full build pipeline...");
  execSync("npm run build", { stdio: "inherit" });
} else {
  console.log("[vercel-build] dist/index.html already built by previous step. Build is complete.");
}
