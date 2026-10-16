import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import prisma from "../config/prisma.js";
import { store } from "../config/challengeStore.js";
import { generateRecoveryCodes } from "../utils/recoveryCodes.js";
import { limiters, initRateLimiters } from "../config/rateLimiters.js";
import { env } from "../config/env.js";
// Keep hashing and database operations real. Only external provider/ceremony
// responses are fixtures; WebAuthn cryptography belongs to its upstream library.
const verify = jest.fn(async () => ({ verified: true, authenticationInfo: { newCounter: 0 } }));
await jest.unstable_mockModule("@simplewebauthn/server", () => ({
  generateAuthenticationOptions: async () => ({ challenge: "test-challenge" }),
  verifyAuthenticationResponse: verify,
  generateRegistrationOptions: async () => ({}), verifyRegistrationResponse: async () => ({}),
}));
const axios = (await import("axios")).default;
jest.spyOn(axios, "get").mockResolvedValue({ data: "" });
const { default: app, isOriginAllowed } = await import("../../app.js");
let user;
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "User", "AuthChallenge", "rate_limit_counters" CASCADE');
  user = await prisma.user.create({ data: { handle: "recovery-user", recoveryHash: "fixture", pendingDeletionAt: new Date() } });
  verify.mockClear();
});
describe("Authentication regression checks", () => {
  it("accepts a zero-counter authenticator, consumes its challenge, and cancels pending deletion", async () => {
    const credential = await prisma.passkey.create({ data: { userId: user.id, credentialID: "credential-zero", publicKey: "AQ==", counter: 0 } });
    await store.set("passkey:auth:fixture", { challenge: "test-challenge" }, 60);
    const login = () => request(app).post("/v1/auth/passkeys/login-verify").set("Origin", "https://untrusted.vercel.app").send({ credential: { id: credential.credentialID }, sessionToken: "fixture" });
    expect((await login()).status).toBe(200);
    expect(verify.mock.calls[0][0].expectedOrigin).toEqual(env.WEBAUTHN_ORIGIN.split(","));
    expect(verify.mock.calls[0][0].expectedRPID).toBe(env.WEBAUTHN_RP_ID);
    expect((await prisma.passkey.findUnique({ where: { id: credential.id } })).isRevoked).toBe(false);
    expect((await prisma.user.findUnique({ where: { id: user.id } })).pendingDeletionAt).toBeNull();
    expect((await login()).status).toBe(400);
    expect(verify).toHaveBeenCalledTimes(1);
  });
  it("allows only one concurrent redemption of a recovery code", async () => {
    const codes = generateRecoveryCodes(1);
    await prisma.recoveryCode.create({ data: { userId: user.id, codeHash: codes.hashedCodes[0] } });
    const redeem = () => request(app).post("/v1/auth/recovery-codes/redeem").send({ handle: user.handle, recoveryCode: codes.rawCodes[0], newPassphrase: "Jupiter!Mango#Velvet72-Forest" });
    const responses = await Promise.all([redeem(), redeem()]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
    expect((await prisma.user.findUnique({ where: { id: user.id } })).tokenVersion).toBe(1);
  });
  it("fails closed when the shared rate limiter is unavailable", async () => {
    await initRateLimiters();
    const spy = jest.spyOn(limiters.ai, "consume").mockRejectedValue(new Error("Database unavailable"));
    try { expect((await request(app).post("/api/generate").send({ topic: "test" })).status).toBe(503); }
    finally { spy.mockRestore(); }
  });
  it("does not allow arbitrary Vercel origins", () => {
    expect(isOriginAllowed("https://untrusted.vercel.app")).toBe(false);
    expect(isOriginAllowed("http://localhost:5173")).toBe(true);
  });
  it("returns an unavailable error instead of fabricated AI output", async () => {
    expect((await request(app).post("/api/generate").send({ topic: "test" })).status).toBe(503);
  });
});
