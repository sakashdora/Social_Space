# Architectural Decisions Log — VEIL

This log documents key technical decisions made during the development of VEIL, their alternatives, and their current evaluation status.

---

## 1. Frictionless handle-based accounts
*   **Decision**: Require only a unique handle and a passphrase to create an account. No email, phone number, or social link is collected.
*   **Alternatives Considered**: Traditional email verification, SMS OTP verification, or third-party OAuth (e.g., Google/Apple login).
*   **Rationale**: Collecting emails or phone numbers creates a database of personally identifiable information (PII) that, if breached, exposes user identities. Handle-only accounts guarantee absolute privacy by design.
*   **Status**: **Valid and active.** Supported by Zod schemas and Prisma user definitions.

---

## 2. Passphrase default with optional Passkey setup
*   **Decision**: Passphrase is the required primary authentication method during sign-up, and WebAuthn Passkey registration is offered as an optional step afterward.
*   **Alternatives Considered**: Passkey-only registration, forcing WebAuthn on all accounts.
*   **Rationale**: Many devices, browsers, and network environments do not have native, active WebAuthn capabilities or secure enclaves. Forcing passkeys at registration blocks these users. A strong passphrase fallback ensures maximum accessibility.
*   **Status**: **Valid and active.** Implemented in the onboarding flow.

---

## 3. HMAC-SHA256 for recovery code storage
*   **Decision**: Use HMAC-SHA256 (keyed using `RECOVERY_CODE_SECRET`) to hash recovery codes, rather than using Argon2id.
*   **Alternatives Considered**: Hashing backup codes using Argon2id or saving them in plaintext.
*   **Rationale**: When a user redeems a backup recovery code, the server must compare the user's input against up to 8 separate code hashes in the database using constant-time verification. Performing 8 Argon2id validations would take over 1.6 seconds, freezing the thread and exposing the server to Denial of Service (DoS) attacks. HMAC-SHA256 is fast, secure against dictionary attacks via the server secret, and protected from timing analysis by `crypto.timingSafeEqual`.
*   **Status**: **Valid and active.** Implemented in `recoveryCodes.js` and `crypto.js`.

---

## 4. Client-side face anonymization (MediaPipe)
*   **Decision**: Move the face detection and anonymization logic to the client-side browser using MediaPipe FaceDetector tasks, rather than running a server-side Python Colab pipe.
*   **Alternatives Considered**: A server-side PyTorch / face-recognition pipeline hosted on Colab or a microservice.
*   **Rationale**: Processing media on a server-side Python runner raises server hosting costs and introduces AGPL licensing concerns. Handling detection in the client keeps the backend lightweight and maintains license compliance.
*   **Status**: **Needs Revisit (Orphaned).** The library `faceDetect.ts` is in the codebase but is never called in the upload component.

---

## 5. Deferral of Direct Message encryption
*   **Decision**: Direct messages are written as plaintext string values in the database, with no active cryptographic cipher applied to the message payloads before storage.
*   **Alternatives Considered**: Database column encryption using Prisma or end-to-end encryption using the WebCrypto API.
*   **Rationale**: Unknown. Likely bypassed during session iteration due to implementation complexity, leaving chat records exposed.
*   **Status**: **Needs Revisit (High Risk).** Plaintext storage violates the E2E encryption claims shown in the message views.

---

## 6. Base64 local media storage
*   **Decision**: Return uploads directly as base64 data URLs rather than uploading to Cloudflare R2 or a Supabase bucket.
*   **Alternatives Considered**: Integrating Cloudflare R2 or AWS S3 SDK.
*   **Rationale**: Selected as a development shortcut to avoid external infrastructure setup.
*   **Status**: **Needs Revisit (Dev Placeholder).** Inflates database storage limits and slows feed performance.
