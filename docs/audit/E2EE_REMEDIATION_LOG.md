# VEIL — E2EE Remediation Log

**Implementation Date:** July 8, 2026
**Target Base Commit:** `b5eb244`

This document serves as the official implementation log for the End-to-End Encryption (E2EE) remediation project on the VEIL anonymous social platform.

---

## 1. Schema & Database Infrastructure

- **Prisma Schema Update:** Added `chatPublicKey` and `chatPublicKeyAlgo` fields to the `User` model in `backend/prisma/schema.prisma`.
- **Database Migration:** Generated and applied migration `20260708174612_add_chat_public_key` to update the PostgreSQL/Supabase database.
- **Client Generation:** Successfully re-generated the Prisma client code.

---

## 2. Backend Key Infrastructure & Routing

- **PATCH /v1/auth/chat-public-key:**
  - Implemented in `backend/src/controllers/auth/profile.controller.js` and mounted in `backend/src/routes/auth.routes.js`.
  - Validates that the body payload is a well-formed base64 SPKI public key (uses native Node.js `crypto` library parsing).
  - Rejects any malformed, non-base64, or non-EC public keys with `400 Bad Request`.
  - Stores valid keys and sets the algorithm to `ECDH-P256` in the database.
- **GET /v1/users/:id/chat-public-key:**
  - Created a new router `backend/src/routes/users.routes.js` and mounted it under `/v1/users` in `backend/app.js`.
  - Exposes the target user's ID, public key, and algorithm for key agreement.
  - Secured with session checks via `requireAuth` middleware to prevent unauthenticated scraping of user public keys.
- **GET /v1/auth/me:**
  - Updated to return the authenticated user's `chatPublicKey` and `chatPublicKeyAlgo` fields so the client can verify registration status on boot.

---

## 3. Client Key Custody & Generation

- **Local Key Storage:**
  - Created `frontend/src/lib/crypto.ts` implementing client-side cryptography.
  - Generates ECDH P-256 keypairs with the private key marked as non-extractable (`extractable: false`) to prevent export or exfiltration.
  - Stores the private key and public key base64 string under the user's ID in IndexedDB (`veil_crypto_db`, `keys` object store).
- **Key Generation Hook:**
  - Placed inside `frontend/src/routes/messages.tsx`.
  - On mount, queries `getMe()`. If no key record exists locally in IndexedDB and no public key is registered on the server, it silently generates a keypair and registers the public key with the server.
  - Re-uploads local keys to the server if they exist in IndexedDB but not on the server.

---

## 4. Cryptographic Pipeline (Send & Receive)

- **Key Agreement:**
  - Uses `window.crypto.subtle.deriveBits` to perform an ECDH key exchange between the sender's private key and the recipient's public key.
  - Uses standard HKDF (SHA-256) with a static context info string (`VEIL_MESSAGE_ENCRYPTION`) to derive a symmetric 256-bit AES-GCM key.
- **Key Caching:**
  - Caches derived symmetric keys in memory (`threadKeyCache` in `frontend/src/lib/api.ts`) indexed by `threadId` to minimize derivation overhead and avoid redundant public key network fetches.
- **Encryption on Send:**
  - Message body text is encoded to UTF-8 bytes and encrypted client-side using AES-256-GCM with a randomly generated 12-byte IV.
  - The payload sent to the API is structured as a JSON string containing the ciphertext and IV in base64: `{"ciphertext":"...","iv":"..."}`.
- **Decryption on Receive:**
  - The message list and sidebar thread previews are decrypted client-side at render time.
  - If a message fails parsing or decryption, it falls back to showing "Unable to decrypt".

---

## 5. Key Loss and Recovery

- **Key Mismatch / Loss Warning:**
  - If a user opens the messaging interface and local keys are missing (e.g. new device/browser, cleared storage) but the server holds a registered public key, a warning modal overlay is displayed.
  - The overlay alerts the user that historical messages cannot be read on this device.
  - Provides a **"Generate New Keys & Start Fresh"** option which resets local IndexedDB records and publishes the new public key to the server. Historical ciphertext stays locked.

---

## 6. Build and Verification Status

- **Verification:**
  - Run `npm run build` on the frontend. The production bundle compiled successfully without any TypeScript or bundling issues.
  - The development server on port 3000 is active.
