import prisma from "../src/config/prisma.js";

async function main() {
  const handle = "akash";
  const existing = await prisma.user.findUnique({
    where: { handle }
  });

  if (existing) {
    console.log(`User '${handle}' exists. Deleting user to allow clean registration...`);
    // Delete user's comments, posts, reactions, etc. to prevent FK violations
    await prisma.reaction.deleteMany({ where: { userId: existing.id } });
    await prisma.comment.deleteMany({ where: { userId: existing.id } });
    await prisma.post.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({
      where: { id: existing.id }
    });
    console.log(`Deleted user '${handle}'.`);
  } else {
    console.log(`User '${handle}' does not exist yet.`);
  }
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
