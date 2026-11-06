/**
 * src/config/prisma.js
 *
 * Compatibility entry point: controllers import the request-bound Prisma client
 * from here. The implementation lives in ./db.js.
 */
export { default, db, setDatabase, getClient } from "./db.js";
