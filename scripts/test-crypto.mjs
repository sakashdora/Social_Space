import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { webcrypto } from "node:crypto";
import { generateChatKeyPair, exportPublicKeyBase64, importPublicKeyBase64, deriveSharedAesKey, encryptText, decryptText, encryptAttachment, decryptAttachment, saveKeyRecord, getKeyRecord, deletePrivateKey } from "../frontend/src/lib/crypto.ts";
globalThis.window = { crypto: webcrypto };

test("two participants decrypt text; changing the thread or ciphertext fails", async () => {
  const alice = await generateChatKeyPair(); const bob = await generateChatKeyPair();
  const a = await deriveSharedAesKey(alice.privateKey, await importPublicKeyBase64(await exportPublicKeyBase64(bob.publicKey)));
  const b = await deriveSharedAesKey(bob.privateKey, alice.publicKey);
  const encrypted = await encryptText("private message", a, "thread-1:keys");
  assert.equal(await decryptText(encrypted.ciphertext, encrypted.iv, b, "thread-1:keys"), "private message");
  await assert.rejects(decryptText(encrypted.ciphertext, encrypted.iv, b, "thread-2:keys"));
  const tampered = Buffer.from(encrypted.ciphertext, "base64"); tampered[0] ^= 1;
  await assert.rejects(decryptText(tampered.toString("base64"), encrypted.iv, b, "thread-1:keys"));
  await assert.rejects(webcrypto.subtle.exportKey("pkcs8", alice.privateKey));
});
test("attachment encryption round-trips bytes and detects tampering", async () => {
  const original = new TextEncoder().encode("image/video fixture");
  const encrypted = await encryptAttachment(original.buffer);
  assert.notDeepEqual(new Uint8Array(encrypted.bytes), original);
  assert.deepEqual(new Uint8Array(await decryptAttachment(encrypted.bytes, encrypted.key, encrypted.iv)), original);
  new Uint8Array(encrypted.bytes)[0] ^= 1;
  await assert.rejects(decryptAttachment(encrypted.bytes, encrypted.key, encrypted.iv));
});
test("key rotation preserves previous keys and account deletion removes only that account", async () => {
  const first = await generateChatKeyPair(); const second = await generateChatKeyPair();
  const old = { privateKey: first.privateKey, publicKeyBase64: await exportPublicKeyBase64(first.publicKey) };
  const next = { privateKey: second.privateKey, publicKeyBase64: await exportPublicKeyBase64(second.publicKey) };
  await saveKeyRecord("alice", old); await saveKeyRecord("bob", old); await saveKeyRecord("alice", next);
  assert.equal((await getKeyRecord("alice")).publicKeyBase64, next.publicKeyBase64);
  assert.equal((await getKeyRecord("alice", old.publicKeyBase64)).publicKeyBase64, old.publicKeyBase64);
  await deletePrivateKey("alice");
  assert.equal(await getKeyRecord("alice"), null);
  assert.equal(await getKeyRecord("alice", old.publicKeyBase64), null);
  assert.ok(await getKeyRecord("bob"));
});
