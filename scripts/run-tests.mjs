// Tests never inherit production credentials or connect to the development DB.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const require = createRequire(path.join(backend, "package.json"));
const run = (file, args, env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [file, ...args], { cwd: backend, env, stdio: "inherit", windowsHide: true });
  child.once("error", reject);
  child.once("exit", code => code === 0 ? resolve() : reject(new Error(`Check exited with ${code}`)));
});
let cluster;
let exitCode = 0;
try {
  let databaseUrl = process.env.TEST_DATABASE_URL;
  if (databaseUrl) {
    const parsed = new URL(databaseUrl);
    if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !parsed.pathname.startsWith("/veil_test")) throw new Error("TEST_DATABASE_URL must name a local veil_test database.");
  } else {
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    const port = await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); });
    });
    const password = randomBytes(24).toString("hex");
    const scratch = path.join(root, "tmp");
    await mkdir(scratch, { recursive: true });
    cluster = new EmbeddedPostgres({ databaseDir: path.join(scratch, `pg-tests-${Date.now()}`), user: "veil_test", password, port,
      persistent: true, createPostgresUser: false, postgresFlags: ["-h", "127.0.0.1", "-c", "timezone=UTC"], onLog: () => {}, onError: message => console.error(String(message)) });
    await cluster.initialise();
    await cluster.start();
    await cluster.createDatabase("veil_test");
    databaseUrl = `postgresql://veil_test:${password}@127.0.0.1:${port}/veil_test`;
  }
  const env = { ...process.env, NODE_ENV: "test", VERCEL: "1", DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl,
    JWT_SECRET: randomBytes(32).toString("hex"), ENCRYPTION_KEY: randomBytes(32).toString("hex"), RECOVERY_CODE_SECRET: randomBytes(32).toString("hex"),
    CRON_SECRET: randomBytes(32).toString("hex"), SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_ANON_KEY: "", SUPABASE_JWT_SECRET: "",
    AI_API_KEY: "", GROK_API_KEY: "", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "", MODERATOR_HANDLES: "moderator", FRONTEND_ORIGIN: "http://localhost:5173" };
  const prisma = require.resolve("prisma/build/index.js");
  await run(prisma, ["generate"], env);
  await run(prisma, ["migrate", "deploy"], env);
  await run(require.resolve("jest/bin/jest"), ["--runInBand", "--config", JSON.stringify({ testEnvironment: "node", transform: {}, testMatch: ["**/src/tests/**/*.test.js"], setupFilesAfterEnv: ["<rootDir>/src/tests/setup.js"], cacheDirectory: "<rootDir>/../tmp/jest-cache" }), ...process.argv.slice(2)], { ...env, NODE_OPTIONS: "--experimental-vm-modules" });
} catch (error) {
  console.error(error.message);
  exitCode = 1;
} finally {
  if (cluster) await cluster.stop();
}
process.exit(exitCode);
