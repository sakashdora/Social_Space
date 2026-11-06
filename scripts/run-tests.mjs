// Backend test runner. Creates a throwaway SQLite database, applies the Prisma
// schema, and runs the Node test suite against it. No production credentials
// are read or required.
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const scratch = path.join(backend, ".wrangler", "tmp");
mkdirSync(scratch, { recursive: true });
const dbFile = path.join(scratch, `test-${Date.now()}-${randomBytes(4).toString("hex")}.db`);
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");
const env = { ...process.env, PRISMA_LOCAL_DATABASE_URL: `file:${dbFile}` };
delete env.DATABASE_URL;
delete env.DIRECT_URL;

const run = (args, options = {}) => spawnSync(process.execPath, args, { cwd: backend, stdio: "inherit", env, ...options });

let exitCode = 1;
try {
  if (run([prismaCli, "generate"]).status !== 0) throw new Error("prisma generate failed");
  // Apply the same SQL that D1 receives in production, in order.
  const migrationsDir = path.join(backend, "migrations");
  const db = new DatabaseSync(dbFile);
  try {
    for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
      db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
    }
  } finally {
    db.close();
  }

  const testFiles = [path.join(backend, "src", "tests", "api.test.js")];
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test", ...testFiles, ...process.argv.slice(2)], {
    cwd: backend,
    stdio: "inherit",
    env: { ...env, VEIL_TEST_DB_URL: pathToFileURL(dbFile).href.replace("file:///", "file:") },
  });
  exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
} finally {
  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-journal`, { force: true });
}
process.exit(exitCode);
