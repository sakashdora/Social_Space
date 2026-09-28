import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

// Preserve PrismaClient instance across warm serverless container invocations
const prisma = globalForPrisma.prisma || new PrismaClient();

globalForPrisma.prisma = prisma;

export default prisma;
