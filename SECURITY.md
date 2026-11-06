# Security boundaries

This document describes the source implementation, not a security certification or vulnerability score. See [REMEDIATION.md](REMEDIATION.md) for verification evidence.

## Accounts and authorization

Passphrases are stored as salted PBKDF2-HMAC-SHA256 hashes (600,000 iterations, WebCrypto). Accounts created before the Cloudflare move keep their Argon2id hashes until their next successful sign-in, which upgrades them. JWTs are checked against account bans and token versions. Sensitive actions require the current passphrase. Passkey verification uses configured origins and relying-party IDs; challenges are single-use and shared across instances. Shared challenges, including pending TOTP secrets, are encrypted at rest with the server encryption key. Recovery-code redemption claims the code atomically. Rate-limit storage failures reject protected requests.

Production secrets are stored only as Cloudflare Worker secrets (`wrangler secret put`). The D1 database has no public API; only the Worker can reach it, so the Worker enforces every ownership and audience rule itself. Session tokens are HS256 JWTs verified with a constant-time comparison; only HS256 is accepted.

## Posts and uploads

Anonymous posts hide their owner from API responses; the database still retains ownership for deletion and permissions. This is pseudonymity from other users, not anonymity from the operator.

New media must have an owned, server-issued upload reservation and pass confirmation before publication. The container is identified from its magic bytes, not the declared MIME type, and the byte count must match the reservation. JPEG, PNG and WebP images have EXIF, XMP, text and comment segments removed. MP4 and MOV clips are checked for a readable duration against the account limit (60 s free, 600 s premium). Video metadata is not stripped on the Worker, and WebM or Ogg media cannot be duration-checked, so it is refused. These operations do not remove faces, voices, locations visible in frames, or all identifying content. Face detection can miss people; preview and review images yourself.

Media is stored in a private bucket. Feed responses issue short-lived media capabilities so image/video elements can load restricted posts. A copied capability remains usable for up to 15 minutes. Chat attachments use tickets of at most 60 seconds, bounded by message expiry. The Worker streams objects from R2; storage URLs are never exposed to the browser. Deleting or expiring a post prevents new capabilities from being redeemed. Already-issued tickets and downloaded copies cannot be recalled instantly.

## Direct messages

New text and attachment keys are encrypted in the browser using ECDH P-256, HKDF, and AES-GCM. Attachment bytes are separately encrypted before upload. Message envelopes bind the thread and public-key versions as authenticated data. Local key rotation archives earlier keys on that device.

This is not a Signal-style audited protocol: there is no double ratchet, independent peer-key verification, or guaranteed forward secrecy. The server supplies public keys and sees participants, timing, sizes, and ciphertext. Browser compromise can misuse local keys. Keys are not backed up or synchronized; clearing browser storage or changing devices can make history unreadable. Older messages without embedded key versions may not survive a peer's historical key reset.

Chat retention is enforced on reads. Physical deletion is asynchronous. New chat attachments follow message expiry; legacy raw attachments are not retroactively encrypted by this repair.

## Cleanup and moderation

Storage deletion jobs survive account deletion and retry failures. Processing/staging objects wait until their upload authorization expires before final cleanup. A daily Cloudflare Cron Trigger controls physical cleanup timing; runtime checks hide expired content sooner.

Reports and appeals are visible to their submitter and configured moderators. Queue status changes record reviews; they do not automatically suspend accounts or remove posts. Automated moderation can be wrong and falls back to basic text rules without providers. Do not claim automated detection of all prohibited content or legal reporting.

Hosting and security services process connection metadata. Security-event fingerprints and rate-limit keys are not proof of untraceability. No "zero telemetry" or "zero vulnerabilities" guarantee is made.
