import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkBuckets() {
  try {
    console.log("Connecting to database...");
    const buckets = await prisma.$queryRawUnsafe(`
      SELECT id, name, public, file_size_limit, allowed_mime_types 
      FROM storage.buckets
    `);
    console.log("=========================================");
    console.log("EXISTING SUPABASE BUCKETS:");
    console.log(JSON.stringify(buckets, (key, value) => typeof value === "bigint" ? value.toString() : value, 2));
    console.log("=========================================");
  } catch (err) {
    console.error("Failed to query storage buckets:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkBuckets();
