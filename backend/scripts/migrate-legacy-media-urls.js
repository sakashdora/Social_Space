import prisma from "../src/config/prisma.js";

/**
 * One-time migration script for legacy mediaUrl fields.
 * Extracts storagePath from signed Supabase URLs and nulls out mediaUrl.
 */
async function migrateLegacyMediaUrls() {
  console.log("[migrate] Starting legacy media URL migration...");

  try {
    const legacyPosts = await prisma.post.findMany({
      where: {
        mediaUrl: { not: null },
        storagePath: null,
      },
      include: {
        media: true,
      },
    });

    console.log(`[migrate] Found ${legacyPosts.length} posts with legacy mediaUrl to migrate.`);

    let successCount = 0;
    let failureCount = 0;

    for (const post of legacyPosts) {
      const url = post.mediaUrl;
      let extractedPath = null;
      let thumbPath = null;

      // 1. If post already has a media relation with storagePath
      if (post.media?.storagePath) {
        extractedPath = post.media.storagePath;
        thumbPath = post.media.thumbnailPath;
      } else if (url) {
        // 2. Parse from Supabase signed or public URL pattern
        // Matches /veil-media/{path}?token=... or /veil-media/{path}
        const bucketMatch = url.match(/\/veil-media\/([^?#]+)/i);
        if (bucketMatch && bucketMatch[1]) {
          extractedPath = decodeURIComponent(bucketMatch[1]);
        } else {
          // Direct storage path pattern: media/{userId}/{mediaId}.ext
          const directMatch = url.match(/(media\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+)/i);
          if (directMatch && directMatch[1]) {
            extractedPath = directMatch[1];
          }
        }
      }

      if (extractedPath) {
        // Derive thumbnail path if it was a video and not already found
        if (!thumbPath && (extractedPath.endsWith(".mp4") || extractedPath.endsWith(".webm") || extractedPath.endsWith(".mov"))) {
          const dotIdx = extractedPath.lastIndexOf(".");
          if (dotIdx !== -1) {
            thumbPath = `${extractedPath.substring(0, dotIdx)}_thumb.jpg`;
          }
        }

        await prisma.post.update({
          where: { id: post.id },
          data: {
            storagePath: extractedPath,
            thumbStoragePath: thumbPath,
            mediaUrl: null, // Null out legacy URL
          },
        });

        console.log(`[migrate] ✓ Migrated post ${post.id}: storagePath=${extractedPath}`);
        successCount++;
      } else {
        console.warn(`[migrate] ✗ FAILED to parse post ${post.id}: mediaUrl="${url}". Requires manual review.`);
        failureCount++;
      }
    }

    console.log(`[migrate] Migration completed. ${successCount} succeeded, ${failureCount} failed.`);
    process.exit(0);
  } catch (err) {
    console.error("[migrate] Fatal migration error:", err);
    process.exit(1);
  }
}

migrateLegacyMediaUrls();
