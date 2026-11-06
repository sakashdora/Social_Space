/**
 * src/config/db.js
 *
 * Prisma client bound to Cloudflare D1 (SQLite).
 *
 * - In a Worker, the D1 binding (`env.DB`) is wrapped with @prisma/adapter-d1.
 * - In Node (unit tests, or a local script), `TEST_SQLITE_URL` selects a local
 *   SQLite file through @prisma/adapter-libsql instead. The adapter is loaded
 *   through a non-literal specifier so the Worker bundle never includes it.
 *
 * The exported `db` is a stable proxy: call sites keep writing `db.user.findUnique(...)`
 * and the underlying client is created on first use for the current binding.
 */

import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaD1 } from "@prisma/adapter-d1";

// Node-only modules are loaded through runtime-computed specifiers so the Worker
// bundle never contains them (they need native or filesystem access).
const LIBSQL_ADAPTER_SPECIFIER = "@prisma/adapter-libsql";

let current = null;
let currentKey = null;

async function createNodeClient(url) {
  // Computed only on the Node path: `import.meta.url` is not a usable URL inside Workers.
  const nodeClientSpecifier = new URL("../generated/prisma-node/client.ts", import.meta.url).href;
  const [{ PrismaClient: NodeClient }, adapterModule] = await Promise.all([
    import(/* @vite-ignore */ nodeClientSpecifier),
    import(/* @vite-ignore */ LIBSQL_ADAPTER_SPECIFIER),
  ]);
  return new NodeClient({ adapter: new adapterModule.PrismaLibSql({ url }) });
}

/**
 * Returns a PrismaClient for the given bindings. Clients are cached per D1
 * binding so warm isolates reuse connections.
 *
 * @param {{ DB?: unknown, TEST_SQLITE_URL?: string }} bindings
 */
export async function getClient(bindings = {}) {
  if (bindings.DB) {
    if (current && currentKey === bindings.DB) return current;
    current = new PrismaClient({ adapter: new PrismaD1(bindings.DB) });
    currentKey = bindings.DB;
    return current;
  }
  if (bindings.TEST_SQLITE_URL) {
    if (current && currentKey === bindings.TEST_SQLITE_URL) return current;
    current = await createNodeClient(bindings.TEST_SQLITE_URL);
    currentKey = bindings.TEST_SQLITE_URL;
    return current;
  }
  throw new Error("No database binding is configured (expected D1 binding DB).");
}

/**
 * Lazily-resolved client used by controllers. `setDatabase(bindings)` must be
 * called once per request before any query; it is cheap after the first call.
 */
export const db = new Proxy({}, {
  get(_target, property) {
    if (!current) {
      throw new Error("Database used before the request bindings were initialised.");
    }
    const value = current[property];
    return typeof value === "function" ? value.bind(current) : value;
  },
});

/** Binds the database for this request. Returns the client. */
export async function setDatabase(bindings) {
  return getClient(bindings);
}

export default db;
