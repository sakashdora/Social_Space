import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import sharp from "sharp";
import crypto from "node:crypto";
import prisma from "../config/prisma.js";
import { generateToken } from "../utils/jwt.js";

const objects = new Map();
const removed = [];
await jest.unstable_mockModule("../config/supabase.js", () => ({ supabase: { storage: { from: () => ({
  createSignedUploadUrl: async path => ({ data: { signedUrl: `https://storage.invalid/${path}` } }),
  info: async path => objects.has(path) ? { data: { size: objects.get(path).length } } : { error: new Error("Not found") },
  download: async path => ({ data: new Blob([objects.get(path)]) }),
  upload: async (path, value) => { objects.set(path, Buffer.from(value)); return { data: { path } }; },
  createSignedUrl: async path => ({ data: { signedUrl: `https://storage.invalid/${path}` } }),
  remove: async paths => { paths.forEach(path => { objects.delete(path); removed.push(path); }); return {}; },
}) } } }));
await jest.unstable_mockModule("../services/ai.service.js", () => ({
  analyzeContent: async () => ({ isFlagged: false, labels: [], sentiment: {} }),
  generateArticle: async () => "Fixture article", correctGrammar: async text => text, getSuggestions: async () => [],
}));
const { default: app } = await import("../../app.js");
const { runRetentionCleanup } = await import("../services/cron.service.js");
const { store } = await import("../config/challengeStore.js");
let alice, bob, eve;
const auth = user => `Bearer ${generateToken(user.id, user.tokenVersion)}`;
const post = (user, body = {}) => request(app).post("/v1/posts").set("Authorization", auth(user)).send({ content: "A thoughtful post", category: "Ideas", mode: "pseudo", ...body });
const seedMedia = async (user, extra = {}) => prisma.media.create({ data: { userId: user.id, type: "IMAGE", storagePath: `media/${crypto.randomUUID()}.webp`, mimeType: "image/webp", sizeBytes: 100, ...extra } });

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "User", "Post", "Comment", "Thread", "Media", "StorageDeletion", "AuthChallenge", "LoginAttempt", "rate_limit_counters" CASCADE');
  objects.clear(); removed.length = 0;
  [alice, bob, eve] = await Promise.all(["alice", "bob", "eve"].map(handle => prisma.user.create({ data: { handle, recoveryHash: "test-only" } })));
});

describe("Publishing authorization and privacy", () => {
  it("does not allow an unverified path or another user's media", async () => {
    expect((await post(alice, { storagePath: "media/victim/private.jpg" })).status).toBe(400);
    const media = await seedMedia(bob);
    expect((await post(alice, { mediaId: media.id })).status).toBe(403);
  });
  it("returns no private owner or storage fields for anonymous media posts, including creation", async () => {
    const media = await seedMedia(alice);
    const created = await post(alice, { mode: "full", mediaId: media.id });
    expect(created.status).toBe(201);
    const detail = await request(app).get(`/v1/posts/${created.body.id}`);
    for (const response of [created, detail]) {
      expect(response.body.userId).toBeNull();
      expect(JSON.stringify(response.body)).not.toContain(alice.id);
      expect(JSON.stringify(response.body)).not.toContain(media.storagePath);
      expect(response.body).not.toHaveProperty("ownerId");
      expect(response.body.media).toEqual({ type: "IMAGE" });
    }
    expect((await request(app).delete(`/v1/posts/${created.body.id}`).set("Authorization", auth(alice))).status).toBe(200);
  });
  it("enforces selected audience on feed, details, comments and streaming", async () => {
    const media = await seedMedia(alice);
    const created = await post(alice, { audience: "selected", selectedHandles: ["bob"], mediaId: media.id });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await request(app).get(`/v1/posts/${id}`)).status).toBe(404);
    expect((await request(app).get(`/v1/posts/${id}`).set("Authorization", auth(bob))).status).toBe(200);
    expect((await request(app).get(`/v1/posts/${id}/comments`).set("Authorization", auth(eve))).status).toBe(404);
    expect((await request(app).get(`/api/media/stream/${id}`).set("Authorization", auth(eve))).status).toBe(404);
    expect((await request(app).get("/v1/posts").set("Authorization", auth(eve))).body).toHaveLength(0);
  });
  it("enforces circle membership and follows persist", async () => {
    expect((await request(app).put("/v1/users/bob/follow").set("Authorization", auth(alice))).status).toBe(200);
    const created = await post(alice, { audience: "circle" });
    expect((await request(app).get(`/v1/posts/${created.body.id}`).set("Authorization", auth(bob))).status).toBe(200);
    await request(app).delete("/v1/users/bob/follow").set("Authorization", auth(alice));
    expect((await request(app).get(`/v1/posts/${created.body.id}`).set("Authorization", auth(bob))).status).toBe(404);
  });
  it("enforces post expiry and engagement permissions", async () => {
    const created = await post(alice, { lifetime: "24h", engagement: { allowReplies: false, allowReactions: false, allowReposts: false } });
    const id = created.body.id;
    expect(new Date(created.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect((await request(app).post(`/v1/posts/${id}/comments`).set("Authorization", auth(bob)).send({ content: "reply" })).status).toBe(403);
    expect((await request(app).post("/v1/reactions").set("Authorization", auth(bob)).send({ postId: id, reactionType: "heart" })).status).toBe(403);
    expect((await post(bob, { sharedPostId: id })).status).toBe(403);
    await prisma.post.update({ where: { id }, data: { expiresAt: new Date(0) } });
    expect((await request(app).get(`/v1/posts/${id}`)).status).toBe(404);
  });
  it("does not leak a deleted original through a repost", async () => {
    const original = await post(alice);
    const shared = await post(bob, { sharedPostId: original.body.id });
    await request(app).delete(`/v1/posts/${original.body.id}`).set("Authorization", auth(alice));
    const detail = await request(app).get(`/v1/posts/${shared.body.id}`);
    expect(detail.body.sharedPost).toBeNull();
    expect((await request(app).get("/v1/posts")).body[0].sharedPost).toBeNull();
  });
  it("prevents cross-post parent comments", async () => {
    const one = await post(alice); const two = await post(alice);
    const comment = await request(app).post(`/v1/posts/${one.body.id}/comments`).set("Authorization", auth(bob)).send({ content: "reply" });
    expect((await request(app).post(`/v1/posts/${two.body.id}/comments`).set("Authorization", auth(bob)).send({ content: "reply", parentCommentId: comment.body.id })).status).toBe(404);
  });
  it("serializes concurrent reaction toggles and enforces database uniqueness", async () => {
    const created = await post(alice); const id = created.body.id;
    const responses = await Promise.all(Array.from({ length: 8 }, () => request(app).post("/v1/reactions").set("Authorization", auth(bob)).send({ postId: id, reactionType: "heart" })));
    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(await prisma.reaction.count({ where: { postId: id, userId: bob.id } })).toBe(0);
    await prisma.reaction.create({ data: { userId: bob.id, postId: id, reactionType: "heart" } });
    await expect(prisma.reaction.create({ data: { userId: bob.id, postId: id, reactionType: "heart" } })).rejects.toMatchObject({ code: "P2002" });
  });
  it("persists one poll vote per user", async () => {
    const created = await post(alice, { pollOptions: ["Yes", "No"] });
    const endpoint = `/v1/posts/${created.body.id}/vote`;
    await request(app).post(endpoint).set("Authorization", auth(bob)).send({ optionIndex: 0 });
    const response = await request(app).post(endpoint).set("Authorization", auth(bob)).send({ optionIndex: 1 });
    expect(response.body.pollOptions.map(option => option.votes)).toEqual([0, 1]);
    expect(response.body.votedOption).toBe(1);
  });
});

describe("Upload and cleanup boundaries", () => {
  it("rejects forged confirmation and nonpositive upload size", async () => {
    const id = crypto.randomUUID();
    expect((await request(app).post("/api/media/confirm").set("Authorization", auth(alice)).send({ mediaId: id, storagePath: "media/victim/file.jpg", sizeBytes: -50, mimeType: "image/jpeg" })).status).toBe(404);
    expect((await request(app).post("/api/media/upload-url").set("Authorization", auth(alice)).send({ filename: "bad.jpg", mimeType: "image/jpeg", sizeBytes: -50 })).status).toBe(413);
  });
  it("validates actual image bytes, strips metadata and finalizes an opaque path", async () => {
    const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).jpeg().toBuffer();
    const initialized = await request(app).post("/api/media/upload-url").set("Authorization", auth(alice)).send({ filename: "photo.jpg", mimeType: "image/jpeg", sizeBytes: bytes.length });
    expect(initialized.status).toBe(200);
    const media = await prisma.media.findUnique({ where: { id: initialized.body.mediaId } });
    objects.set(media.uploadPath, bytes);
    const confirmed = await request(app).post("/api/media/confirm").set("Authorization", auth(alice)).send({ mediaId: media.id });
    expect(confirmed.status).toBe(201);
    const stored = await prisma.media.findUnique({ where: { id: media.id } });
    expect(stored.status).toBe("ready"); expect(stored.mimeType).toBe("image/webp");
    expect(stored.storagePath).not.toContain(alice.id);
    expect((await sharp(objects.get(stored.storagePath)).metadata()).exif).toBeUndefined();
    expect((await request(app).post("/api/media/confirm").set("Authorization", auth(bob)).send({ mediaId: media.id })).status).toBe(404);
  });
  it("rejects a size mismatch and arbitrary bytes claimed as images", async () => {
    for (const mismatch of [true, false]) {
      const initialized = await request(app).post("/api/media/upload-url").set("Authorization", auth(alice)).send({ filename: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 10 });
      const media = await prisma.media.findUnique({ where: { id: initialized.body.mediaId } });
      objects.set(media.uploadPath, Buffer.alloc(mismatch ? 11 : 10));
      expect((await request(app).post("/api/media/confirm").set("Authorization", auth(alice)).send({ mediaId: media.id })).status).toBe(mismatch ? 413 : 422);
    }
  });
  it("rejects the cron header bypass and missing configuration", async () => {
    const response = await request(app).get("/api/cron/retention").set("x-vercel-cron", "1").set("Authorization", "Bearer wrong");
    expect(response.status).toBe(401);
    const secret = process.env.CRON_SECRET; delete process.env.CRON_SECRET;
    expect((await request(app).get("/api/cron/retention")).status).toBe(503);
    process.env.CRON_SECRET = secret;
  });
  it("preserves active accounts with an elapsed deletion deadline", async () => {
    await prisma.user.update({ where: { id: alice.id }, data: { lastActiveAt: new Date(), pendingDeletionAt: new Date(0) } });
    await runRetentionCleanup();
    expect(await prisma.user.findUnique({ where: { id: alice.id } })).not.toBeNull();
    await request(app).get("/v1/auth/me").set("Authorization", auth(alice));
    expect((await prisma.user.findUnique({ where: { id: alice.id } })).pendingDeletionAt).toBeNull();
  });
  it("queues and removes storage before losing references on inactivity deletion", async () => {
    const media = await seedMedia(eve); objects.set(media.storagePath, Buffer.from("old"));
    await prisma.user.update({ where: { id: eve.id }, data: { lastActiveAt: new Date(0), pendingDeletionAt: new Date(1) } });
    await runRetentionCleanup();
    expect(await prisma.user.findUnique({ where: { id: eve.id } })).toBeNull();
    expect(removed).toContain(media.storagePath);
  });
  it("consumes shared challenges exactly once across simultaneous requests", async () => {
    await store.set("fixture:challenge", { challenge: "one-use" }, 60);
    const stored = await prisma.authChallenge.findUnique({ where: { key: "fixture:challenge" } });
    expect(stored.value.encryptedValue).toEqual(expect.any(String));
    expect(JSON.stringify(stored.value)).not.toContain("one-use");
    expect(await store.get("fixture:challenge")).toEqual({ challenge: "one-use" });
    const responses = await Promise.all([store.take("fixture:challenge"), store.take("fixture:challenge")]);
    expect(responses.filter(Boolean)).toEqual([{ challenge: "one-use" }]);
  });
  it("enforces the rate limit on the serverless entry path", async () => {
    const responses = [];
    for (let index = 0; index < 21; index++) responses.push(await request(app).post("/api/generate").send({ topic: "A short topic" }));
    expect(responses.slice(0, 20).every(response => response.status === 200)).toBe(true);
    expect(responses[20].status).toBe(429);
  });
});

describe("Messaging and durable product flows", () => {
  it("links encrypted attachments only once and restricts access to unexpired conversations", async () => {
    const chat = await request(app).post("/v1/chats").set("Authorization", auth(alice)).send({ targetHandle: "bob" });
    const threadId = chat.body.threadId;
    await prisma.user.update({ where: { id: alice.id }, data: { chatPublicKey: "alice-key" } });
    await prisma.user.update({ where: { id: bob.id }, data: { chatPublicKey: "bob-key" } });
    const media = await seedMedia(alice, { type: "FILE", purpose: "chat", threadId, expiresAt: new Date(Date.now() + 600000) });
    const endpoint = `/api/media/attachments/${media.id}`;
    expect((await request(app).get(endpoint).set("Authorization", auth(alice))).status).toBe(404);
    const body = JSON.stringify({ v: 2, senderKey: "alice-key", recipientKey: "bob-key", ciphertext: Buffer.alloc(32).toString("base64"), iv: Buffer.alloc(12).toString("base64") });
    const send = () => request(app).post(`/v1/chats/${threadId}/messages`).set("Authorization", auth(alice)).send({ body, mediaId: media.id });
    const sent = await send(); expect(sent.status).toBe(201);
    expect((await send()).status).toBe(403);
    expect((await request(app).get(endpoint).set("Authorization", auth(bob))).status).toBe(200);
    expect((await request(app).get(endpoint).set("Authorization", auth(eve))).status).toBe(404);
    await prisma.message.updateMany({ where: { mediaId: media.id }, data: { expiresAt: new Date(0) } });
    expect((await request(app).get(endpoint).set("Authorization", auth(bob))).status).toBe(404);
  });
  it("reserves concurrent upload quotas before issuing tickets", async () => {
    await seedMedia(alice, { sizeBytes: 70 * 1024 * 1024 });
    const reserve = () => request(app).post("/api/media/upload-url").set("Authorization", auth(alice)).send({ mimeType: "image/png", sizeBytes: 20 * 1024 * 1024 });
    expect((await Promise.all([reserve(), reserve()])).map(response => response.status).sort()).toEqual([200, 413]);
  });
  it("hides expired messages and their previews, and denies nonparticipants", async () => {
    const chat = await request(app).post("/v1/chats").set("Authorization", auth(alice)).send({ targetHandle: "bob" });
    const threadId = chat.body.threadId;
    await prisma.message.create({ data: { threadId, senderId: alice.id, body: "expired ciphertext", expiresAt: new Date(1) } });
    expect((await request(app).get(`/v1/chats/${threadId}`).set("Authorization", auth(bob))).body).toHaveLength(0);
    expect((await request(app).get("/v1/chats").set("Authorization", auth(bob))).body[0].preview).toBe("No messages yet");
    expect((await request(app).get(`/v1/chats/${threadId}`).set("Authorization", auth(eve))).status).toBe(403);
  });
  it("requires encrypted message envelopes with current participant keys", async () => {
    const chat = await request(app).post("/v1/chats").set("Authorization", auth(alice)).send({ targetHandle: "bob" });
    const url = `/v1/chats/${chat.body.threadId}/messages`;
    expect((await request(app).post(url).set("Authorization", auth(alice)).send({ body: "plaintext" })).status).toBe(400);
    await prisma.user.update({ where: { id: alice.id }, data: { chatPublicKey: "alice-key" } });
    await prisma.user.update({ where: { id: bob.id }, data: { chatPublicKey: "bob-key" } });
    const envelope = { v: 2, ciphertext: Buffer.alloc(32).toString("base64"), iv: Buffer.alloc(12).toString("base64"), senderKey: "alice-key", recipientKey: "bob-key" };
    expect((await request(app).post(url).set("Authorization", auth(alice)).send({ body: JSON.stringify(envelope) })).status).toBe(201);
    envelope.recipientKey = "old-key";
    expect((await request(app).post(url).set("Authorization", auth(alice)).send({ body: JSON.stringify(envelope) })).status).toBe(409);
  });
  it("bounds message history and supports older-page cursors", async () => {
    const chat = await request(app).post("/v1/chats").set("Authorization", auth(alice)).send({ targetHandle: "bob" });
    const threadId = chat.body.threadId;
    await prisma.message.createMany({ data: Array.from({ length: 65 }, (_, index) => ({ threadId, senderId: alice.id, body: `encrypted-${index}`, createdAt: new Date(Date.now() - (65 - index) * 1000), expiresAt: new Date(Date.now() + 600000) })) });
    const page = await request(app).get(`/v1/chats/${threadId}`).set("Authorization", auth(bob));
    expect(page.body).toHaveLength(50);
    const older = await request(app).get(`/v1/chats/${threadId}?before=${page.body[0].id}`).set("Authorization", auth(bob));
    expect(older.body).toHaveLength(15);
  });
  it("persists reports, appeals and waitlist enrollment with owner-only access", async () => {
    const report = await request(app).post("/v1/community/reports").set("Authorization", auth(alice)).send({ target: "post-123", category: "Harassment", reason: "Please review" });
    expect(report.status).toBe(201);
    expect((await request(app).get("/v1/community/reports").set("Authorization", auth(alice))).body).toHaveLength(1);
    expect((await request(app).get("/v1/community/reports").set("Authorization", auth(bob))).body).toHaveLength(0);
    expect((await request(app).post("/v1/community/appeals").set("Authorization", auth(alice)).send({ reference: report.body.id, reason: "Please reconsider" })).status).toBe(201);
    await request(app).post("/v1/community/waitlist").set("Authorization", auth(alice));
    expect((await request(app).get("/v1/community/waitlist").set("Authorization", auth(alice))).body.joined).toBe(true);
    expect((await request(app).get("/v1/community/moderation").set("Authorization", auth(bob))).status).toBe(403);
  });
});
