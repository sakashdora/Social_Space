import { afterAll } from "@jest/globals";
import prisma from "../config/prisma.js";
import { pgPool } from "../config/pgPool.js";

afterAll(async () => {
  await prisma.$disconnect();
  await pgPool.end();
});
