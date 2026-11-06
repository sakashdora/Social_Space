// Prisma CLI configuration. The Worker itself gets its D1 binding at runtime;
// this file only tells the CLI where the schema lives and where a local file
// database would be if one is needed for tooling.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.PRISMA_LOCAL_DATABASE_URL ?? "file:./.wrangler/state/prisma-local.db",
  },
});
