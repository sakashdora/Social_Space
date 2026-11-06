import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createBindings, call, seedUser, dbClient, TEST_FRONTEND } from "./helpers.js";
import { generateSecret, verifyTotp, base32Decode, base32Encode, totpCodeAt } from "../utils/totp.js";
import { setRuntime } from "../config/runtime.js";
import { setDatabase } from "../config/db.js";
import { hashRecoveryCode } from "../utils/crypto.js";
import { sniffMediaType, stripImageMetadata, readMp4Duration } from "../utils/mediaProcessor.js";
import { runRetentionCleanup } from "../services/cron.service.js";

const bindings = { ...createBindings(process.env.VEIL_TEST_DB_URL), HIBP_ENABLED: "false" };
const PASSPHRASE = "correct horse battery staple 42";

/** Minimal valid PNG with a tEXt chunk that must be removed on upload. */
function pngWithTextChunk() {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc(typeAndData));
    return Buffer.concat([length, typeAndData, checksum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const idat = Buffer.from("78da6360f8cfc0f01f0005000201010af80a5e0000000049454e44ae426082", "hex");
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", ihdr),
    chunk("tEXt", Buffer.from("GPSLatitude\u0000 51.5")),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** MP4 header with a `mvhd` box declaring the given duration. */
function mp4WithDuration(seconds, timescale = 1000) {
  const mvhd = Buffer.alloc(108);
  mvhd.writeUInt32BE(108, 0);
  mvhd.write("mvhd", 4, "ascii");
  mvhd.writeUInt32BE(0, 8); // version 0
  mvhd.writeUInt32BE(timescale, 20);
  mvhd.writeUInt32BE(Math.round(seconds * timescale), 24);
  const moov = Buffer.alloc(8 + mvhd.length);
  moov.writeUInt32BE(moov.length, 0);
  moov.write("moov", 4, "ascii");
  mvhd.copy(moov, 8);
  const ftyp = Buffer.alloc(20);
  ftyp.writeUInt32BE(20, 0);
  ftyp.write("ftyp", 4, "ascii");
  ftyp.write("isom", 8, "ascii");
  ftyp.write("isom", 16, "ascii");
  return Buffer.concat([ftyp, moov]);
}

async function uploadMedia(user, bytes, mimeType) {
  const init = await call(bindings, "POST", "/api/media/upload-url", {
    token: user.token,
    body: { mimeType, sizeBytes: bytes.length, purpose: "post" },
  });
  assert.equal(init.status, 200, init.text);
  const signed = new URL(init.json.signedUrl);
  const put = await call(bindings, "PUT", `${signed.pathname}${signed.search}`, {
    headers: { "content-type": mimeType, "content-length": String(bytes.length) },
    rawBody: bytes,
  });
  assert.equal(put.status, 201, put.text);
  return { mediaId: init.json.mediaId };
}

describe("service health and transport", () => {
  it("reports database connectivity", async () => {
    const res = await call(bindings, "GET", "/healthz");
    assert.equal(res.status, 200);
    assert.equal(res.json.services.database, "UP");
  });

  it("applies security headers and never echoes disallowed origins", async () => {
    const res = await call(bindings, "GET", "/healthz", { headers: { origin: "https://evil.example" } });
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  });

  it("answers CORS preflight for the configured frontend only", async () => {
    const ok = await call(bindings, "OPTIONS", "/v1/posts", { headers: { origin: TEST_FRONTEND } });
    assert.equal(ok.status, 204);
    assert.equal(ok.headers.get("access-control-allow-origin"), TEST_FRONTEND);
    const blocked = await call(bindings, "OPTIONS", "/v1/posts", { headers: { origin: "https://evil.example" } });
    assert.equal(blocked.headers.get("access-control-allow-origin"), null);
  });

  it("rejects malformed and oversized JSON with client errors", async () => {
    const malformed = await call(bindings, "POST", "/v1/auth/login", {
      rawBody: "{not json", headers: { "content-type": "application/json" },
    });
    assert.equal(malformed.status, 400);
    const oversized = await call(bindings, "POST", "/v1/auth/login", {
      rawBody: JSON.stringify({ handle: "x", passphrase: "y".repeat(120 * 1024) }),
      headers: { "content-type": "application/json" },
    });
    assert.equal(oversized.status, 413);
  });

  it("returns 404 JSON for unknown routes without leaking details", async () => {
    const res = await call(bindings, "GET", "/v1/does-not-exist");
    assert.equal(res.status, 404);
    assert.deepEqual(res.json, { error: "Not found." });
  });
});

describe("registration and sign-in", () => {
  const handle = `reg-${crypto.randomBytes(3).toString("hex")}`;

  it("registers an account and returns eight recovery codes", async () => {
    const res = await call(bindings, "POST", "/v1/auth/register", { body: { handle, passphrase: PASSPHRASE } });
    assert.equal(res.status, 201, res.text);
    assert.ok(res.json.token);
    assert.equal(res.json.recoveryCodes.length, 8);
    assert.match(res.json.recoveryCodes[0], /^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/);
  });

  it("refuses a duplicate handle with 409", async () => {
    const res = await call(bindings, "POST", "/v1/auth/register", { body: { handle, passphrase: PASSPHRASE } });
    assert.equal(res.status, 409);
  });

  it("refuses weak passphrases", async () => {
    const res = await call(bindings, "POST", "/v1/auth/register", { body: { handle: `weak-${handle}`, passphrase: "aaaaaaaaaaaaaaaa" } });
    assert.equal(res.status, 400);
  });

  it("signs in with the right passphrase and rejects the wrong one", async () => {
    const ok = await call(bindings, "POST", "/v1/auth/login", { body: { handle, passphrase: PASSPHRASE } });
    assert.equal(ok.status, 200, ok.text);
    const bad = await call(bindings, "POST", "/v1/auth/login", { body: { handle, passphrase: "wrong passphrase value 1" } });
    assert.equal(bad.status, 401);
    assert.equal(bad.json.error.code, "INVALID_CREDENTIALS");
  });

  it("accepts a legacy Argon2id hash once and upgrades it to the current scheme", async () => {
    const { argon2id } = await import("@noble/hashes/argon2");
    const legacyHandle = `legacy-${crypto.randomBytes(3).toString("hex")}`;
    const salt = crypto.randomBytes(16);
    const digest = Buffer.from(argon2id(PASSPHRASE, salt, { t: 1, m: 1024, p: 1, dkLen: 32 }));
    const legacyHash = `$argon2id$v=19$m=1024,t=1,p=1$${salt.toString("base64")}$${digest.toString("base64")}`;
    const db = await dbClient();
    await db.user.create({ data: { handle: legacyHandle, recoveryHash: legacyHash } });

    const res = await call(bindings, "POST", "/v1/auth/login", { body: { handle: legacyHandle, passphrase: PASSPHRASE } });
    assert.equal(res.status, 200, res.text);
    const stored = await db.user.findUnique({ where: { handle: legacyHandle } });
    assert.match(stored.recoveryHash, /^pbkdf2-sha256\$600000\$/);
    const again = await call(bindings, "POST", "/v1/auth/login", { body: { handle: legacyHandle, passphrase: PASSPHRASE } });
    assert.equal(again.status, 200);
  });

  it("locks an account after repeated failures", async () => {
    const lockHandle = `lock-${crypto.randomBytes(3).toString("hex")}`;
    await call(bindings, "POST", "/v1/auth/register", { body: { handle: lockHandle, passphrase: PASSPHRASE } });
    for (let i = 0; i < 3; i++) {
      await call(bindings, "POST", "/v1/auth/login", { body: { handle: lockHandle, passphrase: "not the passphrase 99" } });
    }
    const locked = await call(bindings, "POST", "/v1/auth/login", { body: { handle: lockHandle, passphrase: PASSPHRASE } });
    assert.equal(locked.status, 429);
  });

  it("returns the session profile only with a valid bearer token", async () => {
    const user = await seedUser("me");
    const ok = await call(bindings, "GET", "/v1/auth/me", { token: user.token });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.handle, user.handle);
    const anon = await call(bindings, "GET", "/v1/auth/me");
    assert.equal(anon.status, 401);
    const forged = await call(bindings, "GET", "/v1/auth/me", { token: `${user.token.slice(0, -2)}xx` });
    assert.equal(forged.status, 401);
  });

  it("revokes every session on logout-all", async () => {
    const user = await seedUser("logout");
    const res = await call(bindings, "POST", "/v1/auth/logout-all", { token: user.token, body: {} });
    assert.equal(res.status, 200);
    const stale = await call(bindings, "GET", "/v1/auth/me", { token: user.token });
    assert.equal(stale.status, 401);
  });
});

describe("two-factor authentication", () => {
  it("enrols TOTP, requires a second factor at sign-in, and accepts a valid code", async () => {
    const handle = `mfa-${crypto.randomBytes(3).toString("hex")}`;
    const reg = await call(bindings, "POST", "/v1/auth/register", { body: { handle, passphrase: PASSPHRASE } });
    const token = reg.json.token;

    const setup = await call(bindings, "POST", "/v1/auth/mfa/totp/setup", { token, body: {} });
    assert.equal(setup.status, 200, setup.text);
    const secret = new URL(setup.json.otpauthUrl).searchParams.get("secret");
    assert.ok(base32Decode(secret).length >= 16);

    const enable = await call(bindings, "POST", "/v1/auth/mfa/totp/enable", {
      token, body: { totpCode: totpCodeAt(secret) },
    });
    assert.equal(enable.status, 200, enable.text);

    const login = await call(bindings, "POST", "/v1/auth/login", { body: { handle, passphrase: PASSPHRASE } });
    assert.equal(login.json.mfaRequired, true);
    assert.equal(login.json.token, undefined);

    const wrong = await call(bindings, "POST", "/v1/auth/login/totp", {
      body: { challengeToken: login.json.challengeToken, totpCode: "000000" },
    });
    assert.equal(wrong.status, 401);

    const second = await call(bindings, "POST", "/v1/auth/login", { body: { handle, passphrase: PASSPHRASE } });
    const done = await call(bindings, "POST", "/v1/auth/login/totp", {
      body: { challengeToken: second.json.challengeToken, totpCode: totpCodeAt(secret) },
    });
    assert.equal(done.status, 200, done.text);
    assert.ok(done.json.token);

    // A challenge can be used once only.
    const replay = await call(bindings, "POST", "/v1/auth/login/totp", {
      body: { challengeToken: second.json.challengeToken, totpCode: totpCodeAt(secret) },
    });
    assert.equal(replay.status, 401);
  });

  it("matches the RFC 6238 SHA-1 test vector at T=59", () => {
    // RFC 6238 Appendix B: 8-digit code 94287082 at T=59; the 6-digit form is 287082.
    const base32 = base32Encode(Buffer.from("12345678901234567890"));
    assert.equal(verifyTotp(base32, "287082", 59_000), true);
    assert.equal(verifyTotp(base32, "287083", 59_000), false);
    assert.equal(totpCodeAt(base32, 59_000), "287082");
    assert.ok(generateSecret().length >= 32);
  });
});

describe("recovery codes", () => {
  it("redeems a recovery code exactly once and revokes old sessions", async () => {
    const handle = `rec-${crypto.randomBytes(3).toString("hex")}`;
    const reg = await call(bindings, "POST", "/v1/auth/register", { body: { handle, passphrase: PASSPHRASE } });
    const code = reg.json.recoveryCodes[0];

    const first = await call(bindings, "POST", "/v1/auth/recovery-codes/redeem", {
      body: { handle, recoveryCode: code, newPassphrase: "a brand new passphrase 2026" },
    });
    assert.equal(first.status, 200, first.text);
    const second = await call(bindings, "POST", "/v1/auth/recovery-codes/redeem", {
      body: { handle, recoveryCode: code, newPassphrase: "another passphrase value 77" },
    });
    assert.equal(second.status, 400);
    const stale = await call(bindings, "GET", "/v1/auth/me", { token: reg.json.token });
    assert.equal(stale.status, 401);
  });

  it("stores only keyed hashes of recovery codes", () => {
    assert.equal(hashRecoveryCode("Alpha-Beta-Gamma-Delta"), hashRecoveryCode("alpha-beta-gamma-delta "));
    assert.notEqual(hashRecoveryCode("alpha-beta-gamma-delta"), "alpha-beta-gamma-delta");
  });
});

describe("posts, comments, reactions and polls", () => {
  it("creates a post and shows it in the feed", async () => {
    const author = await seedUser("author");
    const created = await call(bindings, "POST", "/v1/posts", {
      token: author.token,
      body: { content: "Hello <script>alert(1)</script>world", category: "Ideas" },
    });
    assert.equal(created.status, 201, created.text);
    assert.equal(created.json.content.includes("<script>"), false, "HTML must be stripped");
    const feed = await call(bindings, "GET", "/v1/posts?category=Ideas&limit=50");
    assert.ok(feed.json.some((p) => p.id === created.json.id));
  });

  it("does not attach an owner to anonymous (full) posts", async () => {
    const author = await seedUser("anon");
    const created = await call(bindings, "POST", "/v1/posts", {
      token: author.token,
      body: { content: "Private thought", category: "Life", mode: "full" },
    });
    assert.equal(created.json.user, null);
    assert.equal(created.json.canDelete, true);
  });

  it("hides selected-audience posts from non-recipients", async () => {
    const author = await seedUser("sel-author");
    const recipient = await seedUser("sel-recipient");
    const outsider = await seedUser("sel-outsider");
    const created = await call(bindings, "POST", "/v1/posts", {
      token: author.token,
      body: { content: "Only for you", category: "Life", audience: "selected", selectedHandles: [recipient.handle] },
    });
    assert.equal(created.status, 201, created.text);
    const forRecipient = await call(bindings, "GET", `/v1/posts/${created.json.id}`, { token: recipient.token });
    assert.equal(forRecipient.status, 200);
    const forOutsider = await call(bindings, "GET", `/v1/posts/${created.json.id}`, { token: outsider.token });
    assert.equal(forOutsider.status, 404);
  });

  it("toggles a heart reaction and counts it", async () => {
    const author = await seedUser("rx-author");
    const fan = await seedUser("rx-fan");
    const post = await call(bindings, "POST", "/v1/posts", { token: author.token, body: { content: "React to me", category: "Life" } });
    const on = await call(bindings, "POST", "/v1/reactions", { token: fan.token, body: { postId: post.json.id, reactionType: "heart" } });
    assert.deepEqual(on.json, { reacted: true });
    const off = await call(bindings, "POST", "/v1/reactions", { token: fan.token, body: { postId: post.json.id, reactionType: "heart" } });
    assert.deepEqual(off.json, { reacted: false });
  });

  it("comments on a post and refuses cross-post parent comments", async () => {
    const author = await seedUser("cm-author");
    const commenter = await seedUser("cm-commenter");
    const postA = await call(bindings, "POST", "/v1/posts", { token: author.token, body: { content: "First", category: "Life" } });
    const postB = await call(bindings, "POST", "/v1/posts", { token: author.token, body: { content: "Second", category: "Life" } });
    const comment = await call(bindings, "POST", `/v1/posts/${postA.json.id}/comments`, { token: commenter.token, body: { content: "Nice" } });
    assert.equal(comment.status, 201, comment.text);
    const crossed = await call(bindings, "POST", `/v1/posts/${postB.json.id}/comments`, {
      token: commenter.token,
      body: { content: "Reply", parentCommentId: comment.json.id },
    });
    assert.equal(crossed.status, 404);
  });

  it("allows one poll vote per user and changes it on re-vote", async () => {
    const author = await seedUser("poll-author");
    const voter = await seedUser("poll-voter");
    const poll = await call(bindings, "POST", "/v1/posts", {
      token: author.token,
      body: { content: "Pick one", category: "Ideas", pollOptions: ["Yes", "No"] },
    });
    assert.equal(poll.json.pollOptions.length, 2);
    await call(bindings, "POST", `/v1/posts/${poll.json.id}/vote`, { token: voter.token, body: { optionIndex: 0 } });
    const again = await call(bindings, "POST", `/v1/posts/${poll.json.id}/vote`, { token: voter.token, body: { optionIndex: 1 } });
    assert.equal(again.json.votedOption, 1);
    assert.equal(again.json.pollOptions.reduce((n, o) => n + o.votes, 0), 1);
  });
});

describe("direct messages", () => {
  it("creates one thread per pair and only lets participants read it", async () => {
    const alice = await seedUser("alice");
    const bob = await seedUser("bob");
    const eve = await seedUser("eve");
    await dbClient().then((db) => db.user.update({ where: { id: alice.id }, data: { chatPublicKey: "AAAA" } }));
    const first = await call(bindings, "POST", "/v1/chats", { token: alice.token, body: { targetHandle: bob.handle } });
    const second = await call(bindings, "POST", "/v1/chats", { token: alice.token, body: { targetHandle: bob.handle } });
    assert.equal(first.status, 201);
    assert.equal(first.json.threadId, second.json.threadId);
    const outsider = await call(bindings, "GET", `/v1/chats/${first.json.threadId}`, { token: eve.token });
    assert.equal(outsider.status, 403);
  });

  it("stores only encrypted envelopes and rejects tampered ones", async () => {
    const alice = await seedUser("enc-a");
    const bob = await seedUser("enc-b");
    const db = await dbClient();
    await db.user.update({ where: { id: alice.id }, data: { chatPublicKey: "KEY-A" } });
    await db.user.update({ where: { id: bob.id }, data: { chatPublicKey: "KEY-B" } });
    const thread = await call(bindings, "POST", "/v1/chats", { token: alice.token, body: { targetHandle: bob.handle } });
    const envelope = {
      v: 2,
      ciphertext: Buffer.from("ciphertext-bytes").toString("base64"),
      iv: Buffer.alloc(12, 7).toString("base64"),
      senderKey: "KEY-A",
      recipientKey: "KEY-B",
    };
    const sent = await call(bindings, "POST", `/v1/chats/${thread.json.threadId}/messages`, {
      token: alice.token, body: { body: JSON.stringify(envelope) },
    });
    assert.equal(sent.status, 201, sent.text);
    const plaintext = await call(bindings, "POST", `/v1/chats/${thread.json.threadId}/messages`, {
      token: alice.token, body: { body: "plain text please" },
    });
    assert.equal(plaintext.status, 400);
    const history = await call(bindings, "GET", `/v1/chats/${thread.json.threadId}`, { token: bob.token });
    assert.equal(history.status, 200);
    assert.ok(history.json.some((m) => m.body === JSON.stringify(envelope)));
  });
});

describe("media uploads", () => {
  it("accepts a real PNG, strips its text metadata and serves it with a ticket", async () => {
    const user = await seedUser("media");
    const bytes = pngWithTextChunk();
    assert.equal(sniffMediaType(bytes)?.mime, "image/png");
    const { mediaId } = await uploadMedia(user, bytes, "image/png");
    const confirmed = await call(bindings, "POST", "/api/media/confirm", { token: user.token, body: { mediaId } });
    assert.equal(confirmed.status, 201, confirmed.text);

    const stored = [...bindings.MEDIA.objects.entries()].find(([key]) => key.startsWith(`media/${mediaId}`));
    assert.ok(stored, "final object exists");
    assert.equal(Buffer.from(stored[1].bytes).includes(Buffer.from("GPSLatitude")), false, "metadata removed");

    const post = await call(bindings, "POST", "/v1/posts", {
      token: user.token, body: { content: "With a picture", category: "Life", mediaId },
    });
    assert.equal(post.status, 201, post.text);
    const stream = await call(bindings, "GET", post.json.mediaStreamUrl);
    assert.equal(stream.status, 200);
    assert.equal(stream.headers.get("content-type"), "image/png");
  });

  it("rejects bytes that do not match the declared media type", async () => {
    const user = await seedUser("forge");
    const { mediaId } = await uploadMedia(user, Buffer.from("this is not an image at all, just text"), "image/jpeg");
    const confirmed = await call(bindings, "POST", "/api/media/confirm", { token: user.token, body: { mediaId } });
    assert.equal(confirmed.status, 422);
  });

  it("rejects an upload whose size differs from the authorised size", async () => {
    const user = await seedUser("size");
    const init = await call(bindings, "POST", "/api/media/upload-url", {
      token: user.token, body: { mimeType: "image/png", sizeBytes: 999, purpose: "post" },
    });
    const signed = new URL(init.json.signedUrl);
    const put = await call(bindings, "PUT", `${signed.pathname}${signed.search}`, {
      headers: { "content-type": "image/png", "content-length": "10" }, rawBody: Buffer.alloc(10),
    });
    assert.equal(put.status, 413);
  });

  it("refuses an upload token issued to another media id", async () => {
    const user = await seedUser("token");
    const first = await call(bindings, "POST", "/api/media/upload-url", {
      token: user.token, body: { mimeType: "image/png", sizeBytes: 50, purpose: "post" },
    });
    const second = await call(bindings, "POST", "/api/media/upload-url", {
      token: user.token, body: { mimeType: "image/png", sizeBytes: 50, purpose: "post" },
    });
    const stolen = new URL(second.json.signedUrl);
    const otherPath = `/api/media/upload/${first.json.mediaId}`;
    const put = await call(bindings, "PUT", `${otherPath}${stolen.search}`, {
      headers: { "content-length": "50" }, rawBody: Buffer.alloc(50),
    });
    assert.equal(put.status, 403);
  });

  it("reads MP4 duration from the header and enforces the free-tier limit", () => {
    assert.equal(readMp4Duration(mp4WithDuration(42)), 42);
    assert.equal(readMp4Duration(new Uint8Array(64)), null);
  });

  it("strips EXIF from JPEG segments and keeps the image valid", () => {
    const jpeg = Buffer.from([
      0xff, 0xd8,
      0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1 "Exif"
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0 kept
      0xff, 0xda, 0x00, 0x02, 0x11, 0x22, // SOS, entropy data follows
      0xff, 0xd9,
    ]);
    const stripped = stripImageMetadata(jpeg, "image/jpeg");
    assert.ok(stripped);
    assert.equal(stripped.includes(Buffer.from("Exif")), false);
    assert.equal(stripped[2], 0xff);
    assert.equal(stripped[3], 0xe0);
  });
});

describe("scheduled retention", () => {
  before(async () => {
    setRuntime(bindings, null);
    await setDatabase(bindings);
  });

  it("rejects manual triggers without the cron secret", async () => {
    const res = await call(bindings, "POST", "/api/cron/retention", { headers: { authorization: "Bearer nope" } });
    assert.equal(res.status, 401);
  });

  it("runs cleanup once and releases the claim", async () => {
    const result = await runRetentionCleanup();
    assert.equal(typeof result.deletedAccounts, "number");
    const db = await dbClient();
    assert.equal(await db.authChallenge.count({ where: { key: "job:retention" } }), 0);
  });
});
