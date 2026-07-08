/**
 * src/schemas/auth.schema.js
 *
 * Zod validation schemas for all authentication and user security routes.
 */

import { z } from "zod";

// Base validators
const handleValidator = z
  .string({ required_error: "Handle is required." })
  .trim()
  .min(3, "Handle must be at least 3 characters.")
  .max(20, "Handle must be at most 20 characters.")
  .regex(/^[a-z0-9-]+$/, "Handle may only contain lowercase letters, numbers, and dashes.");

const passphraseValidator = z
  .string({ required_error: "Passphrase is required." })
  .min(12, "Passphrase must be at least 12 characters.")
  .max(100, "Passphrase is too long (max 100 characters).");

// Schemas
export const registerSchema = z.object({
  handle: handleValidator,
  passphrase: passphraseValidator,
});

export const loginSchema = z.object({
  handle: z.string({ required_error: "Handle is required." }).trim().toLowerCase(),
  passphrase: z.string({ required_error: "Passphrase is required." }),
});

export const loginTotpSchema = z.object({
  challengeToken: z.string({ required_error: "Challenge token is required." }).trim(),
  totpCode: z.string({ required_error: "TOTP code is required." }).trim().length(6, "TOTP code must be 6 digits."),
});

export const redeemRecoveryCodeSchema = z.object({
  handle: z.string({ required_error: "Handle is required." }).trim().toLowerCase(),
  recoveryCode: z.string({ required_error: "Recovery code is required." }).trim(),
  newPassphrase: passphraseValidator,
});

export const changePassphraseSchema = z.object({
  currentPassphrase: z.string({ required_error: "Current passphrase is required." }),
  newPassphrase: passphraseValidator,
});

export const sensitiveActionSchema = z.object({
  currentPassphrase: z.string({ required_error: "Current passphrase is required." }),
});

export const totpEnableSchema = z.object({
  totpCode: z.string({ required_error: "TOTP code is required." }).trim().length(6, "TOTP code must be 6 digits."),
});

export const passkeyVerifyLoginSchema = z.object({
  credential: z.any({ required_error: "WebAuthn credential response is required." }),
  sessionToken: z.string({ required_error: "Passkey session token is required." }).trim(),
});

export const passkeyVerifyRegisterSchema = z.object({
  credential: z.any({ required_error: "WebAuthn credential response is required." }),
  nickname: z.string().trim().max(50, "Nickname must be at most 50 characters.").optional().nullable(),
});
