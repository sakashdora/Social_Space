// Fails when credentials are present in tracked files or in the browser bundle.
//
//   node scripts/check-secrets.mjs            scan git-tracked files
//   node scripts/check-secrets.mjs --dist     also scan frontend/dist/client (what users download)
//
// Only pattern names and masked fragments are printed, never the matched value.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const RULES = [
  { name: "private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: "Groq key", re: /\bgsk_[A-Za-z0-9]{20,}/ },
  { name: "xAI key", re: /\bxai-[A-Za-z0-9]{20,}/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "OpenAI-style secret key", re: /\bsk-[A-Za-z0-9_-]{32,}/ },
  { name: "Stripe live key", re: /\bsk_live_[A-Za-z0-9]{16,}/ },
  { name: "Supabase secret key", re: /\bsb_secret_[A-Za-z0-9_-]{16,}/ },
  { name: "Cloudflare API token assignment", re: /CLOUDFLARE_API_TOKEN\s*[:=]\s*["']?[A-Za-z0-9_-]{30,}/ },
  { name: "database URL with password", re: /postgres(?:ql)?:\/\/[^\s:/@'"]+:[^\s@'"]{6,}@/ },
  { name: "secret assigned a literal value", re: /\b(?:JWT_SECRET|ENCRYPTION_KEY|RECOVERY_CODE_SECRET|CRON_SECRET|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|DIRECT_URL|GROK_API_KEY|AI_API_KEY)\s*[:=]\s*["']?(?!replace|REPLACE|\$\{|<|your|YOUR|example|\s*$)[A-Za-z0-9+/_=.-]{24,}/ },
];

const SKIP_FILES = new Set(["package-lock.json"]);
const TEXT_EXT = /\.(?:[cm]?[jt]sx?|json|ya?ml|toml|md|html|css|txt|env|example|sql|conf|ini|sh|ps1|mjs|cjs|prisma|vars)$|(?:^|\/)\.(?:env|dev\.vars)[^/]*$|Dockerfile$|\.dev\.vars/i;

function tracked() {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const findings = [];

// Obvious placeholders in documentation and templates are not credentials.
const PLACEHOLDER = /\[|<|YOUR|PASSWORD|password|example|localhost|127\.0\.0\.1|REPLACE|PROJECT_REF/i;

function scan(relPath, text) {
  text.split(/\r?\n/).forEach((line, index) => {
    for (const rule of RULES) {
      const match = line.match(rule.re);
      if (match && !PLACEHOLDER.test(match[0])) findings.push(`${relPath}:${index + 1}  [${rule.name}]`);
    }
  });
}

// 1. Tracked files: no env files with values, no credentials in source.
for (const file of tracked()) {
  const base = path.basename(file);
  const isEnvFile = /^\.env(\..+)?$/.test(base) || base === ".dev.vars";
  if (isEnvFile && !/\.example$/.test(base)) {
    findings.push(`${file}  [environment file is tracked by git]`);
    continue;
  }
  if (SKIP_FILES.has(base) || !TEXT_EXT.test(file)) continue;
  const full = path.join(root, file);
  if (!existsSync(full)) continue;
  scan(file, readFileSync(full, "utf8"));
}

// 2. Browser bundle: only public, non-secret variables may be inlined.
if (process.argv.includes("--dist")) {
  const dist = path.join(root, "frontend", "dist", "client");
  if (existsSync(dist)) {
    for (const file of walk(dist).filter((f) => /\.(?:js|html|css|json|txt)$/.test(f))) {
      scan(path.relative(root, file), readFileSync(file, "utf8"));
    }
  } else {
    console.log("[check-secrets] no build output found; skipping --dist scan.");
  }
}

if (findings.length > 0) {
  console.error(`[check-secrets] ${findings.length} potential credential(s) found:`);
  for (const finding of findings) console.error(`  ${finding}`);
  console.error("Remove the value, rotate it if it was real, and store it with `wrangler secret put` instead.");
  process.exit(1);
}
console.log("[check-secrets] no credentials found in tracked files" + (process.argv.includes("--dist") ? " or the browser bundle." : "."));
