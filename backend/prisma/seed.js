import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing entries
  await prisma.reaction.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();

  // Create users
  const user1 = await prisma.user.create({
    data: {
      handle: "quiet-linen",
      recoveryHash: "$2a$10$tZg/rU8XG/PqS43wRz5t3ux1.zHwM5aW/m7jA.VjW5zE3FjG7G7G", // mock
      avatarUrl: "/assets/avatars/avatar-1.png",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      handle: "slow-orbit",
      recoveryHash: "$2a$10$tZg/rU8XG/PqS43wRz5t3ux1.zHwM5aW/m7jA.VjW5zE3FjG7G7G",
      avatarUrl: "/assets/avatars/avatar-2.png",
    },
  });

  const user3 = await prisma.user.create({
    data: {
      handle: "north-of-here",
      recoveryHash: "$2a$10$tZg/rU8XG/PqS43wRz5t3ux1.zHwM5aW/m7jA.VjW5zE3FjG7G7G",
      avatarUrl: "/assets/avatars/avatar-3.png",
    },
  });

  // Create posts
  const post1 = await prisma.post.create({
    data: {
      userId: user1.id,
      content: "First draft of the piece is out to my editor. Wrote it entirely on a device that has never touched my legal name. That still feels miraculous.",
      category: "Journalism",
      aiLabels: JSON.stringify({ safety: "clean" }),
      sentimentAnalysis: JSON.stringify({ sentiment: "positive", score: 0.8 }),
    },
  });

  const post2 = await prisma.post.create({
    data: {
      userId: user2.id,
      content: "Six months of writing here without anyone in my old life finding me. Whatever else Veil ships, don't add follower counts. This is the reason I stayed.",
      category: "Survivors",
      aiLabels: JSON.stringify({ safety: "clean" }),
      sentimentAnalysis: JSON.stringify({ sentiment: "positive", score: 0.7 }),
    },
  });

  const post3 = await prisma.post.create({
    data: {
      userId: user3.id,
      content: "PSA — the disappearing-message timer is per-thread now. Set it to 24h on your organizing threads and stop worrying about screenshots living forever.",
      category: "Activism",
      aiLabels: JSON.stringify({ safety: "clean" }),
      sentimentAnalysis: JSON.stringify({ sentiment: "neutral", score: 0.0 }),
    },
  });

  // Create comment
  await prisma.comment.create({
    data: {
      postId: post1.id,
      userId: user2.id,
      content: "Incredible work. Can't wait to read it.",
    },
  });

  // Create reaction
  await prisma.reaction.create({
    data: {
      userId: user1.id,
      postId: post2.id,
      reactionType: "heart",
    },
  });

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
